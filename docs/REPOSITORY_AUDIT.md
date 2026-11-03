# Repository audit

Audited 2026-11-03 as repo #3 of `REPOS_INDEX.md`. Backup: `projects/info/backups/be-chatty.git`. Working clone: `projects/be-chatty/`.

This repo is the backend half of a paid-course MERN social-network/chat app, abandoned mid-course: only the auth feature is implemented, and even that doesn't build (see CI/CD and Dependencies below). This audit is noticeably heavier on "broken" findings than repos #1–#2, which were working projects with hygiene/modernization gaps — this one has a real, unresolved implementation gap at its center.

## Git history

154 commits. Default branch is `develop` (not `main` — flagged under CLAUDE.md Approval Gate #4, since renaming the default branch requires approval). A `staging` branch also exists alongside `develop`; no distinct CI or purpose found for it.

## Branches

`develop` (default) + `staging` + 16 bot branches (14 Renovate, 1 Dependabot `npm_and_yarn`, matching the 16 open PRs below). No other human feature branches found.

## CI/CD

Only one workflow exists: `.github/workflows/codeql.yml`, GitHub's auto-generated CodeQL security-scan template (triggers on push/PR to `develop` + a weekly cron). **No install/lint/test/build workflow exists at all.** This means none of the findings below (broken build, broken lint, broken tests, desynced lockfile) have ever been caught automatically — they could have been introduced at any point in the repo's history with zero signal.

## Docker / containerization

`docker-compose.yml` provisions local dev-only dependencies: `mongo` + `mongo-express` (root/root credentials), `redis` + `redis-commander` (hardcoded password — a well-known public placeholder from Redis's own docs, not a real secret, but still hardcoded in a committed file rather than sourced from env). **No Dockerfile for the application itself** — the Node app is not containerized at all, dev or prod.

## Tests

Original baseline: **14 of 18 test suites failed, 9 of 38 individual tests failed** (29 passed), all attributed at the time to the missing `@service/db/*` modules (`ts-jest` type-checks on collection, so the build errors surfaced identically in tests).

**After the Phase 3 hygiene fixes** (see `docs/TECHNICAL_DEBT.md`), re-running revealed a more complex picture than "fix the build and tests follow": excluding the one Mongo-dependent suite (which can't run at all in this sandbox — see below), **29 of 31 runnable tests still pass** (the same 29 as the original baseline — nothing regressed) but several suites now crash for reasons unrelated to the missing service layer:
- `auth.schema.test.ts` (the only suite needing a real in-memory Mongo): `mongodb-memory-server`'s mongod binary fails to spawn (`spawn EFTYPE`), likely tied to its postinstall script being blocked earlier by npm's script-allowlist protection. The ~600MB binary download itself does complete (confirmed over a ~4 minute run), so this is specifically a binary-execution problem, not a download problem.
- `setupServer.test.ts`: crashes at import time inside `depd`/`express` internals (`TypeError: argument fn must be a function`).
- `auth.queue.test.ts` and other queue tests: crash the Jest worker process entirely (`msgpackr`/`bull`: `RangeError: length is outside of buffer bounds`).
- Two smaller, independent pre-existing test-design bugs: a `mongoose` auto-mock missing `.connection.on` (`setupDatabase.test.ts`), and a bad assertion in `app.test.ts`.

Root cause of the three crash-level issues: this repo has no `engines` field or `.nvmrc`, and was almost certainly built against Node 18/20 (course-era, 2024); the local environment runs Node v26.12.1. This was always true — it was simply invisible while lint and build were both completely broken, since no suite ever got far enough to hit it. Confirmed out of scope for this hygiene pass by the repo owner (2026-11-03); tracked as `TECHNICAL_DEBT.md` #13.

While fixing the four build-blocking root causes, two additional, genuine (and previously undetectable) bugs were found and fixed along the way: a typo'd import (`@worker/authWorker` instead of `@worker/auth.worker`) in `auth.worker.test.ts`, and `setupServer.test.ts` importing `server` from the `typescript` npm package instead of using the `chattyServer` instance under test (plus a `no-import-assign` bug in the same file's mock setup).

## Configuration / secrets handling

- `.env_prod` is tracked in git (misleading name, implies real production secrets). Full `git log --all -p` history scan confirms every value it has ever held, in every commit, is an obvious placeholder (`ThisIsATokenFromMe`, `your_api_key`, etc.) or a local-only default (`mongodb://root:root@localhost`) — never a real credential.
- Broader full-history regex scan (AWS-style keys, PEM blocks, generic `password=`/`secret=`/`api_key=` patterns with non-placeholder values) found nothing beyond test-fixture passwords (`'123456789'`, `'qwerty'`, `'Password1'`, etc. in test files — clearly mock data, not real credentials).
- `config.ts` bakes the same placeholder strings in as hardcoded fallback defaults when no env var is set — this is the course's own pattern (recognizable, widely forked), not a project-specific leak.
- **Conclusion: no real secret has ever been committed to this repo.** The `.env_prod` naming/practice is still worth fixing (see `TECHNICAL_DEBT.md` #7), but this is not a Gate #1 (history-rewrite) situation.

## Dead/placeholder code

- `SECURITY.md` is GitHub's unfilled default template.
- `README.md` describes course curriculum (full social network, AWS/Terraform/CircleCI deployment) that doesn't exist in this repo's actual current state — not "dead code" exactly, but actively misleading about what the repo contains.
- `config.ts`'s `createLogger` has a large commented-out block of file-based log stream config (rotating file logs) — never enabled, never removed.

## IDE/editor artifacts

`.vscode/` is tracked — checked its contents; only editor settings (no credentials, nothing sensitive). Low-priority cleanup candidate, not a security concern.

## Dependencies

Original baseline (before the approved Phase 2.6 hygiene/config pass):
- `npm ci` failed outright (lockfile desync), `npm run build` failed with 17 TS errors across 14 files (4 distinct root causes), `npm run lint:check` couldn't run at all (ESLint v9/v8 config drift), 48 local `npm audit` vulnerabilities (3 critical, 20 high, 9 moderate, 16 low) vs. GitHub's own count of 134 (2 critical, 64 high, 58 moderate, 10 low) — the same kind of advisory-count-vs-package-count discrepancy documented for repo #1.

**After the hygiene/config fixes** (full detail in `docs/TECHNICAL_DEBT.md`):
- `npm ci` now succeeds cleanly from a fresh clone (verified: `rm -rf node_modules && npm ci`).
- `npm run build`: down to exactly **13 errors in 11 files**, all `Cannot find module '@service/db/{auth,user}.service'` — the one gap left by design (hygiene-only scope, not implementing new business logic). The other 3 root causes (`@types/express` major mismatch, `@bull-board` duplicate-nested-type conflict, missing `supertest`) are fixed and verified.
- `npm run lint:check`: **0 errors** (verified). Migrating to flat-config also surfaced 23 real, previously-invisible lint violations across the codebase (unused vars/imports, unsafe `any`, a `no-import-assign` bug in a test's mock setup) — all fixed, zero behavior change confirmed by re-running the build after each.
- `npm audit`: **28 vulnerabilities** (0 critical, 5 high, 8 moderate, 15 low) — down from the original baseline of 48 (3 critical, 20 high, 9 moderate, 16 low), entirely as a side effect of triaging the dependency-bot PRs below, not a dedicated audit-fix pass. Remaining findings are led by `bull`'s vulnerable nested `uuid` dependency — `bull` itself is already at its latest 4.x (4.16.5); a fix would require a major-version bump, out of scope for a hygiene pass.
- Testing the fixes surfaced a separate, previously-invisible issue: Node-version/native-module incompatibilities unrelated to the missing service layer (no `engines` field, local Node v26 vs. this 2024 course repo's likely 18/20 target) — see `TECHNICAL_DEBT.md` #13. Confirmed out of scope for this pass.
- **Dependency-bot PR triage: complete, 0 open PRs remain.** Started at 16 open bot PRs (14 Renovate, 1 Dependabot `npm_and_yarn`, 1 more), several well over a year stale (oldest dated 2024-11-20); Dependabot regenerated its grouped PR twice more mid-triage as individual package merges resolved subsets of it. Every PR was triaged and merged individually via separate `gh pr merge` calls (never batch-merged) after checking each for major-version-bump risk the same way the `@types/express`/`@types/nodemailer` mismatches were caught. Two PRs (`bull` #65, the 12-package Dependabot group #86) had lockfiles that conflicted with drift from earlier merges in this same pass and could not auto-rebase; both were resolved by checking out the branch, merging current `develop` in directly (or applying the bump manually), re-verifying build/lint, and pushing before merging. Three PRs (`@bull-board/express`/`ui` #71/#73, mongoose #75) self-closed via Renovate once superseded by equivalent fixes already applied; one (`@types/nodemailer` #67) was closed as moot after `@types/nodemailer` was removed entirely.
- **1 open human-authored issue** (#3, "Optimize tsconfig.json", opened 2024-09-27 by the repo owner) — a legitimate standing TODO, not yet actioned, not part of this hygiene pass.
