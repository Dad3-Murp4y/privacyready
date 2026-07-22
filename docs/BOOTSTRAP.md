# Bootstrapping a New AWS Account

Steps to stand up PrivacyReady's infrastructure in a fresh AWS account.

**Fastest path**: once state storage exists (step 1) and you're authenticated to AWS CLI, `make create ENV=production` (or `ENV=test`) runs the ECR bootstrap, builds/pushes all three service images, and applies the rest of the infrastructure in one command. See the root `Makefile` (`make help` for all targets). The steps below are what that target does internally, spelled out in case you need to run a piece of it by hand or something goes wrong.

## 1. Create the remote state infrastructure

Use the AWS CLI to manually create the S3 bucket that Terraform will use for state storage. If `privacyready-terraform-state` is globally taken, change it here and in `terraform/versions.tf`.

Note: this backend uses S3's native lockfile locking (`use_lockfile = true` in `versions.tf`, requires Terraform >= 1.10) instead of a DynamoDB lock table, so no DynamoDB table is needed.

```bash
aws s3api create-bucket \
  --bucket privacyready-terraform-state \
  --region eu-west-2 \
  --create-bucket-configuration LocationConstraint=eu-west-2

aws s3api put-bucket-versioning \
  --bucket privacyready-terraform-state \
  --versioning-configuration Status=Enabled
```

## 2. Set required variables

`superadmin_email` has no default on purpose (this repo is public) -- export it before running anything else:

```bash
export TF_VAR_superadmin_email="you@yourdomain.co.uk"
```

## 3. Stand up the environment

```bash
make create ENV=production
```

This runs, in order: `terraform init`, workspace selection, a targeted apply of just the three ECR repositories (`aws_ecr_repository.app/scanner/dsr` -- they must exist before images can be pushed or referenced), a build+push of all three service images, then the full `terraform apply`.

## 4. Post-deployment

```bash
make outputs
```

Update your domain registrar with the `domain_nameservers` output.

## Tearing an environment down

```bash
make destroy ENV=production CONFIRM=yes
```

`CONFIRM=yes` is required -- `make destroy` with no arguments refuses to run, so this can never fire by accident. For a lower-cost partial teardown of the test environment (stops EC2/RDS, destroys just the expensive always-on pieces) use `make teardown-testing` / `make startup-testing` instead, which wrap `scripts/teardown-testing.sh` / `scripts/startup-testing.sh`.
