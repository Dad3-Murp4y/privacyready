# Seed a new repo with six months of PrivacyReady history

Generates a **new git repository** whose history runs from **2026-01-15 → 2026-07-24**, with version tags and intentional introduction of known bugs (matching the live tree). Final `HEAD` is a filtered sync of this source repo.

Bugs come from two sources:
1. **Already-committed history** — items from `docs/audits/`, `PR_SUMMARY.md`, and prior `fix:` commits (hardcoded JWT/superadmin, DataWai contamination, fabricated metrics, dead `temp.js` drafts, GitLab-on-shared-RDS, etc.). Many are introduced mid-timeline and later fixed, matching the real narrative.
2. **Later full-code review** — defects still present at HEAD (SSRF, auth-hook abort, destructive scripts, etc.).

This does **not** rewrite your current `.git` history.

## Quick start

```bash
# from the privacyready source checkout
./scripts/seed_new_repo/seed_new_repo.sh ~/repos/privacyready-new

# optional: also write a portable bundle
./scripts/seed_new_repo/seed_new_repo.sh ~/repos/privacyready-new \
  --bundle ~/repos/privacyready-history.bundle
```

When the empty remote (GitLab/GitHub) exists:

```bash
cd ~/repos/privacyready-new
git remote add origin git@gitlab.com:<group>/privacyready.git
git push -u origin main
git push origin --tags
```

Or from a bundle:

```bash
git clone ~/repos/privacyready-history.bundle privacyready
cd privacyready
git remote set-url origin git@gitlab.com:<group>/privacyready.git
git push -u origin main
git push origin --tags
```

## What you get

| Item | Detail |
|------|--------|
| Commits | ~57, dated Jan–Jul 2026 |
| Branch | `main` |
| Authors | `Chris <chris@privacyready.co.uk>` and `christian-watts1 <…@yahoo.com>` (same mix as live) |
| Tags | `v0.1.0` … `v0.9.0`, `v1.0.0-beta`, `v1.0.0-rc1`, `v1.0.0-rc1-docs` |
| Files | `VERSION`, `CHANGELOG.md`, plus app tree at RC1 |
| Bugs | Introduced in mid-history commits; still present at HEAD (not “fixed away”) |

### Narrative arc

1. **Jan** — DataWai / PDPA scaffold (`v0.1.0`)
2. **Feb–Mar** — Scanner stubs, SSRF-prone website fetch, diluted scorer, LINE/TikTok stubs, DSR scaffold (`v0.2.0`–`v0.3.0`)
3. **Apr** — Auth enumeration, public scan, consent no-op (`v0.4.0`)
4. **May** — Marketing + forced cookies, portal JWT in localStorage (`v0.5.0`)
5. **Jun** — Rebrand to PrivacyReady / GDPR / eu-west-2, admin/team, `db push --accept-data-loss` (`v0.6.0`–`v0.7.0`)
6. **Jul** — Full tree import, terraform split, SES verify, cleanup scripts, known-issues doc (`v0.8.0` → `v1.0.0-rc1`)

## Flags

| Flag | Meaning |
|------|---------|
| `--target PATH` | Required. New repo path |
| `--source PATH` | Default: this monorepo root |
| `--force` | Wipe non-empty target |
| `--bundle PATH` | Write `git bundle --all` |
| `--branch NAME` | Default `main` |

## Notes

- Excludes `node_modules`, `.terraform`, tfstate, `plan.out`, and the `seed_new_repo` tooling itself from the synced tree.
- Destructive scripts (`nuke_account.py`, etc.) are included on purpose — they appear late in history as operational tooling.
- Re-running with `--force` on the same `--target` regenerates history from scratch.
