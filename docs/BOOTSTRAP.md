# Bootstrapping a New AWS Account

Steps to stand up PrivacyReady's infrastructure in a fresh AWS account. Two phases: **persistent** (once, essentially never repeated) and **app environment** (as many times as you like, in either order, independently).

## 1. Create the remote state infrastructure

All three Terraform states (`persistent`, `environments/test`, `environments/production`) share one S3 bucket with different keys. Create it once:

```bash
aws s3api create-bucket \
  --bucket privacyready-terraform-state \
  --region eu-west-2 \
  --create-bucket-configuration LocationConstraint=eu-west-2

aws s3api put-bucket-versioning \
  --bucket privacyready-terraform-state \
  --versioning-configuration Status=Enabled
```

This uses S3's native lockfile locking (`use_lockfile = true`, Terraform >= 1.10) rather than a DynamoDB lock table -- no DynamoDB table needed.

## 2. Set required variables

`superadmin_email` (used by the production environment) has no default on purpose -- this repo is public:

```bash
export TF_VAR_superadmin_email="you@yourdomain.co.uk"
```

## 3. Stand up the persistent layer (once)

```bash
make persistent-apply
```

This creates the Route53 hosted zone, requests the SES domain identity, issues the ACM certificates, creates the three ECR repositories, stands up the Transit Gateway + management VPC, and deploys GitLab (with its own dedicated RDS and ALB -- see `terraform/persistent/gitlab.tf` for why that matters). Update your domain registrar's nameservers with the output:

```bash
make persistent-outputs
```

## 4. Stand up an app environment

```bash
make create ENV=production
# or
make create ENV=test
```

This builds and pushes all three service images to the ECR repos from step 3, then applies the environment's VPC/RDS/ElastiCache/ECS/ALB/CloudFront/WAF. `test` and `production` are fully independent -- you can create, destroy, or recreate either without touching the other or the persistent layer.

## Tearing an app environment down

```bash
make destroy ENV=test CONFIRM=yes
```

`CONFIRM=yes` is required -- `make destroy` with no arguments refuses to run. This only ever touches `terraform/environments/<env>`'s own state; it has no reference to `terraform/persistent` and cannot reach GitLab, DNS, SES, or the ECR repos even by mistake.

For a lower-cost partial teardown of the test environment (stop EC2/RDS without a full destroy), use `make teardown-testing` / `make startup-testing` instead.

## Tearing the persistent layer down

You almost never want this -- it takes GitLab, your DNS zone, and your SES domain verification down with it.

```bash
make persistent-destroy CONFIRM=yes
```
