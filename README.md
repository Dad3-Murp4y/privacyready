# Privacy Ready

Privacy Ready is a UK GDPR compliance platform for small and mid-sized businesses. It provides website compliance scanning, consent-management support, data-subject-request workflows, team administration, and staging billing integration.

## Repository layout

```text
frontend/portal/                    React/Vite browser application and public homepage
services/api/                       Fastify API, Prisma schema/migrations, and demo bootstrap
services/scanner/cmd/scanner/       Private website scanner service
terraform/bootstrap/backend/       New-account Terraform state backend
terraform/bootstrap/route53/       Public hosted-zone bootstrap
terraform/environments/staging/    Current deployable AWS staging environment
terraform/modules/                 Reusable modules used by staging
rebuild-aws.sh                      Guarded staging rebuild and operations workflow
docs/DEPLOYMENT.md                  Clean-account deployment procedure
docs/ARCHITECTURE.md                Current AWS/application/security architecture
docs/RUNBOOK.md                     Operations, troubleshooting, recovery, and shutdown
```

Only the current staging environment is deployable. Retired production, test, persistent GitLab/management, Transit Gateway, Redis, and n8n Terraform configurations are intentionally absent from the active repository tree.

## Local development

API:

```bash
cd services/api
npm ci
npx prisma generate
npm run dev
```

Frontend:

```bash
cd frontend/portal
npm ci
npm run dev
```

Scanner tests:

```bash
python3 -m unittest discover -s services/scanner/cmd/scanner/tests -v
```

## AWS staging workflow

AWS work is controlled by [`rebuild-aws.sh`](rebuild-aws.sh). It rejects retired AWS account `700951986348`, requires reviewed saved Terraform plans, prohibits mutable release images, and never modifies Names.co.uk.

```bash
export AWS_PROFILE=<new-account-profile>
export PRIVACYREADY_AWS_ACCOUNT_ID=<new-account-id>

./rebuild-aws.sh check
./rebuild-aws.sh all
```

The first complete run pauses when the new Route53 nameservers must be entered manually at Names.co.uk. See [the deployment guide](docs/DEPLOYMENT.md) before running any mutating command.

## Operations documentation

- [Deployment guide](docs/DEPLOYMENT.md)
- [AWS architecture](docs/ARCHITECTURE.md)
- [Operations runbook](docs/RUNBOOK.md)

The root Makefile is a thin convenience wrapper around `rebuild-aws.sh` and local validation commands. It does not provide an alternative deployment implementation.
