# Privacy Ready Operations Runbook

## Quick Reference

Run all commands from the repository root:

| Command | Purpose |
| --- | --- |
| `./rebuild-aws.sh check` | Validate tools, repository contracts, Git, AWS identity, account, and region |
| `./rebuild-aws.sh bootstrap` | Create or resume the account-specific Terraform backend |
| `./rebuild-aws.sh dns` | Create/resume Route53 and check public registrar delegation |
| `./rebuild-aws.sh images` | Apply ECR/secret foundation, populate available secrets, build and push immutable images |
| `./rebuild-aws.sh plan` | Validate and save a staging plan; reject deletes and replacements |
| `./rebuild-aws.sh deploy` | Apply only the matching saved plan, migrate, and optionally bootstrap the demo account |
| `./rebuild-aws.sh frontend` | Build/sync the SPA and invalidate CloudFront |
| `./rebuild-aws.sh verify` | Run read-only infrastructure, DNS, HTTP, scanner, claim, and security checks |
| `./rebuild-aws.sh recover` | Back up and inspect state/drift without mutating AWS |
| `./rebuild-aws.sh destroy` | Destroy Terraform-managed staging after typed confirmation; preserve backend and hosted zone |
| `./rebuild-aws.sh all` | Run the complete resumable staging rebuild |

Use `./rebuild-aws.sh help` for the authoritative command and environment list.

## Health Checks

First establish the intended identity and region:

```bash
aws sts get-caller-identity
aws configure get region
./rebuild-aws.sh check
```

Prefer `./rebuild-aws.sh verify` for a complete read-only assessment. For focused diagnosis, obtain current identifiers from Terraform outputs rather than guessing names:

```bash
terraform -chdir=terraform/environments/staging state list
terraform -chdir=terraform/environments/staging output
```

Safe AWS checks include:

```bash
aws ecs describe-services --cluster <cluster> --services <api-service> <scanner-service>
aws rds describe-db-instances --db-instance-identifier <rds-id>
aws elbv2 describe-target-health --target-group-arn <api-target-group-arn>
aws cloudfront get-distribution --id <distribution-id>
aws route53 list-resource-record-sets --hosted-zone-id <zone-id>
aws acm describe-certificate --certificate-arn <certificate-arn>
aws sesv2 get-email-identity --email-identity staging.privacyready.co.uk
aws wafv2 get-web-acl --scope REGIONAL --id <web-acl-id> --name <web-acl-name>
curl -fsS https://staging.privacyready.co.uk/health
```

For ECS, compare `desiredCount`, `runningCount`, `pendingCount`, deployment events, task definitions, and service registries. For DNS, always compare authoritative delegation using public resolvers.

## Normal Deployment

For a new release:

1. Commit all intended source and ensure `git status --porcelain --untracked-files=all` is empty.
2. Record `git rev-parse HEAD`; that full SHA becomes the immutable release tag.
3. Export the new-account profile/account pin and required Stripe TEST environment variables.
4. Run `./rebuild-aws.sh images`. It builds in a detached worktree, pushes both images, and verifies digests.
5. Run `./rebuild-aws.sh plan`; review the saved plan output. Deletes or replacements are rejected automatically.
6. Run `./rebuild-aws.sh deploy`; it applies only the saved plan, waits for dependencies, runs `prisma migrate deploy`, and optionally bootstraps the demo account.
7. Run `./rebuild-aws.sh frontend`.
8. Run `./rebuild-aws.sh verify` and complete the checklists below.

`./rebuild-aws.sh all` performs the same dependency-aware sequence for a clean or partially completed rebuild.

## Terraform Recovery

After an interrupted or failed apply, do not infer state from the last displayed resource count and do not immediately rerun plan/apply. The script leaves an apply-guard file and requires:

```bash
./rebuild-aws.sh recover
```

Recovery:

1. verifies AWS identity and the backend
2. pulls a timestamped local state backup under `.rebuild-logs/state-backups/`
3. verifies the backup is readable, checksummed, and scoped to the active account/staging
4. records `terraform state list`
5. creates but does not apply `terraform plan -refresh-only -lock=false`
6. compares tag-discoverable staging AWS ARNs with resources represented in state
7. writes drift and AWS/state comparison reports and recommends a next action

Inspect `drift.tsv`, `aws-and-state-arns.txt`, and `aws-not-in-state-arns.txt` in the reported recovery directory. An AWS resource missing from state may require a reviewed `terraform import` only after ownership, address, configuration, and provider account are proven. A state object whose remote resource is genuinely gone may require `terraform state rm` only after its absence and desired configuration are proven. Neither is a first response, and recovery never performs either automatically.

Rerun `recover` until its assessment is clean. Only then resume with `plan`.

## Failed ECS Deployment

Investigate in this order:

1. `describe-services`: desired, running, pending, deployment rollout state, and recent events.
2. `list-tasks --desired-status STOPPED` and `describe-tasks`: stopped reason, container reason, exit code, and network attachment.
3. CloudWatch log streams under `/ecs/privacyready-staging-api` or `/ecs/privacyready-staging-scanner`.
4. ECR `describe-images`: exact `release-<full-sha>` tag and digest exist; task definition has no `:latest`.
5. Execution role: ECR, logs, and exact Secrets Manager ARN permissions.
6. Secret containers: an `AWSCURRENT` version exists; inspect metadata/version stages, not secret values.
7. Subnets, NAT route, DNS, security groups, and `assignPublicIp=DISABLED`.
8. ALB target health and the container's port 8080 health endpoint.
9. API startup and RDS connectivity/migration logs.

Do not weaken IAM, make a task public, or replace immutable tags to force a deployment through.

## Secret Failure

Typical symptoms are an ECS `ResourceInitializationError`, repeated stopped tasks, startup validation errors, scanner 401 responses, login/token failures, Stripe endpoint errors, or database authentication failures.

- JWT failure: confirm the JWT secret container has one `AWSCURRENT` version and that the API task definition injects `JWT_SECRET`.
- Scanner-key failure: confirm the same scanner-key secret ARN is injected as `SCANNER_API_KEY` into both tasks, then redeploy both tasks together after rotation.
- Stripe failure: confirm both TEST secret containers have `AWSCURRENT`; rerun `images` with test credentials if they are empty.
- RDS secret failure: confirm RDS manages the master secret, the API reference ends with `:password::`, and the execution role includes that exact ARN.

Use `aws secretsmanager describe-secret` and `list-secret-version-ids` to inspect metadata and version stages. Do not retrieve or print secret values during routine diagnosis. After changing a secret, force a reviewed new ECS deployment because running tasks do not reload secret values.

## RDS Failure

Reproduce migration and Prisma behavior locally before diagnosing RDS-specific causes:

```bash
cd services/api
npm run test:integration
```

This creates a disposable PostgreSQL 16 container, migrates a genuinely empty database, runs persistence/claim/tenant/constraint coverage, and deletes it. Docker is preferred and Podman is the fallback. An unavailable container engine is reported as an unrun suite, never a pass.

Check:

```bash
aws rds describe-db-instances --db-instance-identifier <rds-id>
aws rds describe-db-engine-versions --engine postgres --engine-version <configured-version>
aws rds describe-orderable-db-instance-options --engine postgres --engine-version <configured-version> --db-instance-class <configured-class>
```

Confirm the instance is available, private, encrypted, in the expected DB subnet group, and attached only to the RDS SG. Confirm API-to-RDS TCP 5432 rules in both directions of the SG relationship and review API startup logs.

A previous deployment configured PostgreSQL 16.4 when that version was unavailable in the target region. The safe response is not automatic substitution: inspect orderable versions, deliberately update `database_engine_version` in Terraform, review the plan, and deploy. The current default is PostgreSQL 16.14 with `db.t4g.micro`, and the script checks that exact combination before plan/apply.

## Prisma Migration Failure

The deployment mechanism is committed `prisma migrate deploy` executed in a private one-off API task. On failure:

1. preserve the database and migration logs
2. verify database connectivity and credentials
3. inspect committed directories under `services/api/prisma/migrations`
4. use Prisma's read-only/status tooling from an approved private execution path to understand applied and pending migrations
5. fix or add a forward migration in source, test against a fresh database, and redeploy

Never use `prisma db push` or `prisma migrate reset` against deployed staging. Do not automatically mark a baseline as applied with `prisma migrate resolve`; any exceptional manual resolution requires an independently reviewed recovery plan and database backup.

## Scanner Failure

Check the scanner service desired/running counts, stopped reasons, and `/ecs/privacyready-staging-scanner` logs. Then verify:

- `assignPublicIp` is disabled and no load balancer is attached
- the Cloud Map service registry exists and `scanner.privacyready.local` resolves inside an API task
- API SG egress and scanner SG ingress allow only TCP 8080 between those SGs
- both tasks reference the same scanner-key secret with `AWSCURRENT`
- scanner outbound SG permits only HTTP/HTTPS and private subnet routing reaches the NAT Gateway
- the requested target is a public HTTP/HTTPS URL

Rejections of localhost, private/link-local/metadata addresses, IPv6 loopback, embedded credentials, protected/internal hostnames, unsafe redirects, excessive redirects, DNS-rebinding attempts, and oversized responses are expected security behavior, not availability failures.

## ALB / 502 / 503

1. Run `aws elbv2 describe-target-health` for the API target group.
2. Confirm API service running count and task health.
3. Check HTTPS listener certificate/forward action and HTTP listener redirect action.
4. Confirm ALB egress to API SG and API ingress from ALB SG on TCP 8080.
5. Confirm the task definition/container maps and listens on port 8080.
6. Call `/health` from an appropriate network path and inspect application logs.
7. If startup fails, continue with secret and database checks rather than changing the target-group health matcher blindly.

## DNS Failure

```bash
dig NS privacyready.co.uk
dig +short NS privacyready.co.uk @1.1.1.1
dig +short NS privacyready.co.uk @8.8.8.8
dig +short staging.privacyready.co.uk @1.1.1.1
dig +short app-staging.privacyready.co.uk @1.1.1.1
```

Names.co.uk controls registrar delegation to four Route53 nameservers. Route53 then controls hosted-zone records. A correct A/alias record cannot work while delegation still points to an obsolete zone. Run `./rebuild-aws.sh dns` to print the new zone's nameservers; update Names.co.uk manually and wait until both public resolvers agree.

## ACM Failure

Inspect `Status`, `DomainValidationOptions`, and the DNS validation record with `aws acm describe-certificate`. API/ALB certificates are regional; the CloudFront viewer certificate is in `us-east-1`. Confirm the validation CNAME exists in the active hosted zone and public delegation reaches that zone. DNS validation may take time; the script polls at bounded intervals and reports the last status rather than waiting forever.

## SES Failure

Inspect the `notify.privacyready.co.uk` identity and DKIM status with SES v2. Confirm the three generated DKIM CNAMEs resolve, `mail.notify.privacyready.co.uk` has the SES feedback MX and exactly one SES SPF TXT record, delegation has propagated, and the sender is `no-reply@notify.privacyready.co.uk`. The API task role must allow only `ses:SendEmail`/`ses:SendRawEmail` on that identity with the matching `ses:FromAddress` condition.

Check `aws sesv2 get-account` for production access. In sandbox, only verified recipients can receive mail; request production access manually rather than claiming email is operational or broadening IAM. Review bounce/suppression data before retrying. Automated messages currently have no explicit Reply-To; replies are not silently redirected to support.

If human mail stops after Route53 migration, inspect `dig MX privacyready.co.uk` through `1.1.1.1` and `8.8.8.8`, then compare the answers and all mail TXT/CNAME records with the current Names.co.uk mail-hosting values. Never substitute SES MX records at the apex. Multiple SPF TXT records at one hostname are invalid: keep the Names.co.uk policy at the apex and the SES policy at `mail.notify`. Names.co.uk and SES DKIM selectors are also separate. For DMARC failures, keep `p=none` while validating alignment and reports; move to quarantine/reject only through a reviewed policy change.

## Frontend Failure

1. Run the production build locally and confirm `frontend/portal/dist/index.html` and assets exist.
2. Confirm objects were synced to the Terraform output bucket.
3. Verify all four S3 public-access-block settings, bucket ownership, and the exact CloudFront-only bucket policy.
4. Confirm CloudFront origin uses OAC and the distribution is deployed.
5. Inspect invalidation status and invalidate `/*` again only after a real asset change.
6. Test `/` and `/login`; both should return the SPA.
7. Confirm `VITE_API_URL` points to `https://staging.privacyready.co.uk` and API CORS permits only the intended staging frontend in production runtime.

Do not make the S3 bucket public to repair an OAC or policy error.

## Stripe TEST Failure

Confirm `STRIPE_SECRET_KEY` is present and begins with the test prefix, `STRIPE_WEBHOOK_SECRET` is present with the expected signing-secret prefix, and both Secrets Manager containers have `AWSCURRENT`. Check the staging webhook endpoint configuration and API logs for signature-verification failures. Test only with Stripe's test mode and test events. Never use live Stripe credentials or create a real charge in staging.

## Demo Account

Set `DEMO_ACCOUNT_PASSWORD` only in the operator environment, then run `deploy` as part of a reviewed staging release. The private bootstrap must report the expected account `demo@privacyready.co.uk`, organisation `DQVentures`, verified status, and `ADMIN` role. It refuses non-staging execution and requires the explicit staging guard. Never print the password or place it in Terraform, shell history, source, or logs.

## Security Incident / Suspected Secret Exposure

1. Identify the exposed staging secret and affected services without reproducing it in tickets or logs.
2. Generate/obtain a replacement through the approved source and write a new Secrets Manager version securely.
3. Redeploy or restart every affected ECS service so new tasks load the version; rotate both API and scanner together for the shared scanner key.
4. Revoke an exposed Stripe TEST key in Stripe and update the staging secret. Never substitute a live key.
5. Inspect CloudTrail, CloudWatch application logs, ALB/WAF observations, and Stripe test events for misuse while minimizing further secret exposure.
6. Remove any committed credential from current source and history through the repository's incident process; do not merely commit a replacement.
7. Run `verify` and document the rotation time and affected task-definition revisions without documenting values.

## Cost Checks

Prioritize resources with continuous charges:

```bash
aws ec2 describe-nat-gateways --filter Name=state,Values=available,pending
aws elbv2 describe-load-balancers
aws rds describe-db-instances
aws ecs list-clusters
aws ecs list-services --cluster <cluster>
aws wafv2 list-web-acls --scope REGIONAL
aws cloudfront list-distributions
```

Use tags `Project=privacyready` and `Environment=staging`, Terraform state, and AWS Cost Explorer to establish ownership. NAT Gateway is commonly the largest idle staging network cost, followed by ALB, RDS, and running Fargate tasks; WAF also has a recurring component. Do not delete name-matched resources when ownership is ambiguous.

## Shutdown

```bash
./rebuild-aws.sh destroy
```

The command verifies the non-retired account and staging state scope, creates and verifies a timestamped local state backup, generates a saved destroy plan, displays every planned deletion and the total, rejects create/update actions, and requires typing `DESTROY STAGING <account-id>`. It applies only that saved plan and then reports remaining potentially chargeable resources.

It removes the Terraform-managed staging runtime, including ECR images/repositories and the versioned frontend bucket. It deliberately preserves the account-specific Terraform backend and the separately managed `privacyready.co.uk` Route53 hosted zone. It never modifies Names.co.uk. There is no `destroy --all` command; absolute teardown requires a separate, specifically reviewed procedure.

## Rebuild After Shutdown

With backend and Route53 preserved:

```bash
export AWS_PROFILE=<new-profile>
export PRIVACYREADY_AWS_ACCOUNT_ID=<new-account-id>
export STRIPE_SECRET_KEY=<Stripe-test-secret-key>
export STRIPE_WEBHOOK_SECRET=<Stripe-test-webhook-signing-secret>
./rebuild-aws.sh check
./rebuild-aws.sh all
```

If public delegation still matches the preserved zone, the DNS gate passes immediately. The script recreates foundation resources, generates new JWT/scanner values, populates supplied Stripe TEST values, builds the committed release, and resumes through verification.

## Old Account Protection

AWS account `700951986348` is retired. `rebuild-aws.sh` must refuse all use of it, including when it is intentionally supplied as `PRIVACYREADY_AWS_ACCOUNT_ID`. Do not remove or bypass this deny-list entry.

## Emergency Rules

NEVER:

- run a blind `terraform destroy`
- apply an unreviewed or unsaved Terraform plan
- deploy an image tagged `:latest`
- print, retrieve unnecessarily, log, or commit secret values
- make RDS publicly accessible
- give API or scanner tasks public IPs
- attach a public load balancer to the scanner
- disable SSRF controls to make scanning work
- use `prisma db push` or `prisma migrate reset` against deployed staging
- use production Stripe credentials in staging
- deploy into the retired AWS account

## Operational Checklist

### Deployment checklist

- [ ] Correct AWS profile, account pin, caller ARN, and region
- [ ] Clean committed release source and recorded full Git SHA
- [ ] Stripe TEST variables supplied; optional demo-password handling decided
- [ ] Backend and DNS state are fresh/current and delegation passes
- [ ] Cost warning accepted
- [ ] Saved plan reviewed with zero deletes/replacements
- [ ] Immutable API/scanner image digests verified

### Post-deployment checklist

- [ ] `./rebuild-aws.sh verify` passes
- [ ] RDS available/private/encrypted and migrations complete
- [ ] API/scanner running counts match desired counts
- [ ] ALB targets healthy; API health and redirect succeed
- [ ] Frontend root and SPA login route succeed
- [ ] ACM, SES, WAF, Route53, CloudFront, S3/OAC checks pass
- [ ] Scanner security/rate-limit and anonymous claim checks pass
- [ ] Costs and alarms reviewed

### Shutdown checklist

- [ ] Confirm staging ownership and correct non-retired account
- [ ] Run `destroy`, review every resource, and type the exact confirmation
- [ ] Preserve and verify the reported local state backup
- [ ] Review remaining NAT, ALB, RDS, ECS, ECR, S3, CloudFront, and WAF inventory
- [ ] Confirm backend and Route53 preservation is intended

### Recovery checklist

- [ ] Stop normal plan/apply after interruption
- [ ] Run `recover` and preserve its state backup/checksum
- [ ] Review state list, refresh-only plan, drift, and AWS/state reports
- [ ] Establish ownership before any import or state removal
- [ ] Rerun recovery until clean, then resume with a saved normal plan
