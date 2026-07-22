# PrivacyReady infrastructure lifecycle
#
# Wraps Terraform (workspace-based test/production split -- see
# terraform/locals.tf's `is_prod`) plus the ECR bootstrap + image
# push steps from docs/BOOTSTRAP.md into single, memorable commands.
# The GitLab pipeline (.gitlab-ci.yml) calls these same targets, so
# "run it locally" and "run it in CI" are always the exact same
# commands -- nothing pipeline-only or laptop-only to fall out of sync.
#
# Usage:
#   make create ENV=test          # first-time stand-up of an environment
#   make destroy ENV=test          # full teardown
#   make plan ENV=production
#   make apply ENV=production
#
# ENV must be "test" or "production" -- selects the Terraform workspace.
# ENV=production is intentionally not the default: every destructive
# target requires it to be named explicitly.

SHELL := /bin/bash
ENV ?= test
TF_DIR := terraform
AWS_REGION := eu-west-2
ACCOUNT_ID := $(shell aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY := $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com
SERVICES := api scanner dsr

.PHONY: help init workspace fmt validate plan apply destroy create \
        ecr-bootstrap docker-build docker-push docker-push-all deploy roll \
        teardown-testing startup-testing wipe-buckets outputs check-env

help:
	@echo "PrivacyReady infrastructure Makefile"
	@echo ""
	@echo "  make create ENV=test|production   -- init, bootstrap ECR, build+push images, apply"
	@echo "  make destroy ENV=test|production   -- destroy all Terraform-managed infrastructure"
	@echo "  make plan ENV=test|production       -- terraform plan"
	@echo "  make apply ENV=test|production      -- terraform apply"
	@echo "  make deploy SERVICE=api             -- build, push, and force a new ECS deployment for one service"
	@echo "  make teardown-testing / startup-testing -- cost-saving stop/start (scripts/*.sh)"
	@echo "  make wipe-buckets                   -- DESTRUCTIVE: empty all privacyready-* S3 buckets (requires CONFIRM=yes)"
	@echo ""
	@echo "Current: ENV=$(ENV) AWS_REGION=$(AWS_REGION)"

check-env:
	@if [ "$(ENV)" != "test" ] && [ "$(ENV)" != "production" ]; then \
		echo "ENV must be 'test' or 'production' (got '$(ENV)')"; exit 1; \
	fi
	@if [ "$(ENV)" = "production" ] && [ -z "$$TF_VAR_superadmin_email" ]; then \
		echo "TF_VAR_superadmin_email is required for production (no default -- see docs/BOOTSTRAP.md)"; exit 1; \
	fi

init: check-env
	cd $(TF_DIR) && terraform init

workspace: check-env
	cd $(TF_DIR) && \
	(terraform workspace select $(ENV) 2>/dev/null || terraform workspace new $(ENV))

fmt:
	cd $(TF_DIR) && terraform fmt -recursive

validate: init
	cd $(TF_DIR) && terraform validate

plan: init workspace
	cd $(TF_DIR) && terraform plan -var="domain_name=$(if $(filter production,$(ENV)),privacyready.co.uk,privacyready.local)"

apply: init workspace
	cd $(TF_DIR) && terraform apply -auto-approve \
		-var="domain_name=$(if $(filter production,$(ENV)),privacyready.co.uk,privacyready.local)"

# Full teardown. Requires CONFIRM=yes so this can never fire from a
# stray `make destroy` with no arguments -- same pattern as
# scripts/wipe_bucket.py's --yes guard.
destroy: check-env
	@if [ "$(CONFIRM)" != "yes" ]; then \
		echo "This will DESTROY all Terraform-managed infrastructure for ENV=$(ENV)."; \
		echo "Re-run as: make destroy ENV=$(ENV) CONFIRM=yes"; \
		exit 1; \
	fi
	cd $(TF_DIR) && \
	(terraform workspace select $(ENV) 2>/dev/null || terraform workspace new $(ENV)) && \
	terraform destroy -auto-approve \
		-var="domain_name=$(if $(filter production,$(ENV)),privacyready.co.uk,privacyready.local)"

# ECR repos must exist before the first `docker push`, and before the
# rest of `apply` can reference their image URIs -- see docs/BOOTSTRAP.md.
ecr-bootstrap: init workspace
	cd $(TF_DIR) && terraform apply -auto-approve \
		-target=aws_ecr_repository.app \
		-target=aws_ecr_repository.scanner \
		-target=aws_ecr_repository.dsr \
		-var="domain_name=$(if $(filter production,$(ENV)),privacyready.co.uk,privacyready.local)"

# scanner's Dockerfile lives at services/scanner/cmd/scanner (its COPY
# paths expect that directory as the build context) -- api and dsr have
# theirs at their service root. Mapped explicitly rather than assuming
# a uniform path, since guessing wrong here fails silently until push.
docker-build:
	@if [ -z "$(SERVICE)" ]; then echo "usage: make docker-build SERVICE=api|scanner|dsr"; exit 1; fi
	docker build -t privacyready-$(SERVICE) $(if $(filter scanner,$(SERVICE)),services/scanner/cmd/scanner,services/$(SERVICE))

docker-push: docker-build
	aws ecr get-login-password --region $(AWS_REGION) | \
		docker login --username AWS --password-stdin $(ECR_REGISTRY)
	docker tag privacyready-$(SERVICE):latest $(ECR_REGISTRY)/privacyready-$(SERVICE):latest
	docker push $(ECR_REGISTRY)/privacyready-$(SERVICE):latest

# One-shot: build + push every service's image. Used by `make create`
# and available standalone for a full image refresh.
docker-push-all:
	@for s in $(SERVICES); do $(MAKE) docker-push SERVICE=$$s; done

# Build, push, and roll a single service -- the same steps the GitLab
# build-and-deploy stages run per-service, wrapped as one command.
deploy: docker-push
	@if [ -z "$(SERVICE)" ]; then echo "usage: make deploy SERVICE=api|scanner|dsr"; exit 1; fi
	aws ecs update-service --cluster privacyready-cluster \
		--service privacyready-$(SERVICE) --force-new-deployment --region $(AWS_REGION)

# Full first-time (or from-scratch) stand-up of an environment:
# ECR repos -> images pushed -> the rest of the infrastructure.
create: ecr-bootstrap docker-push-all apply
	@echo "Environment '$(ENV)' created."
	@cd $(TF_DIR) && terraform output

# Force a new ECS deployment without rebuilding -- used by CI after its
# own build-and-scan stage has already pushed a fresh image.
roll:
	@if [ -z "$(SERVICE)" ]; then echo "usage: make roll SERVICE=api|scanner|dsr"; exit 1; fi
	aws ecs update-service --cluster privacyready-cluster \
		--service privacyready-$(SERVICE) --force-new-deployment --region $(AWS_REGION)

outputs:
	cd $(TF_DIR) && terraform output

teardown-testing:
	./scripts/teardown-testing.sh

startup-testing:
	./scripts/startup-testing.sh

wipe-buckets:
	@if [ "$(CONFIRM)" != "yes" ]; then \
		echo "Re-run as: make wipe-buckets CONFIRM=yes"; exit 1; \
	fi
	python3 scripts/wipe_bucket.py --yes
