"""Scaffolds for bugs that were already committed in the live repo history.

Sources: docs/audits/2026-07-comprehensive-findings.md, docs/audits/2026-01-code-review.md,
PR_SUMMARY.md, and fix commit messages (hardcoded JWT/superadmin, DataWai contamination,
fabricated metrics, dead scan-widget drafts, etc.).
"""

from __future__ import annotations

from pathlib import Path

from scaffold import write


def jwt_hardcoded_fallback(root: Path) -> None:
    """C1 — hardcoded JWT signing secret fallback (later fixed)."""
    write(
        root,
        "services/api/src/main.ts",
        """
import Fastify from 'fastify';
import fjwt from '@fastify/jwt';

const app = Fastify({ logger: true });

// BUG (C1): committed fallback secret — forgeable tokens if JWT_SECRET unset
const jwtSecret = process.env.JWT_SECRET || 'super_secret_for_local_dev_only_1234';

await app.register(fjwt, { secret: jwtSecret });

app.listen({ port: 3000, host: '0.0.0.0' });
""",
    )


def jwt_fail_fast_fix(root: Path) -> None:
    """Remediation for C1 — fail if JWT_SECRET unset."""
    write(
        root,
        "services/api/src/main.ts",
        """
import Fastify from 'fastify';
import fjwt from '@fastify/jwt';

const app = Fastify({ logger: true });

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required — refusing to start with a fallback secret');
}

await app.register(fjwt, { secret: process.env.JWT_SECRET });

app.listen({ port: 3000, host: '0.0.0.0' });
""",
    )


def hardcoded_superadmin_email(root: Path) -> None:
    """C2 — all.privacyready@gmail.com auto-SUPERADMIN (later fixed)."""
    write(
        root,
        "services/api/src/routes/auth.ts",
        """
import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';

export async function registerAuthRoutes(app: FastifyInstance) {
  const RegisterSchema = {
    body: Type.Object({
      email: Type.String({ format: 'email' }),
      password: Type.String(),
      fullName: Type.String(),
      organizationName: Type.String(),
      scanId: Type.Optional(Type.String())
    })
  };

  const LoginSchema = {
    body: Type.Object({
      email: Type.String({ format: 'email' }),
      password: Type.String()
    })
  };

  app.post('/auth/register', { schema: RegisterSchema }, async (request, reply) => {
    const { email, password, fullName, organizationName, scanId } = request.body as any;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.code(400).send({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (tx: any) => {
      const org = await tx.organization.create({ data: { name: organizationName } });
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          organizationId: org.id,
          // BUG (C2): hardcoded superadmin email in a public repo
          role: email.toLowerCase() === 'all.privacyready@gmail.com' ? 'SUPERADMIN' : 'ADMIN'
        }
      });
      if (scanId) {
        await tx.scan.updateMany({
          where: { id: scanId, organizationId: null },
          data: { organizationId: org.id }
        });
      }
      return newUser;
    });
    // H9: issues session immediately — no email verification yet
    const token = app.jwt.sign(
      { sub: user.id, org: user.organizationId, role: user.role },
      { expiresIn: '1h' }
    );
    return reply.status(201).send({ token });
  });

  app.post('/auth/login', { schema: LoginSchema }, async (request, reply) => {
    const { email, password } = request.body as any;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const token = app.jwt.sign(
      { sub: user.id, org: user.organizationId, role: user.role },
      { expiresIn: '1h' }
    );
    return { token };
  });
}
""",
    )


def empty_db_password_start(root: Path) -> None:
    """C3 — start.sh with blank DB_PASSWORD fallback (later fixed)."""
    write(
        root,
        "services/api/start.sh",
        """
#!/bin/sh
set -e
# BUG (C3): unset DB_PASSWORD silently becomes an empty password in the URL
export DATABASE_URL="postgresql://${DB_USER:-privacyready_admin}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME:-privacyready}"
# H1: destructive schema push on every boot
npx prisma db push --accept-data-loss
node dist/main.js
""",
    )


def start_sh_fail_fast_fix(root: Path) -> None:
    """Remediation for C3 + partial H1 (require secrets; drop accept-data-loss)."""
    write(
        root,
        "services/api/start.sh",
        """
#!/bin/sh
set -e
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_HOST:?DB_HOST is required}"
export DATABASE_URL="postgresql://${DB_USER:-privacyready_admin}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME:-privacyready}"
# Refuse destructive drift loudly (no --accept-data-loss)
npx prisma db push
node dist/main.js
""",
    )


def relative_api_url_bug(root: Path) -> None:
    """Portal used a relative/wrong API base (fixed by absolute URL commit)."""
    write(
        root,
        "frontend/portal/src/lib/api.ts",
        """
// BUG: relative URL breaks when portal is served from a different origin than the API
export const API_BASE = '/api';

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, init);
}
""",
    )


def absolute_api_url_fix(root: Path) -> None:
    write(
        root,
        "frontend/portal/src/lib/api.ts",
        """
export const API_BASE = 'https://api.privacyready.co.uk';

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, init);
}
""",
    )


def fabricated_dashboard_metrics(root: Path) -> None:
    """M3 + L4 — fake vulnerability count and default 100% score."""
    write(
        root,
        "frontend/portal/src/pages/Dashboard.tsx",
        """
// BUG (M3): fabricated vulnerability count unrelated to findings
// BUG (L4): default compliance score 100 before any scan
export function deriveMetrics(warningCount: number, hasScans: boolean) {
  const websiteVulnerabilities = warningCount * 2 + 1;
  const complianceScore = hasScans ? undefined : 100;
  return { websiteVulnerabilities, complianceScore };
}

export default function Dashboard() {
  return null;
}
""",
    )


def honest_dashboard_metrics_fix(root: Path) -> None:
    write(
        root,
        "frontend/portal/src/pages/Dashboard.tsx",
        """
// Honest metrics: count real failed checks; empty state until first scan
export function deriveMetrics(failedChecks: number, hasScans: boolean) {
  return {
    websiteVulnerabilities: failedChecks,
    complianceScore: hasScans ? undefined : null,
    emptyState: !hasScans ? 'Run your first audit to get a score' : null,
  };
}

export default function Dashboard() {
  return null;
}
""",
    )


def dead_scan_widget_drafts(root: Path) -> None:
    """H8 — temp.js / temp2.js / temp3.js with three bugs each."""
    for name, api_host in [
        ("temp.js", "http://localhost:5173"),
        ("temp2.js", "https://api.privacyready.com"),
        ("temp3.js", "https://api.privacyready.com"),
    ]:
        write(
            root,
            f"frontend/{name}",
            f"""
// DEAD DRAFT — not wired into index.html, but looks current (H8)
// Bugs: hardcoded create-account URL, wrong API host, never captures scan id
async function startFreeScan(url) {{
  const res = await fetch('{api_host}/api/public/scan', {{
    method: 'POST',
    headers: {{ 'Content-Type': 'application/json' }},
    body: JSON.stringify({{ targetIdentifier: url, scanType: 'website' }})
  }});
  await res.json();
  // never reads scan.id
  window.location.href = '{api_host if "localhost" in api_host else "http://localhost:5173"}/register';
}}
""",
        )


def remove_dead_scan_widget_drafts(root: Path) -> None:
    for name in ("temp.js", "temp2.js", "temp3.js"):
        path = root / "frontend" / name
        if path.exists():
            path.unlink()


def datawai_contamination(root: Path) -> None:
    """H5/H6 — wrong product region, WAF geo-block, Claudeskill, DAST host."""
    write(
        root,
        "docs/Claudeskill.md",
        """
# Agent instructions (DataWai)

- Always deploy to ap-southeast-1 or ap-southeast-3
- Never default to EU regions
- Product market: Thailand PDPA
- DAST target: https://api.datawai.co.uk
""",
    )
    write(
        root,
        "docs/GDPR_SCC_Documentation.md",
        """
# Thailand SCC notes (wrong product)

This document describes Thailand PDPA standard contractual clauses for DataWai.
""",
    )
    write(
        root,
        ".gitlab-ci.yml",
        """
# BUG (H6): hardcoded wrong AWS account + ap-southeast-1; DAST hits datawai
variables:
  AWS_DEFAULT_REGION: ap-southeast-1
  AWS_ACCOUNT_ID: "000000000000"
  DAST_WEBSITE: "https://api.datawai.co.uk"

deploy:
  script:
    - echo "deploying to $AWS_DEFAULT_REGION / $AWS_ACCOUNT_ID"
""",
    )
    write(
        root,
        "terraform/waf.tf",
        """
# BUG (H5): GeoBlockNonThailand leftover from DataWai — blocks most of the world
resource "aws_wafv2_rule_group" "geo" {
  name     = "GeoBlockNonThailand"
  scope    = "CLOUDFRONT"
  capacity = 10

  rule {
    name     = "AllowTHUKSGUS"
    priority = 1
    action { allow {} }
    statement {
      geo_match_statement {
        country_codes = ["TH", "GB", "SG", "US"]
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AllowTHUKSGUS"
      sampled_requests_enabled   = true
    }
  }
}
""",
    )
    write(
        root,
        "frontend/index.html",
        """
<!DOCTYPE html>
<html>
<head>
  <title>PrivacyReady</title>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
</head>
<body>
  <nav><img alt="DataWai" src="/logo.svg" /> DataWai</nav>
  <footer>© DataWai — Thailand PDPA compliance</footer>
  <div id="cookieBanner"></div>
  <script src="main.js"></script>
</body>
</html>
""",
    )


def cleanup_datawai_contamination(root: Path) -> None:
    for rel in (
        "docs/GDPR_SCC_Documentation.md",
        "terraform/waf.tf",
    ):
        path = root / rel
        if path.exists():
            path.unlink()
    write(
        root,
        "docs/Claudeskill.md",
        """
# Agent instructions (PrivacyReady)

- UK-only product. Deploy to AWS eu-west-2 (London) only.
- Never pin resources to ap-southeast-1 / DataWai accounts.
- DAST / API host: https://api.privacyready.co.uk
""",
    )
    write(
        root,
        ".gitlab-ci.yml",
        """
# Region/account resolved dynamically — never hardcode a foreign account
variables:
  AWS_DEFAULT_REGION: eu-west-2

deploy:
  script:
    - export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    - echo "deploying to $AWS_DEFAULT_REGION / $AWS_ACCOUNT_ID"
""",
    )


def committed_tfplan_and_junk(root: Path) -> None:
    """H7 + L2 + L3 — tfplan binary stub, scraped junk, broken GHA workflow."""
    write(
        root,
        "terraform/tfplan",
        "TFPLAN_BINARY_STUB_DO_NOT_SHIP\n",
    )
    write(
        root,
        "index.html",
        "<!-- 564K scraped github.com homepage placeholder -->\n<html><body>github.com scrape</body></html>\n",
    )
    write(
        root,
        "Dashboard_fixed.tsx",
        "// leftover AI session artifact — not real code\n// User: can you fix the dashboard?\n",
    )
    write(
        root,
        "main_fixed.ts",
        "// leftover AI chat dump, not application code\n",
    )
    write(
        root,
        ".github/workflows/validate.yml",
        """
name: validate
on: [push]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # BUG (L3): script does not exist; GitLab is the real CI
      - run: ./create-datawai.sh
""",
    )


def remove_tfplan_and_junk(root: Path) -> None:
    for rel in (
        "terraform/tfplan",
        "index.html",
        "Dashboard_fixed.tsx",
        "main_fixed.ts",
        ".github/workflows/validate.yml",
    ):
        path = root / rel
        if path.exists():
            path.unlink()
    # ignore plan files going forward
    gi = root / ".gitignore"
    extra = "\n*.tfplan\ntfplan\n"
    if gi.exists():
        text = gi.read_text(encoding="utf-8")
        if "tfplan" not in text:
            gi.write_text(text.rstrip() + extra, encoding="utf-8")
    else:
        write(root, ".gitignore", extra.lstrip())


def gitlab_shared_rds_coupling(root: Path) -> None:
    """H2/H3/H4/M5/M6 — GitLab coupled to app env (later fixed by persistent split)."""
    write(
        root,
        "terraform/gitlab.tf",
        """
# BUG (H2): GitLab DB is a schema on the shared app RDS
# BUG (H3): public URL attaches to the app environment ALB
# BUG (H4): comments reference scripts/pre-destroy.sh and scripts/post-import.sh — neither exists
# Dedicated GitLab DB resources removed to support hosting on shared database

resource "aws_lb_listener_rule" "gitlab" {
  # attaches gitlab.privacyready.co.uk to the *app* ALB
  listener_arn = aws_lb_listener.https.arn
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.gitlab.arn
  }
}

# Preservation: see scripts/pre-destroy.sh and scripts/post-import.sh (missing!)
""",
    )
    write(
        root,
        "terraform/locals.tf",
        """
locals {
  # BUG (M5): production redis_host points at GitLab's Redis, not aws_elasticache_cluster.main
  redis_host = aws_elasticache_replication_group.gitlab.primary_endpoint_address
}
""",
    )
    write(
        root,
        "terraform/security_test.tf",
        """
# BUG (M6): references aws_security_group.gitlab.id without [0] while count=0 in test
resource "aws_security_group_rule" "rds_from_gitlab" {
  type                     = "ingress"
  security_group_id        = aws_security_group.rds_test.id
  source_security_group_id = aws_security_group.gitlab.id
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
}
""",
    )
    write(
        root,
        "terraform/names.tf",
        """
# BUG (M4): account-global names not environment-suffixed — collide if test+prod both apply
locals {
  ecs_execution_role_name = "privacyready-ecs-execution-role"
  alb_tg_name             = "privacyready-api-tg"
  cpu_alarm_name          = "privacyready-api-cpu-high"
}
""",
    )


def scan_type_payload_bug(root: Path) -> None:
    """From 2026-01 code review: Facebook/LINE payloads wrongly send tiktok_username."""
    write(
        root,
        "docs/scanner-payload-bug.md",
        """
# Scanner payload bug (open)

For `scanType` Facebook or LINE, `/api/scan` and `/api/public/scan` currently send
`tiktok_username: targetIdentifier` instead of facebook_token/page_id or line_token/channel_id.

See docs/audits/2026-01-code-review.md.
""",
    )


def cookie_consent_cosmetic_only(root: Path) -> None:
    """M1 — banner set a flag nothing read (later hasAnalyticsConsent)."""
    write(
        root,
        "frontend/portal/src/components/CookieConsent.tsx",
        """
// BUG (M1): sets localStorage but nothing gates analytics on this flag
export function acceptConsent() {
  localStorage.setItem('gdpr_cookie_consent', 'accepted');
}

export function hasAnalyticsConsent() {
  // added later in hardening — initially missing
  return localStorage.getItem('gdpr_cookie_consent') === 'accepted';
}

export default function CookieConsent() {
  return null;
}
""",
    )


def autofill_auth_forms(root: Path) -> None:
    """Pre-fix state called out in commit 'disable autofill on auth forms'."""
    write(
        root,
        "frontend/portal/src/pages/Login.tsx",
        """
// BUG: browser autofill on auth forms caused wrong-credential submits / gitlab db confusion in demos
export default function Login() {
  return (
    <form>
      <input type="email" name="email" />
      <input type="password" name="password" />
    </form>
  );
}
""",
    )


def disable_autofill_fix(root: Path) -> None:
    write(
        root,
        "frontend/portal/src/pages/Login.tsx",
        """
export default function Login() {
  return (
    <form autoComplete="off">
      <input type="email" name="email" autoComplete="off" />
      <input type="password" name="password" autoComplete="new-password" />
    </form>
  );
}
""",
    )


def make_roll_env_bug(root: Path) -> None:
    """Makefile/CI silently targeted test cluster without ENV=production."""
    write(
        root,
        "docs/make-roll-bug.md",
        """
# make roll ENV bug

`make roll` without explicit `ENV=production` silently targeted the test ECS cluster.
Same bug existed in `.gitlab-ci.yml` deploy jobs. Fixed when Terraform was split into
persistent/modules/environments.
""",
    )


def open_infra_gaps(root: Path) -> None:
    """C4/C5/H10/L5/M7/M8 — still open at audit time; document in-repo."""
    write(
        root,
        "docs/OPEN_AUDIT_ITEMS.md",
        """
# Open audit items (still unresolved)

From docs/audits/2026-07-comprehensive-findings.md:

- **C4** No GuardDuty, CloudTrail, or Security Hub in the account
- **C5** CI/CD uses long-lived IAM access keys, not OIDC
- **H10** No Content-Security-Policy / security response headers (CloudFront)
- **L5** Docs describe Aurora; implementation is single-instance RDS Multi-AZ
- **M7** SES may remain in sandbox — verification email silent failures
- **M8** Team invite temp passwords have no forced rotation (`mustChangePassword`)

Also from 2026-01 code review (still relevant):
- Facebook/LINE scan payloads wrongly send `tiktok_username`
- Empty findings reported as LOW / 100% compliant
""",
    )
