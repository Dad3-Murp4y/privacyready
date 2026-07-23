# Terraform

Three independent state files, on purpose -- see `docs/production_system_architecture.md` for the full design rationale.

```
persistent/           GitLab, Route53 hosted zone, SES, ACM certs, ECR
                       repos, Transit Gateway, management VPC. Stood up
                       once, essentially never destroyed. See
                       persistent/versions.tf for why this needed its
                       own state: `make destroy ENV=test` or
                       `ENV=production` has no way to reach this state
                       at all, by construction.

modules/               Reusable modules (vpc, rds, elasticache) shared
                       between environments/test and
                       environments/production.

environments/test/     App infrastructure (VPC, RDS, ElastiCache, ECS,
environments/production/  ALB, CloudFront, WAF, monitoring). Safe to
                       fully destroy and recreate -- each is its own
                       state, and neither can reach the other or
                       persistent/.
```

Use the root `Makefile` rather than raw `terraform` commands where possible (`make help`) -- it handles state directory selection, workspace-equivalent environment separation, and keeps local and CI (`.gitlab-ci.yml`) running the exact same commands.

See `docs/BOOTSTRAP.md` for standing this up in a fresh AWS account.
