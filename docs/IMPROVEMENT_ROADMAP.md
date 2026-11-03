# Improvement roadmap — Phases 3-5 plan for this repo

This is the Phase 2.6 plan: how Phases 3-5 (`PROMPT.md`) apply here, with risks. **Shown for approval before Phase 3 starts** (`CLAUDE.md` Approval Gate #10 — "the Phase 2 plan for each repo").

**Scope decision (already made, by you):** this repo's central defect — the auth feature's missing `@service/db/{auth,user}.service` implementation — will **not** be written as part of this workflow. That's new business logic, not a fix, and you chose to scope this pass to hygiene/config only. `npm run build` is expected to still fail afterward, for one clean, documented reason instead of four conflated ones. This is tracked as a known, accepted limitation throughout — not something later phases should silently try to "complete."

## Phase 3 — Git and repo hygiene

1. **History audit — already done** (see `REPOSITORY_AUDIT.md`). Finding: clean, no real secret ever committed (`.env_prod` has only ever held placeholders, confirmed via full `git log --all -p`). Nothing requiring Approval Gate #1.
2. **Dependency bot PRs (16 total):** triage after the lockfile desync is fixed (3.x below) and the hygiene-level build/lint fixes land — several of the 16 bump packages involved in the build errors themselves (`@typescript-eslint/*`, `mongodb-memory-server`, `@bull-board/*`), so fixing those by hand first, then re-checking whether the matching bot PR is now redundant or still needed, avoids duplicate/conflicting work. Several PRs are ~2 years stale; expect some to need a manual rebase (`gh pr update-branch`) same as repo #2, and some security-labeled ones (`cloudinary`, `nodemailer`, `mongoose`, `joi`, `lodash`) to be prioritized first.
3. **Open PRs:** covered by 3.2 — all 16 are the bot PRs above; the 1 open issue (#3, "Optimize tsconfig.json") is a legitimate owner TODO, addressed in Phase 4 below, not here.
4. **Branches:** delete bot branches as their PRs are merged/closed, same pattern as repo #2. `staging` branch: no distinct purpose found — will ask before deleting it, in case it's intentionally kept.
5. **Branch structure:** default branch is `develop`, not `main`. **Renaming it is Approval Gate #4 — separate from this plan's approval, will ask explicitly when this point is reached, not assumed here.**

## Phase 4 — Modernization and independence

1. **Dependency upgrades:** handled via Phase 3.2's bot-PR triage; no additional manual upgrades planned beyond what's needed to fix the hygiene issues below.
2. **Bugs, security, performance — hygiene-scoped fixes only:**
   - Fix `package-lock.json`/`package.json` desync (`npm install` to resync, commit).
   - Migrate ESLint config to flat-config (`eslint.config.js`) for the installed v9, or pin `eslint` back to `^8.x` to match the existing `.eslintrc.json` — will pick whichever is less disruptive once I'm in the code, default leaning flat-config since that's the forward-compatible fix.
   - Pin `@types/express` to the `^4.17.x` line to match the actual `express@^4.21.1` runtime dependency, resolving the `setupServer.ts` type error.
   - Resolve the `@bull-board/express` vs. top-level `@bull-board/api` duplicate-nested-version type conflict (likely an `overrides` entry in `package.json`, or aligning both to the same version).
   - Add `supertest` (+ `@types/supertest`) as a devDependency since `src/test/routes.test.ts` already imports it.
   - **Expected result:** build error count drops from 17 to roughly 9 (the missing `@service/db/*` modules only) — the one, isolated, documented gap. This is the plan's success condition for this phase, not a fully green build.
   - Rename `.env_prod` → `.env.example`, ensure no `.env*` is tracked going forward.
   - Move the hardcoded `docker-compose.yml` credentials (Mongo root/root, Redis password) to env-var substitution.
3. **Docker:** no app Dockerfile exists; not adding one in this pass since the app doesn't build yet — would be a Phase 4 item to revisit once/if the core gap is addressed in a future, separate decision.
4. **Dual-mode independence:** `.env.example` (renamed from `.env_prod`) already covers most of what's needed; will verify it's complete once the hygiene fixes land. `/health` endpoints: not currently present — will check `setupServer.ts` while in there for the `@types/express` fix and flag as a separate small addition if trivial, not forced.
5. **Observability:** `bunyan` logging already exists; the commented-out file-rotation block in `config.ts` is dead code — will clean it up (remove, not enable, since no decision was made to add file-based log persistence).
6. **Quality tooling:** ESLint v9 migration done. **Done (2026-11-03):** `prettier:check` had never actually been run/verified — 57 files failed it; fixed via `prettier:fix` (2 genuine reflow changes, 55 pure Windows-checkout CRLF noise with zero real diff, confirmed by re-adding and checking against `HEAD`). See `docs/TECHNICAL_DEBT.md` #14.
7. **CI/CD — done (2026-11-03):** added `.github/workflows/ci.yml`. Shape chosen: install + lint + prettier is a **blocking** gate (all verified clean); `npm test` and `npm run build` also run, for real signal, but with `continue-on-error` plus a warning annotation — neither is silently green nor makes the workflow permanently red for the documented #1/#13 gaps. Also fixed `codeql.yml`, whose push/PR triggers still pointed at the pre-rename `develop` branch (TECHNICAL_DEBT.md #15).

## Phase 5 — Tests

1. **Original state:** 14/18 suites fail, 9/38 tests fail — same root cause as the build.
2. **Verified final state (2026-11-03, independently re-run, not estimated):** 13/18 suites fail, 9/40 tests fail. The large majority (11 of 13 failing suites) trace to the one documented, in-scope gap (missing `@service/db/*`); the rest are pre-existing test-design bugs or Node-v26 runtime incompatibilities, surfaced rather than caused by this pass's lint/build fixes. Full breakdown in `docs/TEST_REPORT.md` / `docs/TESTING_STRATEGY.md`.
3. **Not done, by design:** no new tests written for the missing service layer, since that layer itself is out of scope per this plan's scope decision.
4. `docs/TEST_REPORT.md` and `docs/TESTING_STRATEGY.md` record the real, re-verified numbers — not an assumed "tests now pass," and not a copy of the earlier TECHNICAL_DEBT.md #13 estimate, which is now superseded.

## Net new risks introduced by this plan

- Nothing proposed here touches the auth feature's existing (working) HTTP/validation/routing logic — only dependency versions, lint config, type declarations, and file renames/cleanup.
- **One item needs its own separate approval when reached, not covered by approving this plan as a whole:** renaming the default branch `develop` → `main` (Gate #4).
- **The accepted, standing limitation:** this repo will not build cleanly at the end of this pass. That's a deliberate scope decision (not implementing the missing business logic), tracked in `TECHNICAL_DEBT.md` #1 as "Not done — awaiting your decision" until/unless you decide otherwise in a future session.
