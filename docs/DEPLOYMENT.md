# Privacy Ready Deployment Guide

## Overview

Privacy Ready staging is rebuilt from the repository with [`rebuild-aws.sh`](../rebuild-aws.sh). The workflow creates only the current staging architecture; it does not create production, legacy test infrastructure, GitLab, management networking, Transit Gateway, Redis, or n8n.

The user-facing endpoints are:

- `https://privacyready.co.uk`: public homepage and anonymous website scanner journey. The rebuild creates the authoritative Route53 zone, but the staging Terraform root does not create a separate apex hosting stack.
- `https://app-staging.privacyready.co.uk`: Terraform-managed Vite single-page application served by CloudFront from a private S3 bucket.
- `https://staging.privacyready.co.uk`: API endpoint served through WAF, a public Application Load Balancer, and private API Fargate tasks.

The browser application calls the API. The API calls a separate private scanner service through Cloud Map. The scanner has no public load balancer or public IP.

## Prerequisites

Run from a clean clone on a Unix-like system with Bash. The script checks the exact requirements before doing work:

- AWS CLI v2 with credentials for the new account
- Terraform 1.10 or newer, required for native S3 lock files
- Git, `jq`, `curl`, `openssl`, `dig`, `sha256sum`, `awk`, `sed`, `grep`, `sort`, `wc`, and `rg`
- a healthy Docker daemon, or Podman as the automatic fallback
- Node.js and npm for the frontend build

The script stops with a concise missing-tool list. It prefers Docker only when `docker version` succeeds; otherwise it selects Podman when `podman info` succeeds.

## AWS Authentication

Set the AWS profile and pin the intended account:

```bash
export AWS_PROFILE=<new-profile>
export AWS_REGION=eu-west-2
export PRIVACYREADY_AWS_ACCOUNT_ID=<new-12-digit-account-id>
aws sts get-caller-identity
```

`rebuild-aws.sh` captures the active account and caller ARN from `aws sts get-caller-identity`. Every AWS mutation rechecks that identity. If `PRIVACYREADY_AWS_ACCOUNT_ID` is set, it must match exactly. Without a pin, an interactive mutation requires the operator to type the active account ID.

AWS account `700951986348` is retired and is unconditionally blocked, even if supplied as `PRIVACYREADY_AWS_ACCOUNT_ID`. Add future retired account IDs to the deny-list array near the top of the script.

The expected region is `eu-west-2`. Another region requires both `AWS_REGION` and `PRIVACYREADY_ALLOW_REGION_OVERRIDE=true`; PostgreSQL availability and other regional dependencies are then checked in that region.

## Initial Setup

```bash
git clone <privacyready-repository-url>
cd privacyready
export AWS_PROFILE=<new-profile>
export PRIVACYREADY_AWS_ACCOUNT_ID=<new-12-digit-account-id>
./rebuild-aws.sh check
```

Image builds require a clean committed tree. The release identifier is the full current Git SHA, not a manually supplied version.

## Secrets

Terraform creates metadata-only AWS Secrets Manager containers. The script generates new cryptographically random values for:

- `JWT_SECRET`
- `SCANNER_API_KEY`

These must be supplied externally when needed:

```bash
export STRIPE_SECRET_KEY=<Stripe-test-secret-key>
export STRIPE_WEBHOOK_SECRET=<Stripe-test-webhook-signing-secret>
export DEMO_ACCOUNT_PASSWORD=<optional-staging-demo-password>
```

Staging accepts only a Stripe secret key with the test prefix. The webhook signing secret is also format-checked. Do not use live Stripe credentials in staging.

Secrets Manager stores the JWT, scanner key, and Stripe values. RDS manages its master password in its own AWS-managed Secrets Manager secret. The script writes new values through standard input without printing them. Existing `AWSCURRENT` versions are preserved on a resumed run. Never commit secrets to Git, Terraform, tfvars, logs, or documentation.

## Terraform Backend Bootstrap

The backend root is [`terraform/bootstrap/backend`](../terraform/bootstrap/backend). It creates `privacyready-terraform-state-<account-id>` with encryption, versioning, public-access blocking, and a policy requiring TLS. Backend, Route53 bootstrap, and staging use separate state keys in that bucket and Terraform's native S3 lock files.

```bash
./rebuild-aws.sh bootstrap
```

This is a fresh state lineage in the new account. Historical state backups are reference material only and must never be migrated, copied, or activated as the new backend. An existing bucket is reused only when its identity, region, and remote bootstrap state are consistent.

## Route53 Bootstrap

The DNS root is [`terraform/bootstrap/route53`](../terraform/bootstrap/route53). Run:

```bash
./rebuild-aws.sh dns
```

It creates or resumes one public hosted zone for `privacyready.co.uk`, retrieves the zone's four authoritative nameservers, and prints them. The nameservers from the deleted old zone are obsolete and must not be reused.

At Names.co.uk, manually replace all four current domain nameservers with the four newly printed Route53 nameservers. The script never signs in to or modifies the registrar. Verify propagation through public resolvers:

```bash
dig +short NS privacyready.co.uk @1.1.1.1
dig +short NS privacyready.co.uk @8.8.8.8
```

Deployment pauses successfully until both sorted resolver results match the new Route53 delegation. Once updated, rerun the previous command or `./rebuild-aws.sh all`.

## Deployment Sequence

`./rebuild-aws.sh all` implements this resumable order:

1. Validate tools, repository layout, static security contracts, Git SHA, AWS identity, and region.
2. Confirm the costs of NAT Gateway, ALB, RDS, Fargate, WAF, and CloudFront.
3. Bootstrap the account-specific S3 backend.
4. Bootstrap the Route53 zone and stop for manual Names.co.uk delegation when required.
5. Apply a narrowly targeted, saved Terraform foundation plan for ECR repositories and empty secret containers.
6. Populate new JWT/scanner values and any supplied Stripe TEST values before ECS can start.
7. Build API and scanner images from a detached worktree at the committed SHA, push them, and verify their ECR digests.
8. Initialize and validate the staging root, confirm the configured PostgreSQL version/class is orderable, and create a saved full plan. Any deletion or replacement is rejected.
9. Confirm Stripe TEST secret versions exist, then apply only the saved plan. This creates the VPC, RDS, ALB/WAF, ECS, ACM, SES, CloudFront, and staging DNS records.
10. Wait with bounded polling for ACM, SES, and CloudFront readiness.
11. Run committed Prisma migrations through a private one-off API task, then optionally bootstrap the demo account through another private task.
12. Build and sync the frontend, invalidate CloudFront, and run infrastructure, DNS, HTTP, scanner, claim-flow, and security verification.

Foundation targeting is used only to resolve the managed ECR/secret dependency. It does not create unmanaged infrastructure or start ECS against missing images or empty application secrets.

## Images

API and scanner images are stored in immutable ECR repositories as:

```text
release-<FULL_GIT_SHA>
```

The operator checkout must be globally clean. The script then creates a detached Git worktree at the exact commit and builds from `services/api` and `services/scanner/cmd/scanner` there, preventing ignored or untracked local files from entering an image. Existing immutable release tags are reused, never overwritten. `:latest` is prohibited in Terraform and runtime verification. After push, the script reports the corresponding ECR digests.

Run the image/foundation phase independently with:

```bash
./rebuild-aws.sh images
```

## Database

Staging uses encrypted, private, single-AZ RDS PostgreSQL with 20 GiB gp3 storage and an AWS-managed master password. Terraform currently configures PostgreSQL 16.14 on `db.t4g.micro`, but the repository remains authoritative.

Before planning and applying, the script asks RDS whether that exact version exists and is orderable for that exact instance class in the selected region. If not, it lists compatible versions and stops. It never silently changes the Terraform version.

Deployment runs committed migrations with:

```text
prisma migrate deploy
```

Do not use `prisma db push` or `prisma migrate reset` against deployed staging. An empty new database must be built entirely from committed migrations; no automatic migration baseline resolver is used.

## API Deployment

The API runs as one Fargate task by default in private application subnets with public IP assignment disabled. The public ALB terminates HTTPS and forwards HTTP on port 8080 to the API target group. HTTP port 80 redirects to HTTPS. Regional WAF protects the ALB.

The API receives `JWT_SECRET`, `SCANNER_API_KEY`, both Stripe secrets, and the JSON `password` field of the RDS-managed master secret through ECS secret injection. It connects privately to PostgreSQL on 5432 and the scanner on 8080. Its task role can send only `ses:SendEmail` and `ses:SendRawEmail` through the Terraform-created staging domain identity, restricted to the configured sender address.

## Scanner Deployment

The scanner runs as one Fargate task by default (`scanner_desired_count = 1`) in private application subnets without a public IP, load balancer, or public DNS record. Cloud Map publishes `scanner.privacyready.local` inside the VPC. The API calls that private hostname on port 8080 and authenticates with `SCANNER_API_KEY`; the scanner receives no other application secret.

Outbound scanner HTTP/HTTPS traffic reaches public websites through the NAT Gateway. Increasing or decreasing scanner desired count changes Fargate cost and availability and must be done through reviewed Terraform.

## Frontend Deployment

The Vite portal is built from [`frontend/portal`](../frontend/portal). The script sets the staging API URL, runs the production npm build, scans the output for forbidden scanner internals, syncs it to the private versioned S3 origin, and creates a CloudFront invalidation.

CloudFront serves `app-staging.privacyready.co.uk` with an ACM certificate in `us-east-1`. Origin Access Control signs origin requests. All S3 public-access-block settings are enabled, object ownership is bucket-enforced, and the bucket policy grants read access only to that CloudFront distribution. CloudFront maps 403/404 origin responses to `index.html` so SPA routes such as `/login` work.

## Demo Account

When `DEMO_ACCOUNT_PASSWORD` is present, deployment runs the guarded private staging bootstrap for:

- account: `demo@privacyready.co.uk`
- organisation: `DQVentures`
- role: `ADMIN`, never superadmin

The application performs normal bcrypt hashing and verifies only this explicit staging account. The task sets `NODE_ENV=staging` and the explicit staging bootstrap guard. No public bootstrap endpoint exists. If the variable is absent, the phase is clearly skipped.

## Verification

```bash
./rebuild-aws.sh verify
```

Verification checks AWS identity/region; RDS status and privacy; ECS desired/running counts and public-IP settings; target health; exact image tags and secret injection; execution-role secret scopes; Cloud Map; ACM, SES, CloudFront, WAF, Route53, and frontend S3/OAC; DNS delegation and records; API health and redirects; SPA delivery and CORS; scanner unit and live SSRF/rate-limit behavior; and the public scan/claim contract.

Deployment sign-off:

- [ ] Correct non-retired account and expected region
- [ ] Public NS delegation matches the new hosted zone at 1.1.1.1 and 8.8.8.8
- [ ] Saved Terraform plan contains zero deletes and zero replacements
- [ ] Exact release-tagged ECR images and digests exist
- [ ] RDS is available, encrypted, private, and migrations succeeded
- [ ] API and scanner desired tasks are running and API targets are healthy
- [ ] ACM, SES, CloudFront, WAF, and Route53 checks pass
- [ ] API `/health`, frontend root, and SPA login return successfully
- [ ] Scanner security and anonymous claim-flow checks pass
- [ ] Optional demo account bootstrap status is understood

## Complete Deployment Example

```bash
export AWS_PROFILE=<new-profile>
export PRIVACYREADY_AWS_ACCOUNT_ID=<new-account-id>
export STRIPE_SECRET_KEY=<Stripe-test-secret-key>
export STRIPE_WEBHOOK_SECRET=<Stripe-test-webhook-signing-secret>

./rebuild-aws.sh check
./rebuild-aws.sh all
```

The first `all` normally stops after printing `ACTION REQUIRED AT NAMES.CO.UK` and the four new nameservers. Replace the registrar delegation manually and wait for public propagation. Then resume safely:

```bash
./rebuild-aws.sh all
```

Completed bootstrap, foundation, secret, and immutable-image work is discovered from Terraform and AWS rather than recreated.
