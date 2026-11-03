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

`npm test` (Jest + ts-jest, `mongodb-memory-server` for in-memory Mongo) actually executed: **14 of 18 test suites failed, 9 of 38 individual tests failed** (29 passed). Coverage on what did run: 30.4% statements, 17.3% functions. Root cause of the failures is the same missing-module issue as the build (see Dependencies/Code below) — `ts-jest` type-checks on collection, so the unresolved `@service/db/*` imports fail the same way in tests as in `tsc`. Running the suite also triggers a real ~600MB MongoDB binary download via `mongodb-memory-server` on a cold cache — slow but not a defect, just worth knowing before re-running this repeatedly in CI.

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

- **`npm ci` fails outright**: `package-lock.json` is out of sync with `package.json` (missing 4 `@typescript-eslint/*`-related lockfile entries). `npm install` works around it but this means no fresh clone has been able to do a clean, reproducible install for some time.
- **`npm run build` fails** with 17 TypeScript errors across 14 files: 9 are the missing `@service/db/{auth,user}.service` modules (see `ARCHITECTURE.md`); 1 is `@types/express ^5.0.0` installed against `express ^4.21.1` (type-only major-version mismatch breaking the error-handler middleware overload in `setupServer.ts`); 1 is a duplicate-nested-dependency type conflict between `@bull-board/express`'s internal `@bull-board/api` and the top-level one (`base.queue.ts`); the rest cascade from test files importing the same missing modules, plus `supertest` being used in `src/test/routes.test.ts` without being declared in `package.json` at all.
- **`npm run lint:check` cannot run**: `eslint: ^9.0.0` resolves to ESLint v9.x, which requires flat-config `eslint.config.js` and no longer reads the repo's `.eslintrc.json`. Lint has produced zero signal for however long this version drift has existed.
- **48 open `npm audit` vulnerabilities** (3 critical, 20 high, 9 moderate, 16 low) locally as of this audit; GitHub's own Dependabot dashboard reports **134** (2 critical, 64 high, 58 moderate, 10 low) on `develop` — the same kind of GitHub-advisory-count vs. npm-package-count discrepancy documented for repo #1 (`TECHNICAL_DEBT.md` #16 there), not evaluated further here since dependency triage is deferred (see below).
- **16 open bot PRs** (14 Renovate, 1 Dependabot `npm_and_yarn`, 1 more), several well over a year stale — oldest dated 2024-11-20, over a year before this audit. None reviewed/merged yet.
- **1 open human-authored issue** (#3 by number, "Optimize tsconfig.json", opened 2024-09-27 by the repo owner) proposing a stricter `tsconfig.json` rewrite — a legitimate standing TODO, not bot noise.

Given the scope and nature of the build-breaking findings (a missing implementation layer, not just outdated packages), dependency triage for this repo should wait until the central question in `projects/info/be-chatty.md` ("Key open decision") is resolved — merging any of the 16 PRs onto a codebase that doesn't currently build wouldn't produce a meaningful CI signal either way.
