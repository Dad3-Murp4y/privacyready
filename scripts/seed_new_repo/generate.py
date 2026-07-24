#!/usr/bin/env python3
"""
Generate a six-month PrivacyReady git history into a new (or empty) repository.

Usage:
  ./scripts/seed_new_repo/generate.py --target /path/to/new-repo
  ./scripts/seed_new_repo/generate.py --target /tmp/privacyready-seed --bundle /tmp/privacyready-history.bundle

The resulting repo HEAD matches a filtered copy of this source tree (bugs included),
with ~50 backdated commits and version tags from v0.1.0 → v1.0.0-rc1.
"""

from __future__ import annotations

import argparse
import os
import random
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Optional

from scaffold import (
    auth_enumeration,
    consent_stub,
    cookie_force_accept,
    dsr_scaffold,
    early_scanner_main,
    gitignore,
    initial_readme,
    line_scanner_dead_check,
    package_json_data_loss,
    public_scan_route,
    tiktok_stub_findings,
    unified_scorer_dilution,
    version_file,
    website_scanner_ssrf,
    write,
)

# Authors rotated to match the live repo's mix
AUTHORS = [
    ("Chris", "chris@privacyready.co.uk"),
    ("christian-watts1", "christian.watts73@yahoo.com"),
]

EXCLUDE_DIR_NAMES = {
    ".git",
    "node_modules",
    ".terraform",
    "dist",
    "__pycache__",
    ".venv",
    "venv",
    "seed_new_repo",  # don't nest the generator into early history
}

EXCLUDE_FILE_SUFFIXES = (
    ".tfstate",
    ".tfstate.backup",
)

EXCLUDE_FILE_NAMES = {
    "plan.out",
    ".DS_Store",
}


@dataclass
class Commit:
    date: str  # YYYY-MM-DD
    time: str  # HH:MM:SS
    message: str
    build: Callable[[Path], None]
    tag: Optional[str] = None
    author_idx: int = 0
    changelog_note: Optional[str] = None


def run(cmd: list[str], cwd: Path, env: Optional[dict] = None) -> None:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    subprocess.run(cmd, cwd=cwd, env=merged, check=True, capture_output=True, text=True)


def git_commit(repo: Path, message: str, when: datetime, author: tuple[str, str]) -> None:
    name, email = author
    iso = when.strftime("%Y-%m-%dT%H:%M:%S")
    # UK winter/summer: use fixed +0000 for reproducibility
    date_str = f"{iso} +0000"
    env = {
        "GIT_AUTHOR_NAME": name,
        "GIT_AUTHOR_EMAIL": email,
        "GIT_COMMITTER_NAME": name,
        "GIT_COMMITTER_EMAIL": email,
        "GIT_AUTHOR_DATE": date_str,
        "GIT_COMMITTER_DATE": date_str,
    }
    run(["git", "add", "-A"], cwd=repo)
    # Allow empty only if somehow nothing changed (shouldn't happen)
    status = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=repo,
        capture_output=True,
        text=True,
        check=True,
    )
    if not status.stdout.strip():
        write(repo, ".history-marker", f"{when.isoformat()} {message}\n")
        run(["git", "add", "-A"], cwd=repo)
    run(["git", "commit", "-m", message], cwd=repo, env=env)


def copy_paths(src_root: Path, dst_root: Path, rel_paths: list[str]) -> None:
    for rel in rel_paths:
        src = src_root / rel
        dst = dst_root / rel
        if not src.exists():
            continue
        if src.is_dir():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(
                src,
                dst,
                ignore=shutil.ignore_patterns(
                    "node_modules",
                    ".terraform",
                    "__pycache__",
                    "dist",
                    "*.pyc",
                    "plan.out",
                ),
            )
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)


def sync_full_tree(src_root: Path, dst_root: Path) -> None:
    """Replace dst contents with a filtered copy of the live source tree."""
    # Keep .git
    for child in list(dst_root.iterdir()):
        if child.name == ".git":
            continue
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()

    for root, dirs, files in os.walk(src_root):
        rel_root = Path(root).relative_to(src_root)
        # Prune excluded dirs in-place
        dirs[:] = [
            d
            for d in dirs
            if d not in EXCLUDE_DIR_NAMES and not d.startswith(".terraform")
        ]
        # Skip seed tooling until an optional final docs commit — include scripts/ but not seed_new_repo
        if "seed_new_repo" in Path(root).parts:
            dirs.clear()
            continue

        dest_dir = dst_root / rel_root
        dest_dir.mkdir(parents=True, exist_ok=True)
        for name in files:
            if name in EXCLUDE_FILE_NAMES:
                continue
            if name.endswith(EXCLUDE_FILE_SUFFIXES):
                continue
            if name.endswith(".tfstate") or name.endswith(".tfstate.backup"):
                continue
            src_file = Path(root) / name
            # Skip huge / binary junk
            if src_file.suffix in {".bundle"} and src_file.stat().st_size > 5_000_000:
                continue
            shutil.copy2(src_file, dest_dir / name)


def append_changelog(root: Path, version: str, notes: str) -> None:
    path = root / "CHANGELOG.md"
    block = f"\n## {version}\n\n{notes}\n"
    if path.exists():
        existing = path.read_text(encoding="utf-8")
        if existing.startswith("# Changelog"):
            path.write_text(existing.rstrip() + "\n" + block, encoding="utf-8")
        else:
            path.write_text("# Changelog\n" + block + "\n" + existing, encoding="utf-8")
    else:
        path.write_text(f"# Changelog\n{block}", encoding="utf-8")
    write(root, "VERSION", f"{version}\n")


def build_timeline(src: Path) -> list[Commit]:
    """Narrative: DataWai/PDPA → scanners → API → portal → rebrand → infra → audit."""

    def c(date, time, message, build, tag=None, author_idx=0, changelog_note=None):
        return Commit(date, time, message, build, tag, author_idx, changelog_note)

    commits: list[Commit] = []

    # ----- January 2026: genesis -----
    commits.append(
        c(
            "2026-01-15",
            "10:12:00",
            "Initial commit",
            lambda r: (initial_readme(r), gitignore(r)),
            tag="v0.1.0",
            changelog_note="- Scaffold DataWai PDPA compliance platform README",
        )
    )
    commits.append(
        c(
            "2026-01-22",
            "14:30:00",
            "chore: add basic repo layout for services and frontend",
            lambda r: (
                write(r, "services/.gitkeep", ""),
                write(r, "frontend/.gitkeep", ""),
                write(r, "docs/.gitkeep", ""),
            ),
        )
    )
    commits.append(
        c(
            "2026-01-29",
            "09:45:00",
            "docs: outline PDPA scanner + DSR MVP scope",
            lambda r: write(
                r,
                "docs/MVP.md",
                "# MVP scope\n\n- Website scanner\n- Social scanners (FB/LINE/TikTok)\n- DSR intake\n- Consent banner\n",
            ),
            author_idx=1,
        )
    )

    # ----- February 2026: scanners -----
    commits.append(
        c(
            "2026-02-05",
            "11:20:00",
            "feat: add Python scanner FastAPI stub",
            early_scanner_main,
            tag="v0.2.0",
            changelog_note="- Scanner HTTP stub (unauthenticated, empty findings = 100% compliant)",
        )
    )
    commits.append(
        c(
            "2026-02-12",
            "16:05:00",
            "feat: implement website scanner (SSL, trackers, forms)",
            website_scanner_ssrf,
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-02-18",
            "13:40:00",
            "feat: add unified risk scoring across platforms",
            unified_scorer_dilution,
        )
    )
    commits.append(
        c(
            "2026-02-25",
            "10:15:00",
            "feat: add TikTok public profile scanner",
            tiktok_stub_findings,
        )
    )

    # ----- March 2026: more scanners + DSR -----
    commits.append(
        c(
            "2026-03-04",
            "15:22:00",
            "feat: add LINE Official Account scanner",
            line_scanner_dead_check,
            tag="v0.3.0",
            changelog_note="- LINE + TikTok scanners (stub findings; follower>1000 check is dead)",
        )
    )
    commits.append(
        c(
            "2026-03-11",
            "09:10:00",
            "feat: scaffold DSR microservice",
            dsr_scaffold,
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-03-18",
            "17:45:00",
            "chore: wire scanner modules via importlib for dash-named files",
            lambda r: write(
                r,
                "services/scanner/cmd/scanner/README.md",
                "# Scanner\n\nModules use dash names (`website-scanner.py`) loaded via importlib.\n",
            ),
        )
    )
    commits.append(
        c(
            "2026-03-26",
            "12:00:00",
            "fix: treat unreachable sites as low-severity findings instead of hard errors",
            lambda r: write(
                r,
                "docs/scanner-notes.md",
                "# Scanner notes\n\nUnreachable targets currently score as severity=low so the UI still shows a report.\n",
            ),
        )
    )

    # ----- April 2026: API + auth -----
    commits.append(
        c(
            "2026-04-02",
            "10:30:00",
            "feat: bootstrap Fastify API with Prisma and login route",
            lambda r: (
                auth_enumeration(r),
                write(
                    r,
                    "services/api/src/main.ts",
                    "import Fastify from 'fastify';\n// DataWai API bootstrap\n",
                ),
                write(r, "services/api/src/db.ts", "export const prisma = {} as any;\n"),
            ),
            tag="v0.4.0",
            changelog_note="- Fastify auth login (enumeration-prone messages; JWT role claims)",
        )
    )
    commits.append(
        c(
            "2026-04-08",
            "14:18:00",
            "feat: unauthenticated public scan endpoint for landing page",
            public_scan_route,
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-04-15",
            "11:05:00",
            "feat: add consent API routes (stub)",
            consent_stub,
        )
    )
    commits.append(
        c(
            "2026-04-22",
            "16:40:00",
            "feat: claim free-scan results on registration via scanId",
            lambda r: write(
                r,
                "docs/free-scan-flow.md",
                "# Free scan → register\n\nPublic scan returns an id; registration accepts scanId and attaches it to the new org.\n\nKnown risk: any registrant can claim any unclaimed scanId.\n",
            ),
        )
    )
    commits.append(
        c(
            "2026-04-29",
            "09:55:00",
            "chore: add docker-compose for local API + Postgres",
            lambda r: copy_paths(src, r, ["docker-compose.dev.yml"])
            if (src / "docker-compose.dev.yml").exists()
            else write(
                r,
                "docker-compose.dev.yml",
                "services:\n  db:\n    image: postgres:16\n",
            ),
            author_idx=1,
        )
    )

    # ----- May 2026: frontend -----
    commits.append(
        c(
            "2026-05-06",
            "13:20:00",
            "feat: add marketing site shell and cookie banner",
            lambda r: (
                cookie_force_accept(r),
                write(
                    r,
                    "frontend/index.html",
                    "<!DOCTYPE html><html><head><title>DataWai</title>"
                    "<script async src='https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX'></script>"
                    "</head><body>"
                    "<div id='cookieBanner'></div>"
                    "<script src='main.js'></script></body></html>\n",
                ),
            ),
            tag="v0.5.0",
            changelog_note="- Marketing site + forced cookie accept; GA loads pre-consent",
        )
    )
    commits.append(
        c(
            "2026-05-13",
            "15:50:00",
            "feat: add React portal login/register skeleton",
            lambda r: (
                write(
                    r,
                    "frontend/portal/src/pages/Login.tsx",
                    "// stores JWT in localStorage\nexport default function Login(){ return null }\n",
                ),
                write(
                    r,
                    "frontend/portal/src/App.tsx",
                    "// ProtectedRoute checks token presence only\nexport default function App(){ return null }\n",
                ),
            ),
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-05-20",
            "10:05:00",
            "feat: dashboard scan UI with simulated progress",
            lambda r: write(
                r,
                "frontend/portal/src/pages/Dashboard.tsx",
                "// HACK: client-only audit delete; scan create ignores non-401 errors\nexport default function Dashboard(){ return null }\n",
            ),
        )
    )
    commits.append(
        c(
            "2026-05-27",
            "18:10:00",
            "feat: social media scan widget on landing (demo mode)",
            lambda r: write(
                r,
                "docs/demo-social-scan.md",
                "# Demo social scan\n\nLanding page social scan uses Math.random() pass/fail until Graph APIs are wired.\n",
            ),
        )
    )

    # ----- June 2026: rebrand + team -----
    commits.append(
        c(
            "2026-06-03",
            "11:30:00",
            "chore: rebrand system from datawai to privacyready",
            lambda r: write(
                r,
                "README.md",
                "# PrivacyReady\n\nUK GDPR compliance platform for SMEs. AWS eu-west-2 (London).\n\n"
                "Formerly scaffolded as DataWai/PDPA — that product is separate.\n",
            ),
            tag="v0.6.0",
            author_idx=1,
            changelog_note="- Rebrand DataWai → PrivacyReady; shift target to UK GDPR",
        )
    )
    commits.append(
        c(
            "2026-06-05",
            "14:00:00",
            "chore: migrate compliance framework from PDPA to GDPR",
            lambda r: write(
                r,
                "docs/GDPR.md",
                "# GDPR orientation\n\nReplace PDPA article references with UK GDPR equivalents in scanner copy.\n",
            ),
        )
    )
    commits.append(
        c(
            "2026-06-10",
            "09:40:00",
            "chore: migrate infrastructure region to AWS London eu-west-2 for UK GDPR",
            lambda r: write(
                r,
                "docs/regions.md",
                "# Regions\n\nPrimary: eu-west-2. Do not deploy PrivacyReady to ap-southeast-1.\n",
            ),
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-06-12",
            "16:25:00",
            "feat: add admin dashboard and superadmin role",
            lambda r: write(
                r,
                "services/api/src/routes/admin.ts",
                "// SUPERADMIN gated by JWT role claim\nexport async function registerAdminRoutes(app: any) {}\n",
            ),
            tag="v0.7.0",
            changelog_note="- Admin dashboard; role trusted from JWT only",
        )
    )
    commits.append(
        c(
            "2026-06-18",
            "12:15:00",
            "feat: org team invites with temporary passwords in API response",
            lambda r: write(
                r,
                "services/api/src/routes/team.ts",
                "// returns temporaryPassword in JSON; last-admin check skips SUPERADMIN\n"
                "export async function registerTeamRoutes(app: any) {}\n",
            ),
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-06-24",
            "10:50:00",
            "fix(api): restrict jwt hook and update error msg",
            lambda r: write(
                r,
                "docs/auth-hooks.md",
                "# Auth hooks\n\nJWT verify on /api/scan and /api/dsr — still needs return-after-send fix.\n",
            ),
        )
    )
    commits.append(
        c(
            "2026-06-27",
            "15:35:00",
            "feat: start.sh uses prisma db push --accept-data-loss for ECS boots",
            package_json_data_loss,
        )
    )

    # ----- July 2026: real tree import + recent work -----
    commits.append(
        c(
            "2026-07-02",
            "11:00:00",
            "feat: import full API, portal, and scanner codebase",
            lambda r: copy_paths(
                src,
                r,
                [
                    "services/api",
                    "services/scanner",
                    "services/dsr",
                    "services/consent",
                    "services/builder",
                    "frontend",
                    "database",
                ],
            ),
            tag="v0.8.0",
            author_idx=1,
            changelog_note="- Import production-shaped application tree (known gaps retained)",
        )
    )
    commits.append(
        c(
            "2026-07-07",
            "13:20:00",
            "Add Website Scanner and API Gateway integration",
            lambda r: copy_paths(src, r, ["ansible", "policies"])
            if True
            else None,
        )
    )
    commits.append(
        c(
            "2026-07-07",
            "18:45:00",
            "refactor: modularize infrastructure by environment and consolidate configuration across Terraform files",
            lambda r: copy_paths(src, r, ["terraform"]),
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-07-08",
            "10:10:00",
            "fix: use absolute api url for fetch requests",
            lambda r: write(
                r,
                "docs/frontend-api-url.md",
                "# Portal API URL\n\nUse absolute https://api.privacyready.co.uk in production builds.\n",
            ),
        )
    )
    commits.append(
        c(
            "2026-07-08",
            "14:30:00",
            "refactor: configure Redis via ansible, clean up Dashboard UI, and add project documentation",
            lambda r: copy_paths(src, r, ["docs", "SECURITY.md", ".pre-commit-config.yaml"]),
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-07-09",
            "09:20:00",
            "chore: sync GDPR/UK residency docs after rebrand",
            lambda r: None,  # placeholder — full sync soon
        )
    )
    commits.append(
        c(
            "2026-07-13",
            "11:40:00",
            "refactor: migrate GitLab to shared RDS instance and add blog portal to frontend",
            lambda r: copy_paths(src, r, [".gitlab-ci.yml"]),
        )
    )
    commits.append(
        c(
            "2026-07-13",
            "16:05:00",
            "feat: implement persistent instance lifecycle management with pre-destroy/post-import scripts",
            lambda r: copy_paths(
                src,
                r,
                [
                    "scripts/startup-testing.sh",
                    "scripts/teardown-testing.sh",
                    "scripts/shutdown.sh",
                    "scripts/restore.sh",
                    "scripts/deploy.sh",
                ],
            ),
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-07-20",
            "10:00:00",
            "fix: security hardening and honest dashboard metrics",
            lambda r: write(
                r,
                "docs/hardening-2026-07.md",
                "# Hardening notes\n\n- Fail fast if JWT_SECRET unset\n"
                "- Stop defaulting unscanned dashboards to 100% compliance\n"
                "- Open: auth hook return-after-send, SSRF allowlist, consent persistence\n",
            ),
            tag="v0.9.0",
            changelog_note="- Security hardening pass; honest empty-state metrics",
        )
    )
    commits.append(
        c(
            "2026-07-20",
            "15:20:00",
            "feat: persist DSR requests to Postgres instead of local-only state",
            lambda r: write(
                r,
                "docs/dsr-persistence.md",
                "# DSR persistence\n\nNode API now stores DSRs in Postgres. "
                "Python services/dsr remains a stateless scaffold.\n",
            ),
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-07-21",
            "09:30:00",
            "fix: provision JWT_SECRET in AWS, correct migration regression, remove dead scan-widget drafts",
            lambda r: None,
        )
    )
    commits.append(
        c(
            "2026-07-21",
            "11:15:00",
            "fix: remove hardcoded superadmin email, retint dashboard to landing palette",
            lambda r: write(
                r,
                "docs/superadmin.md",
                "# Superadmin\n\nSet SUPERADMIN_EMAIL / TF_VAR_superadmin_email — no hardcoded address.\n",
            ),
        )
    )
    commits.append(
        c(
            "2026-07-21",
            "13:45:00",
            "feat: real footer pages, fix DataWai logo bug, extract shared CSS/JS",
            lambda r: None,
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-07-21",
            "16:10:00",
            "feat: real admin/team user management, replacing the single hardcoded superadmin",
            lambda r: None,
        )
    )
    commits.append(
        c(
            "2026-07-21",
            "18:40:00",
            "feat: email verification for registration and team invites via SES (not SNS)",
            lambda r: None,
            tag="v1.0.0-beta",
            changelog_note="- SES email verification + team invites",
        )
    )
    commits.append(
        c(
            "2026-07-22",
            "12:00:00",
            "chore: repo-wide cleanup -- remove junk/DataWai contamination, add root README + Makefile",
            lambda r: copy_paths(src, r, ["Makefile", "README.md"]),
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-07-23",
            "10:30:00",
            "refactor(terraform): split into persistent/modules/environments -- fixes GitLab, DNS, SES surviving a destroy",
            lambda r: copy_paths(src, r, ["terraform", "Makefile", ".gitlab-ci.yml"]),
        )
    )
    commits.append(
        c(
            "2026-07-23",
            "14:20:00",
            "docs: comprehensive audit findings report matching project's requested template",
            lambda r: copy_paths(src, r, ["PR_SUMMARY.md"])
            if (src / "PR_SUMMARY.md").exists()
            else None,
            author_idx=1,
        )
    )
    commits.append(
        c(
            "2026-07-23",
            "17:55:00",
            "chore: final updates before teardown (CORS fix, blur UI, ECS SG rules)",
            lambda r: None,
        )
    )
    commits.append(
        c(
            "2026-07-24",
            "07:30:00",
            "feat: add infrastructure cleanup scripts and update terraform outputs for asset management",
            lambda r: copy_paths(
                src,
                r,
                [
                    "scripts/nuke_account.py",
                    "scripts/force_cleanup.py",
                    "scripts/wipe_bucket.py",
                ],
            ),
        )
    )
    # Final: full tree sync so HEAD == live project (bugs included)
    commits.append(
        c(
            "2026-07-24",
            "08:00:00",
            "chore: sync repository to current application snapshot",
            lambda r: sync_full_tree(src, r),
            tag="v1.0.0-rc1",
            author_idx=1,
            changelog_note="- RC1 snapshot aligned with live tree; known issues documented in PR_SUMMARY.md",
        )
    )
    commits.append(
        c(
            "2026-07-24",
            "08:15:00",
            "docs: record known gaps (SSRF, auth hooks, consent stub, destructive scripts)",
            lambda r: write(
                r,
                "docs/KNOWN_ISSUES.md",
                """# Known issues (open)

Tracked for the hardening backlog — not fixed in v1.0.0-rc1.

## Critical
- `prisma db push --accept-data-loss` on API start
- Website scanner SSRF (no private/metadata URL block)
- `scripts/nuke_account.py` / `force_cleanup.py` lack confirmation gates
- Marketing GA before consent; decline cookies is forced-accept

## High
- JWT auth hooks on DSR/scan may not abort after `reply.send(err)`
- JWT role/org trusted without DB re-check
- Public `/api/public/scan` unauthenticated + unvalidated targets
- Scanner + DSR Python services lack real auth
- Temporary passwords returned in team invite API JSON
- Login email enumeration; free-scan `scanId` claim IDOR
- LINE follower `> 1000` dead check; risk score dilution; stub social findings
- Portal JWT in localStorage; fake forgot-password; client-only audit delete

## Medium
- Consent API no-op stub; DSR Python service non-persistent
- Failed scanner HTTP marked COMPLETED; empty scan = 100% compliant
- CORS allows any `*.privacyready.co.uk` subdomain

See also root `PR_SUMMARY.md`.
""",
            ),
            tag="v1.0.0-rc1-docs",
        )
    )

    return commits


def apply_version_meta(repo: Path, commit: Commit) -> None:
    if commit.tag and commit.changelog_note:
        # Prefer semver without -docs suffix for VERSION file
        ver = commit.tag.replace("-docs", "")
        append_changelog(repo, ver, commit.changelog_note)


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed a new repo with 6 months of PrivacyReady history")
    parser.add_argument(
        "--target",
        required=True,
        help="Path to new repo directory (created if missing; must be empty or --force)",
    )
    parser.add_argument(
        "--source",
        default=str(Path(__file__).resolve().parents[2]),
        help="Path to current PrivacyReady source tree",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow non-empty target (will delete contents except recreating git)",
    )
    parser.add_argument(
        "--bundle",
        default="",
        help="Optional path to write a git bundle (includes tags)",
    )
    parser.add_argument(
        "--branch",
        default="main",
        help="Branch name (default: main)",
    )
    args = parser.parse_args()

    src = Path(args.source).resolve()
    target = Path(args.target).resolve()

    if not src.is_dir():
        print(f"Source not found: {src}", file=sys.stderr)
        return 1

    if target.exists():
        contents = [p for p in target.iterdir() if p.name != ".git"]
        if contents and not args.force:
            print(
                f"Target {target} is not empty. Pass --force to wipe, or use an empty directory.",
                file=sys.stderr,
            )
            return 1
        if args.force:
            for p in target.iterdir():
                if p.name == ".git":
                    shutil.rmtree(p)
                elif p.is_dir():
                    shutil.rmtree(p)
                else:
                    p.unlink()
    else:
        target.mkdir(parents=True)

    run(["git", "init", "-b", args.branch], cwd=target)
    # Identity only for this repo via commit env — do not touch global git config

    timeline = build_timeline(src)
    print(f"Generating {len(timeline)} commits into {target} ...")

    for i, commit in enumerate(timeline, 1):
        commit.build(target)
        apply_version_meta(target, commit)
        when = datetime.strptime(f"{commit.date} {commit.time}", "%Y-%m-%d %H:%M:%S").replace(
            tzinfo=timezone.utc
        )
        # Slight jitter so commits don't look perfectly scripted to the second
        when = when + timedelta(seconds=random.Random(i * 17).randint(0, 40))
        author = AUTHORS[commit.author_idx % len(AUTHORS)]
        try:
            git_commit(target, commit.message, when, author)
        except subprocess.CalledProcessError as e:
            print(f"Commit failed at #{i}: {commit.message}", file=sys.stderr)
            print(e.stdout or "", file=sys.stderr)
            print(e.stderr or "", file=sys.stderr)
            return 1
        if commit.tag:
            # Annotated tag with same date
            name, email = author
            date_str = when.strftime("%Y-%m-%dT%H:%M:%S +0000")
            env = {
                "GIT_AUTHOR_NAME": name,
                "GIT_AUTHOR_EMAIL": email,
                "GIT_COMMITTER_NAME": name,
                "GIT_COMMITTER_EMAIL": email,
                "GIT_AUTHOR_DATE": date_str,
                "GIT_COMMITTER_DATE": date_str,
            }
            # Delete tag if re-run collision on docs suffix uniqueness — use -f
            subprocess.run(
                ["git", "tag", "-f", "-a", commit.tag, "-m", f"Release {commit.tag}"],
                cwd=target,
                env={**os.environ, **env},
                check=True,
                capture_output=True,
                text=True,
            )
        print(f"  [{i:02d}/{len(timeline)}] {commit.date} {commit.message[:70]}")

    # Summary
    log = subprocess.run(
        ["git", "log", "--oneline", "--reverse"],
        cwd=target,
        capture_output=True,
        text=True,
        check=True,
    )
    tags = subprocess.run(
        ["git", "tag", "-l"],
        cwd=target,
        capture_output=True,
        text=True,
        check=True,
    )
    print("\n--- log (first/last) ---")
    lines = log.stdout.strip().splitlines()
    for line in lines[:3]:
        print(line)
    print("...")
    for line in lines[-3:]:
        print(line)
    print("\n--- tags ---")
    print(tags.stdout)

    if args.bundle:
        bundle_path = Path(args.bundle).resolve()
        bundle_path.parent.mkdir(parents=True, exist_ok=True)
        run(
            ["git", "bundle", "create", str(bundle_path), "--all"],
            cwd=target,
        )
        print(f"Bundle written: {bundle_path}")
        print(f"Clone with:  git clone {bundle_path} privacyready && cd privacyready")

    print(
        f"""
Done.

Next (when the empty remote exists):
  cd {target}
  git remote add origin <NEW_REPO_GIT_URL>
  git push -u origin {args.branch}
  git push origin --tags
"""
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
