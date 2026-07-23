# PR: Security hardening, DSR persistence, and dashboard cleanup

4 commits, not yet pushed (`58c938f` → `c46f498`). Squash or keep separate — your call.

## ⚠️ Before merging / deploying

1. **Set `superadmin_email`** via `TF_VAR_superadmin_email` or an untracked `.tfvars` file, then `terraform apply`. Without this, nobody can reach `/admin`.
2. **Run `npx prisma generate && npx tsc --noEmit`** in a real dev environment. I couldn't fully typecheck the new `DsrRequest` model here — `prisma generate` needs a binary download this sandbox couldn't reach.
3. **Test registration + login on staging** before production — this PR fixes a regression that broke both (see commit 2 below).

## What's in here

### `58c938f` — Security hardening and honest dashboard metrics
- API refuses to start with a hardcoded JWT fallback secret (fail-fast if `JWT_SECRET` unset)
- `start.sh` requires `DB_PASSWORD`/`DB_HOST` instead of silently connecting with a blank password
- Cookie consent banner: removed overclaiming "personalized ads" copy, added `hasAnalyticsConsent()` as a single gating point for any future analytics script
- Dashboard: removed a fabricated `websiteVulnerabilities` formula (`warningCount * 2 + 1`) in favor of a real count of failed checks; stopped defaulting compliance score to 100% before any scan has run

### `477f6d8` — Persist DSR requests to Postgres
- Added `DsrRequest` Prisma model matching the `dsr_requests` table that already existed in `schema.sql` but was never used by either backend service
- New `GET/POST /api/dsr` + `PATCH /api/dsr/:id` routes (JWT-protected, org-scoped)
- Dashboard now fetches/creates/completes real DSRs instead of local-only React state
- **Open question for you**: `services/dsr` (the Python microservice) still doesn't persist anything — it's a stateless scaffold. This PR bypasses it entirely in favor of the Node API. Decide whether to retire it or give it a real job.

### `bca40f3` — Fix a regression I introduced, remove dead files
- `JWT_SECRET` was never actually provisioned in AWS — commit 1's fail-fast check would have crashed the API on every deploy. Added it to Secrets Manager (prod + test), wired into the ECS task, granted IAM read access.
- Commit 1 also switched to `prisma migrate deploy`, but this repo has **no migration history** — that would silently create zero tables on a fresh database. Reverted to `prisma db push` (without `--accept-data-loss`, so it still fails loudly on destructive changes instead of applying them blind).
- Deleted `frontend/temp.js`, `temp2.js`, `temp3.js` — dead draft copies of the scan widget with three separate bugs each (hardcoded `localhost:5173`, wrong API domain, no scan ID capture). Confirmed the *live* `frontend/index.html` widget doesn't have these bugs — the free-scan → account-claiming flow already works correctly end to end.

### `c46f498` — Remove hardcoded superadmin email, retint dashboard
- **Security**: `all.privacyready@gmail.com` was hardcoded as the auto-SUPERADMIN email in a now-public repo — anyone could read it and register that address for full admin access. Replaced with a `SUPERADMIN_EMAIL` env var, sourced from a required (no default) Terraform variable, `.tfvars` gitignored.
- Retinted the portal's dark theme and Dashboard's hardcoded neon colors (cyan/violet/neon red/yellow) to match the landing site's actual navy/blue/lotus palette.

## Known gaps not addressed in this PR

- **Footer has no FAQ**, and most footer links (`About`, `Careers`, `Contact`, `Terms`, `Privacy Policy`, etc.) are placeholder `href="#"`.
- **Footer logo mismatch**: `frontend/index.html`'s footer reads "DataWai" while the surrounding copy says "PrivacyReady" — looks like a copy-paste from the other product.
- `services/dsr` Python microservice's future is undecided (see above).
- Design pass was scoped to *colors only* — layout, empty states, and the `alert()` calls for errors are still open from an earlier review.

---

## Session 2 — footer pages, admin/team management, dashboard retint

### `f3dfb91` — Real footer pages, DataWai logo fix, shared CSS/JS
- Fixed the DataWai→PrivacyReady logo bug in **both** the nav bar and footer (it was site-wide, not just the footer)
- Built real pages for every footer placeholder: `about.html`, `contact.html`, `faq.html`, `privacy-policy.html`, `terms.html`, `cookies.html`, plus `coming-soon.html` for features that don't exist yet (API Access, Compliance Certificate, Fine Calculator, Webinars, Careers) instead of faking them
- Privacy Policy and Terms are explicitly marked "draft, not solicitor-reviewed" on the page itself
- Extracted the ~1900-line inline `<style>` block into `styles.css` and the shared nav/language/cookie-banner script into `main.js` — both linked, not duplicated, across every page now

### `c46f498` (superadmin fix) + `f0d67c1` — Real admin/team management
- Removed the hardcoded `all.privacyready@gmail.com` superadmin email (real security risk on a public repo) — replaced with `SUPERADMIN_EMAIL`, sourced from a required Terraform variable that never gets committed
- **Platform admin** (`admin.ts`): SUPERADMIN can now promote/demote any user's role and delete users/organizations via the UI — no longer dependent on one hardcoded email for bootstrapping future admins
- **Org-level team management** (new `team.ts` + `Team.tsx` page): a client's own ADMIN can add/remove teammates in their org without needing platform access — generates a one-time temp password (no email service exists yet, so it's shown once for the admin to share manually)
- `AdminDashboard.tsx` rewritten with Users + Organizations tabs
- Retinted the dashboard to the landing site's actual navy/blue/lotus palette instead of neon cyan/violet

### Before this ships
- **Set `superadmin_email` in Terraform and register with that email** to get initial platform admin access — nothing else grants SUPERADMIN.
- Run `npx prisma generate` in a real dev environment — same sandbox limitation as before.
- The temp-password flow in `team.ts` has no email delivery yet — admin has to manually share the password shown once in the UI. Worth wiring up real email invites before this goes to real customers.

---

## Session 3 — email verification via SES

### `cdb67ba` — Email verification for registration and team invites
- Asked to use SNS for this — used SES instead, since SNS's email protocol only delivers to pre-subscribed, individually-confirmed addresses and can't send one-off verification emails to arbitrary new users. Domain was already SES-verified for inbound mail in `monitoring.tf`, so no new setup needed there.
- Registration now creates an unverified user, emails a verification link (24h expiry), and returns no session token until verified. `/auth/login` rejects unverified accounts.
- Team invites (`POST /api/team`) now actually email the temp password + verification link via SES, resolving the "no email delivery yet" gap noted above.
- New `VerifyEmail.tsx` page/route, updated `Register.tsx` to show a "check your email" screen.
- IAM policy added to the ECS **task** role (not execution role) scoped narrowly to `ses:SendEmail`/`SendRawEmail` from the `noreply@` address.

### ⚠️ Before this ships (new)
- **SES sandbox mode**: a new AWS account's SES can only send to individually-verified recipient addresses until you request production access in the SES console (Account dashboard → Request production access, not doable via Terraform, usually approved within a day). Until then, verification emails to arbitrary Gmail addresses will silently fail. Verify your own email as a test recipient first if you want to test this before requesting production access.

---

## Session 4 — Terraform: persistent/modules/environments split

### `7a2db60` — Repo-wide cleanup
Deleted junk (564K scraped github.com homepage sitting at repo root, two AI-session artifact files, a 60K committed `tfplan` binary, a broken GitHub Actions workflow referencing a nonexistent script), fixed more DataWai/Thailand contamination (`docs/README.md`, `docs/GDPR_SCC_Documentation.md` deleted entirely -- wrong product, `docs/Claudeskill.md` was actively instructing AI agents to deploy to `ap-southeast-1`), removed a WAF rule that geo-blocked all traffic except Thailand/UK/Singapore/US. Added a root `README.md` (there wasn't one) and the first version of the `Makefile`.

### `d0cf79e` — Terraform split into persistent/modules/environments
The big one. Converted ~3800 lines across 28 flat `.tf` files into three independent Terraform states:

- **`terraform/persistent/`** — GitLab, Route53 zone + DNSSEC, SES (kept persistent per explicit requirement), ACM certs, ECR repos, Transit Gateway, management VPC. `make destroy` for either app environment has no reference to this state and structurally cannot reach it.
- **`terraform/modules/{vpc,rds,elasticache}/`** — reusable, parameterized, replacing the `*_prod.tf`/`*_test.tf` file-pair pattern.
- **`terraform/environments/{test,production}/`** — fully independent, destroyable/recreatable without touching each other or persistent. Test now has its own subdomain so it can run alongside production without DNS collisions (the original design never supported that).

**Root cause fix, not just reorganization**: GitLab previously wasn't actually independent of the app environment in three separate ways — its database was a schema inside the app's shared RDS, its public URL routed through the app's own ALB, and the `pre-destroy.sh`/`post-import.sh` scripts referenced as the preservation mechanism don't exist anywhere in the repo. Fixed by giving GitLab its own dedicated RDS and ALB in the persistent layer.

**Pre-existing bugs found and fixed (verified against actual resource bodies, not assumed)**:
- Every resource tagged `DataResidency = "thailand"`
- `security_test.tf` referenced `aws_security_group.gitlab.id` with no `[0]` index on a `count = 0`-in-test resource — hard error
- Production's `redis_host` local actually pointed at GitLab's Redis, not the dedicated ElastiCache cluster that existed but was never wired up
- Several IAM role/alarm/target-group names weren't environment-suffixed and would collide if test and production ever ran simultaneously
- `n8-copilot.tf` used `terraform.workspace`, meaningless now that environments are separate directories

**Also updated**: Makefile (new `persistent-*` targets, `ENV`-aware ECS naming — this was a real bug risk, `make roll` without explicit `ENV=production` would silently target the test cluster), `.gitlab-ci.yml` (same fix applied to the deploy jobs, which had this exact bug), `docs/BOOTSTRAP.md`, `terraform/README.md`, root `README.md`.

### ⚠️ Before this ships
- **No AWS credentials or Terraform binary were available in this sandbox.** Everything was verified via syntax-only tooling (`terraform-config-inspect`) and manual cross-reference checking against actual original resource bodies — not `terraform plan`. Run `terraform init && terraform validate && terraform plan` in each of `persistent/`, `environments/test/`, `environments/production/` before applying anything for real.
- This was described as a from-scratch/"vanilla" setup with no live state, so there's no migration risk — but still verify plan output looks sane before the first real `apply`.
- `docs/production_system_architecture.md`'s Aurora PostgreSQL section doesn't match the actual implementation (plain RDS) — flagged in the doc, not rewritten.
