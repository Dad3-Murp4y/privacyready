# PrivacyReady

A UK GDPR compliance platform for small and mid-sized businesses. Automated website compliance scanning, consent management, and data subject rights (DSR) workflows -- without needing a full-time Data Protection Officer.

> This platform is UK-only, deployed entirely in AWS `eu-west-2` (London) for UK data residency. A separate product (DataWai) covers Thailand PDPA compliance with its own AWS account and infrastructure -- the two are not related and should not be merged.

## Repo layout

```
frontend/           Static marketing site (privacyready.co.uk) -- plain HTML/CSS/JS, no build step
frontend/portal/    React dashboard app (portal.privacyready.co.uk)
services/api/       Node.js/Fastify core API -- auth, scans, DSRs, team/admin management
services/scanner/   Python/FastAPI website + social compliance scanners
services/dsr/       Python/FastAPI DSR service (currently a stateless scaffold -- see PR_SUMMARY.md)
services/consent/   Reserved for a future standalone consent service (consent logic currently lives in services/api)
services/builder/   Reserved for future use
terraform/          All AWS infrastructure (see below)
scripts/            Operational scripts (teardown/startup, GitLab runner, bucket cleanup)
docs/               Architecture docs, audits, bootstrap guide
Makefile            Wraps the full Terraform + Docker/ECR lifecycle -- `make help`
.gitlab-ci.yml       CI/CD pipeline (GitLab is this project's CI system)
```

## Getting started

**Backend (API)**
```bash
cd services/api
npm install
npx prisma generate
npm run dev
```

**Frontend (portal)**
```bash
cd frontend/portal
npm install
npm run dev
```

**Marketing site**: `frontend/index.html` and friends are plain static files -- open directly or serve with any static file server.

## Infrastructure

Everything runs on AWS, managed by Terraform. Three independent state files: `terraform/persistent` (GitLab, DNS, SES, ACM, ECR -- stood up once, essentially never destroyed), and `terraform/environments/{test,production}` (VPC, RDS, ECS, ALB, CloudFront -- fully disposable, each destroy/recreate has no way to reach the other environment or the persistent layer). See `terraform/README.md` for the full layout and `terraform/modules/` for the shared vpc/rds/elasticache modules. See:

- **`docs/BOOTSTRAP.md`** -- standing up infrastructure in a fresh AWS account
- **`docs/production_system_architecture.md`** -- architecture diagrams and specifications
- **`Makefile`** -- `make create ENV=production` / `make destroy ENV=production CONFIRM=yes` and everything in between; the GitLab pipeline calls these same targets, so local and CI never diverge

## Admin access

There's no hardcoded admin account. Set `TF_VAR_superadmin_email` before running Terraform, then register a normal account with that exact email -- it gets `SUPERADMIN` automatically. See `docs/BOOTSTRAP.md`.

## Current status / known gaps

`PR_SUMMARY.md` at the repo root tracks what's been fixed recently and what's still open -- worth checking before assuming something is or isn't implemented.
