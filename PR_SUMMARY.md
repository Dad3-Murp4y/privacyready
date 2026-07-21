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
