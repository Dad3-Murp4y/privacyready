# PrivacyReady — Infrastructure & Code Audit Findings

Compiled from this session's work: issues found (and in most cases already fixed) while reviewing and modifying the codebase and Terraform. This is not a from-scratch audit against every item in the original request — it's an honest accounting of what was actually found and verified, plus a clearly marked list of requested areas that were **not** checked this session, so this report doesn't overclaim coverage.

**Status key**: 🔴 Open · 🟢 Fixed this session · 🟡 Partially addressed

---

## Critical

### C1. Hardcoded JWT signing secret fallback
- **Status**: 🟢 Fixed
- **Category**: Security
- **Issue**: `services/api/src/main.ts` fell back to a hardcoded string (`'super_secret_for_local_dev_only_1234'`) if `JWT_SECRET` was unset, and that fallback was committed to what is now a public repo.
- **Impact**: Anyone could forge valid auth tokens for any user if the env var was ever unset in production.
- **Remediation**: App now fails to start if `JWT_SECRET` is unset (no fallback). `JWT_SECRET` is provisioned via AWS Secrets Manager and injected into the ECS task.
- **Pillar**: Security

### C2. Hardcoded superadmin bootstrap email in a public repo
- **Status**: 🟢 Fixed
- **Category**: Security / Governance
- **Issue**: `all.privacyready@gmail.com` was hardcoded in `auth.ts` as the email that automatically receives `SUPERADMIN` on registration.
- **Impact**: With the repo public, anyone could read this and register that exact address (if not already claimed) to get full platform admin access — every user, org, and scan.
- **Remediation**: Replaced with `SUPERADMIN_EMAIL`, sourced from a required (no-default) Terraform variable, never committed. Platform admin promotion is now handled through a real admin UI (promote/demote any user) rather than a single bootstrap email being the only path.
- **Pillar**: Security

### C3. Empty database password fallback on container startup
- **Status**: 🟢 Fixed
- **Category**: Security / Reliability
- **Issue**: `start.sh` built `DATABASE_URL` with no validation that `DB_PASSWORD` was actually set — an unset var would silently produce a connection string with a blank password.
- **Impact**: Silent failure mode; also a credential-handling anti-pattern.
- **Remediation**: `start.sh` now fails fast (`: "${DB_PASSWORD:?...}"`) if required secrets are missing.
- **Pillar**: Reliability

### C4. No GuardDuty, CloudTrail, or Security Hub anywhere in the account
- **Status**: 🔴 Open
- **Category**: Security
- **Issue**: Verified via `grep` across the entire Terraform estate — none of GuardDuty, CloudTrail, or Security Hub are provisioned.
- **Impact**: No audit trail of API calls made against the AWS account, no automated threat detection, no centralized security findings aggregation. If the account is ever compromised, there's no way to reconstruct what happened.
- **Remediation**: Add to `terraform/persistent/` (account-level, not per-environment):
  ```hcl
  resource "aws_cloudtrail" "main" {
    name                          = "privacyready-trail"
    s3_bucket_name                = aws_s3_bucket.cloudtrail.id
    include_global_service_events = true
    is_multi_region_trail         = true
    enable_log_file_validation    = true
  }

  resource "aws_guardduty_detector" "main" {
    enable = true
  }

  resource "aws_securityhub_account" "main" {}
  ```
- **Pillar**: Security

### C5. CI/CD uses long-lived IAM access keys, not OIDC
- **Status**: 🔴 Open
- **Category**: Security
- **Issue**: `terraform/persistent/iam_cicd.tf` creates an `aws_iam_user` (`gitlab-ci-deployer`) with a static `aws_iam_access_key`, stored in Secrets Manager and presumably copied into GitLab CI/CD variables. Requested audit scope explicitly calls out OIDC over long-lived credentials.
- **Impact**: Long-lived credentials are a standing risk — if leaked (e.g. via a misconfigured job, a compromised runner, or logged output), they're valid indefinitely until manually rotated. GitLab supports OIDC federation with AWS (`sts:AssumeRoleWithWebIdentity`), which issues short-lived tokens per pipeline run instead.
- **Remediation**: Replace the IAM user + access key with an OIDC identity provider trusting GitLab's token issuer, and an IAM role the CI job assumes:
  ```hcl
  resource "aws_iam_openid_connect_provider" "gitlab" {
    url             = "https://gitlab.privacyready.co.uk"
    client_id_list  = ["https://gitlab.privacyready.co.uk"]
    thumbprint_list = [...]
  }
  ```
  Then scope the trust policy to your specific project path, not just "any GitLab job."
- **Pillar**: Security

---

## High

### H1. `terraform db push --accept-data-loss` on every container boot
- **Status**: 🟢 Fixed
- **Category**: Reliability
- **Issue**: `start.sh` ran `prisma db push --accept-data-loss` on every startup — could silently drop columns/data on schema drift, with no confirmation.
- **Impact**: Data loss risk on any deploy where the schema changed in a way Prisma interprets as destructive.
- **Remediation**: Changed to `prisma db push` without the flag (still applies safe changes automatically, but refuses and fails loudly on destructive ones). Documented the path to real migration history (`prisma migrate dev` → commit `prisma/migrations/` → switch to `migrate deploy`) since none exists yet.
- **Pillar**: Reliability

### H2. GitLab's data lived inside the app's shared RDS instance
- **Status**: 🟢 Fixed
- **Category**: Reliability
- **Issue**: GitLab's database was a schema created inside the same Postgres instance as the application (explicit comment in the old `gitlab.tf`: "Dedicated GitLab DB resources removed to support hosting on shared database").
- **Impact**: Destroying/recreating the app environment's RDS — a normal, intended operation for a disposable test/prod environment — would silently wipe GitLab's entire history: repos' metadata, CI config, issues, merge requests.
- **Remediation**: GitLab now has its own dedicated RDS instance (`terraform/persistent/gitlab_rds.tf`), living in the persistent state layer that the app environments cannot reach.
- **Pillar**: Reliability

### H3. GitLab's public URL routed through the app environment's own ALB
- **Status**: 🟢 Fixed
- **Category**: Reliability
- **Issue**: `gitlab.privacyready.co.uk` was served via a target group attachment + listener rule on the *application's* load balancer.
- **Impact**: Destroying the app environment's ALB (again, a normal operation) would take GitLab's public access down with it, independent of whether the GitLab server itself was still running.
- **Remediation**: GitLab now has its own dedicated ALB in the persistent layer, reusing the wildcard ACM certificate already issued for the domain.
- **Pillar**: Reliability

### H4. Referenced GitLab-preservation scripts don't exist
- **Status**: 🟢 Fixed (root cause addressed differently)
- **Category**: Operational Excellence
- **Issue**: Comments in the original `gitlab.tf`/`gitlab_runner.tf` referenced `scripts/pre-destroy.sh` and `scripts/post-import.sh` as the mechanism for GitLab surviving infrastructure changes. Neither file exists anywhere in the repository, despite a prior commit message claiming this was implemented.
- **Impact**: The documented safety mechanism for a critical piece of infrastructure (your CI/CD server) never actually existed. Anyone destroying/recreating infrastructure believing GitLab was protected would have been wrong.
- **Remediation**: Rather than building the referenced scripts, solved the underlying problem architecturally — GitLab now lives in a Terraform state that the app environments cannot reach at all (see H2/H3), which is more robust than a script-based safety net.
- **Pillar**: Operational Excellence

### H5. Overly broad WAF geo-block on a UK B2B product
- **Status**: 🟢 Fixed
- **Category**: Reliability / (business impact, not a standard pillar, but worth noting)
- **Issue**: A WAF rule named `GeoBlockNonThailand` allowed traffic *only* from Thailand, UK, Singapore, and the US — blocking every other country by default. This was leftover configuration from a different product (DataWai, a Thailand-market compliance tool) copy-pasted into this UK-focused SaaS.
- **Impact**: Legitimate prospects and customers from anywhere outside those 4 countries would have been silently blocked from reaching the site at all — a direct, ongoing business cost, not just a technical one.
- **Remediation**: Removed the geo-block; kept the rate-limiting and bot-control WAF rules for actual abuse protection.
- **Pillar**: Reliability

### H6. Extensive DataWai/Thailand cross-contamination across code, docs, and CI config
- **Status**: 🟢 Fixed
- **Category**: Governance / Maintainability
- **Issue**: Traced through nearly every layer of the repo: `.gitlab-ci.yml` hardcoded a different AWS account ID and `ap-southeast-1` region, a DAST job hit `api.datawai.co.uk`, `docs/README.md` described the platform as Thailand-market with APAC data residency, `docs/GDPR_SCC_Documentation.md` was entirely about Thailand SCCs, and `docs/Claudeskill.md` (an AI-agent instruction file) explicitly told any AI working on the repo to pin resources to `ap-southeast-1`/`ap-southeast-3` and "never default to EU regions."
- **Impact**: Beyond the immediate bugs (wrong region in CI would fail every pipeline run against the real infra, or worse cross-contaminate the wrong AWS account if that account ID happened to be reachable), the `Claudeskill.md` file specifically risked *perpetuating* the problem — any future AI-assisted change following those instructions would have reintroduced the wrong region.
- **Remediation**: Fixed the CI region/account references (now resolved dynamically via `aws sts get-caller-identity`, never hardcoded), fixed or removed the contaminated docs, corrected `Claudeskill.md` to describe PrivacyReady accurately as UK-only.
- **Pillar**: Security (wrong-account risk) / Operational Excellence

### H7. Terraform plan output committed to the repository
- **Status**: 🟢 Fixed
- **Category**: Security
- **Issue**: `terraform/tfplan`, a 60KB binary Terraform plan file, was committed to what is now a public repository.
- **Impact**: Plan files can contain resource attribute values in cleartext, including ones that should be sensitive, depending on how the plan was generated. Committing them is a well-known anti-pattern.
- **Remediation**: Deleted, added `*.tfplan`/`tfplan` to `.gitignore`.
- **Pillar**: Security

### H8. Free-scan-to-account claiming was silently broken in three ways (dead code path)
- **Status**: 🟢 Fixed
- **Category**: Reliability
- **Issue**: Three draft files (`temp.js`, `temp2.js`, `temp3.js`) contained an earlier, broken version of the homepage's free-scan widget: hardcoded `http://localhost:5173` as the "create account" link, pointed the scan API call at `api.privacyready.com` (wrong TLD, wrong domain entirely) instead of `.co.uk`, and never captured the scan's ID to pass through to registration. Not live in production (the real `index.html` had a correct implementation), but sitting in the repo as a plausible-looking trap for the next person editing that flow.
- **Impact**: Low direct impact (dead code), but high risk if anyone had copied from these files believing them to be current.
- **Remediation**: Deleted; verified the live implementation is correct.
- **Pillar**: Maintainability

### H9. No content-based verification that a registering user owns their email
- **Status**: 🟢 Fixed
- **Category**: Security
- **Issue**: Registration issued a session token immediately, with no email verification step.
- **Impact**: Accounts (including org-admin accounts) could be created with typo'd or someone else's email address with no confirmation loop.
- **Remediation**: Registration now creates an unverified account, sends a verification link via SES, and blocks login until verified. Note: initially attempted via SNS per request, corrected to SES since SNS's email protocol can't send to arbitrary unconfirmed addresses — see conversation for detail.
- **Pillar**: Security

### H10. No content security policy or security response headers
- **Status**: 🔴 Open
- **Category**: Security
- **Issue**: Verified — no `Content-Security-Policy` header anywhere in the frontend HTML, and no CloudFront response headers policy in Terraform.
- **Impact**: No defense-in-depth against XSS even if application-layer input sanitization has a gap; also missing `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`.
- **Remediation**: Add a CloudFront response headers policy:
  ```hcl
  resource "aws_cloudfront_response_headers_policy" "security" {
    name = "privacyready-security-headers"
    security_headers_config {
      content_security_policy {
        content_security_policy = "default-src 'self'; script-src 'self' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
        override                 = true
      }
      frame_options {
        frame_option = "DENY"
        override     = true
      }
      content_type_options {
        override = true
      }
      referrer_policy {
        referrer_policy = "strict-origin-when-cross-origin"
        override        = true
      }
    }
  }
  ```
  Attach it to the CloudFront distribution's default cache behavior.
- **Pillar**: Security

---

## Medium

### M1. Cookie consent banner didn't actually gate anything
- **Status**: 🟢 Fixed
- **Category**: Security / Compliance
- **Issue**: The banner set a `localStorage` flag but nothing in the codebase read it to conditionally load analytics — cosmetic consent only.
- **Impact**: Regulatory exposure under UK GDPR/PECR (a company selling GDPR compliance tooling with non-functional cookie consent on its own site is a particularly bad look).
- **Remediation**: Added `hasAnalyticsConsent()` as the single source of truth any future analytics loader must check before initializing.
- **Pillar**: Security

### M2. DSR service was a fully stateless scaffold
- **Status**: 🟢 Fixed
- **Category**: Reliability
- **Issue**: `services/dsr/main.py` had no database connection at all (confirmed via `requirements.txt` — no `psycopg2`/`asyncpg`), despite the RDS schema already having a `dsr_requests` table designed for it.
- **Impact**: A core compliance feature (tracking GDPR data-subject requests, which carry a legal 30-day deadline) was non-functional — data never persisted.
- **Remediation**: Implemented DSR persistence in the Node API (Prisma-backed, matching the existing schema) rather than the Python scaffold, with proper org-scoping and a real list endpoint.
- **Pillar**: Reliability

### M3. Dashboard displayed a fabricated vulnerability count
- **Status**: 🟢 Fixed
- **Category**: Maintainability / Trust
- **Issue**: `websiteVulnerabilities = warningCount * 2 + 1` — an arbitrary formula with no relationship to actual findings.
- **Impact**: A compliance product showing a fabricated risk number to paying customers is a credibility and potentially a misrepresentation issue.
- **Remediation**: Replaced with an honest count of actual failed checks from real scan data.
- **Pillar**: Maintainability

### M4. IAM role, alarm, and target group names weren't environment-suffixed
- **Status**: 🟢 Fixed
- **Category**: Reliability
- **Issue**: Several account-global-unique names (`privacyready-ecs-execution-role`, CloudWatch alarm names, ALB target group names) were identical between what are now independent test/production Terraform states.
- **Impact**: `terraform apply` would fail with a naming collision if test and production were ever both live simultaneously — a real possibility now that they're separate states rather than mutually-exclusive workspaces.
- **Remediation**: Suffixed all test-environment resource names.
- **Pillar**: Reliability

### M5. Production's Redis was accidentally shared with GitLab, and a dedicated cluster sat unused
- **Status**: 🟢 Fixed
- **Category**: Reliability / Cost
- **Issue**: `locals.tf`'s `redis_host` for production pointed at GitLab's own Redis replication group, not the `aws_elasticache_cluster.main` resource that `elasticache_prod.tf` actually provisioned and paid for.
- **Impact**: Paying for infrastructure (a dedicated ElastiCache cluster) that was never actually used, while the real application had an undocumented coupling to GitLab's cache — meaning restarting or reconfiguring GitLab's Redis could have unexpectedly affected the app.
- **Remediation**: Each environment now has its own genuinely-wired ElastiCache instance via the new module.
- **Pillar**: Reliability / Cost Optimization

### M6. `security_test.tf` had a broken security group reference
- **Status**: 🟢 Fixed
- **Category**: Reliability
- **Issue**: The test RDS security group's ingress rule referenced `aws_security_group.gitlab.id` with no `[0]` index, on a resource that had `count = local.is_prod ? 1 : 0` — i.e., zero instances in the test workspace.
- **Impact**: Would have produced a hard Terraform error the first time anyone tried to apply the test workspace with this rule present (or, depending on evaluation order, a confusing failure).
- **Remediation**: Removed — no longer needed given GitLab has its own dedicated RDS (H2).
- **Pillar**: Reliability

### M7. SES will silently fail to send to arbitrary addresses
- **Status**: 🟡 Partially addressed (infra ready, requires manual AWS Console step)
- **Category**: Operational Excellence
- **Issue**: New AWS accounts' SES starts in "sandbox mode," restricted to sending only to individually pre-verified recipient addresses.
- **Impact**: Verification emails (see H9) will silently fail for real signups until production access is requested and approved.
- **Remediation**: Request SES production access in the AWS Console (Account dashboard → Request production access) — this cannot be done via Terraform. Typically approved within a day.
- **Pillar**: Operational Excellence

### M8. Team-invite temporary passwords had no delivery mechanism (now fixed) / no forced rotation
- **Status**: 🟡 Partially addressed
- **Category**: Security
- **Issue**: When an org admin adds a teammate, a temporary password is generated and emailed (fixed this session), but there's no enforcement that it's changed on first login.
- **Impact**: Temporary passwords could remain in use indefinitely.
- **Remediation**: Add a `mustChangePassword` flag to the `User` model, check it in an auth middleware, and redirect to a forced password-change flow until cleared.
- **Pillar**: Security

---

## Low / Info

### L1. No root `README.md`
- **Status**: 🟢 Fixed
- **Category**: Maintainability
- **Issue**: The repository had no top-level README at all.
- **Remediation**: Added, covering layout, getting started, infra, and admin access.
- **Pillar**: Operational Excellence

### L2. Root-level junk files
- **Status**: 🟢 Fixed
- **Category**: Maintainability
- **Issue**: A 564KB `index.html` that was a raw scrape of github.com's own homepage (unrelated to the project), plus two files (`Dashboard_fixed.tsx`, `main_fixed.ts`) that were leftover artifacts from a prior AI coding session — one was literally chat text, not code.
- **Remediation**: Deleted.
- **Pillar**: Maintainability

### L3. Broken, redundant GitHub Actions workflow
- **Status**: 🟢 Fixed
- **Category**: Maintainability
- **Issue**: `.github/workflows/validate.yml` referenced `create-datawai.sh`, which doesn't exist anywhere in this repo — would fail on every single run. GitLab is the project's actual CI system.
- **Remediation**: Deleted.
- **Pillar**: Operational Excellence

### L4. Dashboard defaulted to a 100% compliance score before any scan ran
- **Status**: 🟢 Fixed
- **Category**: Maintainability
- **Issue**: A brand-new, unscanned organization saw a perfect compliance score by default.
- **Remediation**: Now shows an honest empty state ("Run your first audit to get a score").
- **Pillar**: Maintainability

### L5. Documentation describes Aurora PostgreSQL; actual implementation is plain RDS
- **Status**: 🔴 Open (flagged, not resolved)
- **Category**: Maintainability
- **Issue**: `docs/production_system_architecture.md` describes a writer/reader Aurora replica setup that doesn't match the actual `aws_db_instance` (single-instance RDS with Multi-AZ standby) implementation. Predates this session's changes.
- **Remediation**: Either build real Aurora to match the doc, or rewrite the doc's database section to match reality. Flagged in the doc itself for now.
- **Pillar**: Maintainability

---

## Requested audit areas NOT verified this session

Being explicit about gaps rather than implying full coverage:

- **NACLs** — not reviewed (security groups were, extensively)
- **AWS Shield** (beyond the WAF already in place) — not verified
- **Encryption in transit specifics** (TLS versions/ciphers on internal service-to-service calls, not just the public ALB/CloudFront) — not audited
- **Backup/DR** — RDS automated backups exist (`backup_retention_period`), but RPO/RTO targets, cross-region replication, and *tested* restore procedures were not verified. No evidence of a tested restore.
- **Cost optimization** — no Reserved Instances/Savings Plans review; idle resource detection not assessed
- **SOC 2 readiness** — not assessed
- **Python/Shell static analysis** (bandit, ruff, shellcheck) — `.gitlab-ci.yml` runs these tools in CI, but their actual output/findings were not reviewed in this session
- **npm audit / dependency vulnerability scan results** — CI runs `npm audit`, but results weren't reviewed
- **Data retention/deletion policy enforcement** — a Privacy Policy draft exists (`frontend/privacy-policy.html`) describing retention periods, but no automated enforcement (e.g., a scheduled job actually deleting data past retention) was found or built

---

*Compiled from a single working session — not a substitute for a periodic, independent security review, especially given the volume of infrastructure change made in this same session.*
