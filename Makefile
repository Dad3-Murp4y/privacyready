# PrivacyReady infrastructure lifecycle
#
# Wraps Terraform across the persistent/environments split (see
# terraform/README.md) plus the Docker/ECR build+push steps into
# single, memorable commands. The GitLab pipeline (.gitlab-ci.yml)
# calls these same targets, so "run it locally" and "run it in CI"
# are always the exact same commands.
#
# Layout:
#   terraform/persistent/            own state -- GitLab, Route53, SES,
#                                     ACM, ECR, Transit Gateway. Never
#                                     touched by `make destroy ENV=x`.
#   terraform/environments/test/     own state -- destroy freely
#   terraform/environments/production/  own state -- destroy freely
#
# Usage:
#   make persistent-apply              # one-time: stand up GitLab/DNS/SES/ECR
#   make create ENV=test               # stand up an app environment
#   make destroy ENV=test CONFIRM=yes  # tear one down
#   make plan ENV=production
#   make apply ENV=production
#
# ENV must be "test" or "production". ENV=production is intentionally
# not the default: every destructive target requires it named explicitly.

SHELL := /bin/bash
ENV ?= test
TF_ENV_DIR := terraform/environments/$(ENV)
TF_PERSISTENT_DIR := terraform/persistent
AWS_REGION := eu-west-2
ACCOUNT_ID := $(shell aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY := $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com
SERVICES := api scanner

# ECS cluster/service names differ by environment (see
# environments/test/ecs.tf's -test suffixing, done specifically so
# test and production can coexist without name collisions).
ECS_CLUSTER := $(if $(filter production,$(ENV)),privacyready-cluster,privacyready-test-cluster)
ECS_SERVICE_PREFIX := $(if $(filter production,$(ENV)),privacyready,privacyready-test)

.PHONY: help check-env \
        persistent-init persistent-plan persistent-apply persistent-destroy persistent-outputs \
        init plan apply destroy create fmt validate \
        docker-build docker-push docker-push-all deploy roll \
        environment-shutdown environment-startup wipe-buckets outputs

help:
	@echo "PrivacyReady infrastructure Makefile"
	@echo ""
	@echo "  make persistent-apply                -- one-time: stand up GitLab/DNS/SES/ECR/Transit Gateway"
	@echo "  make persistent-destroy CONFIRM=yes   -- DESTROYS GitLab/DNS/SES. Basically never run this."
	@echo "  make create ENV=test|production       -- init, build+push images, apply an app environment"
	@echo "  make destroy ENV=test|production CONFIRM=yes -- destroy one app environment (persistent untouched)"
	@echo "  make plan ENV=test|production"
	@echo "  make apply ENV=test|production"
	@echo "  make deploy SERVICE=api ENV=production -- build, push, and force a new ECS deployment for one service"
	@echo "  make environment-shutdown / environment-startup ENV=<test|production>"
	@echo "  make wipe-buckets CONFIRM=yes          -- DESTRUCTIVE: empty all privacyready-* S3 buckets"
	@echo ""
	@echo "Current: ENV=$(ENV) AWS_REGION=$(AWS_REGION)"

check-env:
	@if [ "$(ENV)" != "test" ] && [ "$(ENV)" != "production" ]; then \
		echo "ENV must be 'test' or 'production' (got '$(ENV)')"; exit 1; \
	fi
	@if [ "$(ENV)" = "production" ] && [ -z "$$TF_VAR_superadmin_email" ]; then \
		echo "TF_VAR_superadmin_email is required for production (no default -- see docs/BOOTSTRAP.md)"; exit 1; \
	fi

# ---- Persistent layer (GitLab, Route53, SES, ACM, ECR, Transit Gateway) ----
# One-time setup, essentially never destroyed. Separate state from
# everything below, on purpose -- see terraform/persistent/versions.tf.

persistent-init:
	cd $(TF_PERSISTENT_DIR) && terraform init

persistent-plan: persistent-init
	cd $(TF_PERSISTENT_DIR) && terraform plan

persistent-apply: persistent-init
	cd $(TF_PERSISTENT_DIR) && terraform apply

persistent-destroy: persistent-init
	@if [ "$(CONFIRM)" != "yes" ]; then \
		echo "This destroys GitLab, DNS, SES, and ECR repositories -- basically never what you want."; \
		echo "Re-run as: make persistent-destroy CONFIRM=yes"; \
		exit 1; \
	fi
	cd $(TF_PERSISTENT_DIR) && terraform destroy

persistent-outputs:
	cd $(TF_PERSISTENT_DIR) && terraform output

# ---- App environments (test / production) ----

fmt:
	terraform fmt -recursive terraform/

init: check-env
	cd $(TF_ENV_DIR) && terraform init

validate: init
	cd $(TF_ENV_DIR) && terraform validate

plan: init
	cd $(TF_ENV_DIR) && terraform plan

apply: init
	cd $(TF_ENV_DIR) && terraform apply -auto-approve

# Requires CONFIRM=yes so this can never fire from a stray `make
# destroy` with no arguments -- same pattern as scripts/wipe_bucket.py.
# Only ever touches terraform/environments/$(ENV) -- physically
# incapable of reaching terraform/persistent (GitLab/DNS/SES/ECR),
# since that's a completely separate state file this directory has no
# reference to.
destroy: check-env
	@if [ "$(CONFIRM)" != "yes" ]; then \
		echo "This will DESTROY all infrastructure in environments/$(ENV) (GitLab/DNS/SES are unaffected)."; \
		echo "Re-run as: make destroy ENV=$(ENV) CONFIRM=yes"; \
		exit 1; \
	fi
	cd $(TF_ENV_DIR) && terraform destroy -auto-approve

# scanner's Dockerfile lives at services/scanner/cmd/scanner (its COPY
# paths expect that directory as the build context) -- api and dsr have
# theirs at their service root.
docker-build:
	@if [ -z "$(SERVICE)" ]; then echo "usage: make docker-build SERVICE=api|scanner|dsr"; exit 1; fi
	docker build -t privacyready-$(SERVICE) $(if $(filter scanner,$(SERVICE)),services/scanner/cmd/scanner,services/$(SERVICE))

# Images are shared across environments (one set of ECR repos in
# persistent/, tagged :latest) -- ENV doesn't affect this target.
docker-push: docker-build
	aws ecr get-login-password --region $(AWS_REGION) | \
		docker login --username AWS --password-stdin $(ECR_REGISTRY)
	docker tag privacyready-$(SERVICE):latest $(ECR_REGISTRY)/privacyready-$(SERVICE):latest
	docker push $(ECR_REGISTRY)/privacyready-$(SERVICE):latest

docker-push-all:
	@for s in $(SERVICES); do $(MAKE) docker-push SERVICE=$$s; done

# Build, push, and roll a single service for the given ENV.
deploy: docker-push
	@if [ -z "$(SERVICE)" ]; then echo "usage: make deploy SERVICE=api|scanner|dsr ENV=test|production"; exit 1; fi
	aws ecs update-service --cluster $(ECS_CLUSTER) \
		--service $(ECS_SERVICE_PREFIX)-$(SERVICE) --force-new-deployment --region $(AWS_REGION)

deploy-frontend: check-env
	@echo "Deploying marketing site to $(ENV)..."
	@rm -rf /tmp/frontend-deploy
	@cp -r frontend /tmp/frontend-deploy
	@rm -rf /tmp/frontend-deploy/portal /tmp/frontend-deploy/node_modules
	@for f in about contact cookies faq privacy-policy terms coming-soon; do \
		if [ -f "/tmp/frontend-deploy/$$f.html" ]; then \
			mkdir -p "/tmp/frontend-deploy/$$f"; \
			cp "/tmp/frontend-deploy/$$f.html" "/tmp/frontend-deploy/$$f/index.html"; \
			cp "/tmp/frontend-deploy/$$f.html" "/tmp/frontend-deploy/$$f-clean"; \
		fi; \
	done
	@if [ "$(ENV)" = "test" ]; then \
		find /tmp/frontend-deploy -type f -name "*.html" -exec sed -i 's|https://portal\.privacyready\.co\.uk|https://test-portal.privacyready.co.uk|g' {} +; \
		find /tmp/frontend-deploy -type f -name "*.html" -exec sed -i 's|https://privacyready\.co\.uk|https://test.privacyready.co.uk|g' {} +; \
		find /tmp/frontend-deploy -type f -name "*-clean" -exec sed -i 's|https://portal\.privacyready\.co\.uk|https://test-portal.privacyready.co.uk|g' {} +; \
		find /tmp/frontend-deploy -type f -name "*-clean" -exec sed -i 's|https://privacyready\.co\.uk|https://test.privacyready.co.uk|g' {} +; \
	fi
	@export BUCKET=$$(cd $(TF_ENV_DIR) && terraform output -raw frontend_bucket_id); \
	 aws s3 sync /tmp/frontend-deploy/ s3://$$BUCKET/ --exclude "*-clean" --delete; \
	 for f in about contact cookies faq privacy-policy terms coming-soon; do \
		if [ -f "/tmp/frontend-deploy/$$f-clean" ]; then \
			aws s3 cp "/tmp/frontend-deploy/$$f-clean" "s3://$$BUCKET/$$f" --content-type "text/html"; \
		fi; \
	 done
	@export CF_ID=$$(cd $(TF_ENV_DIR) && terraform output -raw frontend_cloudfront_id); \
	 aws cloudfront create-invalidation --distribution-id $$CF_ID --paths "/*"

deploy-portal: check-env
	@echo "Building and deploying portal to $(ENV)..."
	@cd frontend/portal && npm ci && npm run build -- --mode $(ENV)
	@export BUCKET=$$(cd $(TF_ENV_DIR) && terraform output -raw portal_bucket_id); \
	 aws s3 sync frontend/portal/dist/ s3://$$BUCKET/ --delete
	@export CF_ID=$$(cd $(TF_ENV_DIR) && terraform output -raw portal_cloudfront_id); \
	 aws cloudfront create-invalidation --distribution-id $$CF_ID --paths "/*"

# Force a new ECS deployment without rebuilding -- used by CI after its
# own build-and-scan stage has already pushed a fresh image.
roll:
	@if [ -z "$(SERVICE)" ]; then echo "usage: make roll SERVICE=api|scanner|dsr ENV=test|production"; exit 1; fi
	aws ecs update-service --cluster $(ECS_CLUSTER) \
		--service $(ECS_SERVICE_PREFIX)-$(SERVICE) --force-new-deployment --region $(AWS_REGION)

# Full stand-up of an app environment. Assumes `make persistent-apply`
# has already run at least once (ECR repos must exist before push).
create: docker-push-all apply
	@echo "Environment '$(ENV)' created."
	@cd $(TF_ENV_DIR) && terraform output

outputs:
	cd $(TF_ENV_DIR) && terraform output

environment-shutdown:
	@if [ -z "$(ENV)" ]; then echo "usage: make environment-shutdown ENV=test|production"; exit 1; fi
	@ENV=$(ENV) ./scripts/environment-shutdown.sh

environment-startup:
	@if [ -z "$(ENV)" ]; then echo "usage: make environment-startup ENV=test|production"; exit 1; fi
	@ENV=$(ENV) ./scripts/environment-startup.sh

wipe-buckets:
	@if [ "$(CONFIRM)" != "yes" ]; then \
		echo "Re-run as: make wipe-buckets CONFIRM=yes"; exit 1; \
	fi
	python3 scripts/wipe_bucket.py --yes
