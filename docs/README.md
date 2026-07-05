# DataWai scaffold output

This project is an expanded **starter scaffold** for a DataWai-style platform. It provides validated starter services, richer operational templates, and CI placeholders while still clearly marking non-production areas as stubs.

## Included

- Root config and local development Docker Compose.
- Fastify API scaffold with health and consent routes.
- FastAPI DSR service scaffold.
- Go scanner scaffold.
- Terraform, Helm, Kubernetes, OPA, and monitoring starter templates.
- CI workflow skeleton for lint and validation.
- Utility scripts for setup, deploy, shutdown, restore, and guarded kill switch placeholders.

## Still stubbed

- Real cloud resources.
- Production-ready CI/CD secrets and deployment credentials.
- Full PDPA scanning, consent storage, and audit trails.
- Production-safe destructive workflows.

## Quick start

```bash
cp .env.example .env
bash scripts/setup-local.sh
```

## Validation

See `docs/validation-report.md`.
