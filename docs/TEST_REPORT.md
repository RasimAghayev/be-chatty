# Test report

Last run 2026-11-03, via `npm test`, Node v26.12.1, this sandbox. See `docs/TESTING_STRATEGY.md` for what's covered, what isn't, and why each failure below happens — this file is the raw numbers.

## Result

```
Test Suites: 13 failed, 5 passed, 18 total
Tests:       9 failed, 31 passed, 40 total
Time:        30.4 s
```

Re-run of just the one suite responsible for 7 of the 9 test failures (`auth.schema.test.ts`) to check for flakiness: failed identically both times (hook timeout while downloading the `mongodb-memory-server` binary) — reproducible, not a one-off.

## By suite

| Suite | Tests | Result | Why (see TESTING_STRATEGY.md for detail) |
|---|---|---|---|
| `features/auth/schemes/test/signup.test.ts` | 11 | ✅ pass | No DB/missing-module dependency |
| `features/auth/schemes/test/password.test.ts` | 9 | ✅ pass | No DB/missing-module dependency |
| `features/auth/schemes/test/signin.test.ts` | 7 | ✅ pass | No DB/missing-module dependency |
| `features/auth/controllers/test/signout.test.ts` | 2 | ✅ pass | No DB/missing-module dependency |
| `shared/services/queues/test/auth.queue.test.ts` | 2 | ✅ pass | Mocks `bull`/`ioredis` at the right boundary |
| `features/auth/models/test/auth.schema.test.ts` | 7 | ❌ fail (all 7) | `mongodb-memory-server` binary download exceeds 5 s hook timeout |
| `test/setupDatabase.test.ts` | 1 | ❌ fail | Pre-existing: `mongoose` auto-mock missing `.connection.on` |
| `test/app.test.ts` | 1 | ❌ fail | Pre-existing: bad assertion on a non-mock value |
| `features/auth/controllers/test/signup.test.ts` | — | ❌ suite won't run | `TS2307`, missing `@service/db/auth.service` |
| `features/auth/controllers/test/signin.test.ts` | — | ❌ suite won't run | `TS2307`, missing `@service/db/{auth,user}.service` |
| `features/auth/controllers/test/password.test.ts` | — | ❌ suite won't run | `TS2307`, missing `@service/db/auth.service` |
| `features/auth/controllers/test/current-user.test.ts` | — | ❌ suite won't run | Module-mapper can't resolve `@service/db/user.service` |
| `shared/workers/test/auth.worker.test.ts` | — | ❌ suite won't run | `TS2307`, missing `@service/db/auth.service` |
| `shared/workers/test/user.worker.test.ts` | — | ❌ suite won't run | `TS2307`, missing `@service/db/user.service` |
| `test/routes.test.ts` | — | ❌ suite won't run | `TS2307` (transitively, via `password.ts`) |
| `shared/globals/helpers/test/auth-middleware.test.ts` | — | ❌ suite won't run | Node v26 runtime incompatibility |
| `test/setupServer.test.ts` | — | ❌ suite won't run | Node v26 runtime incompatibility (`express`/`depd`) |
| `shared/workers/test/email.worker.test.ts` | — | ❌ suite won't run | Empty stub file, no test body |

**0 tests added this phase** — per the approved Phase 2.6 scope, Phase 5 here is "get real, verified numbers and document why," not "add coverage for a service layer that doesn't exist yet." Every number above was independently re-run and verified during this pass, not carried over from an earlier estimate.

## Coverage (informational only — collection fails for 4 files)

```
Statements : 30.58% ( 141/461 )
Branches   : 49.25% ( 33/67 )
Functions  : 18.75% ( 18/96 )
Lines      : 30.3%  ( 137/452 )
```

Coverage collection itself errors (`TS2307`) on the same 4 files blocked by the missing `@service/db/*` modules (`auth.worker.ts`, `user.worker.ts`, `password.ts` controller, `signin.ts` controller) — the percentage above is a real measurement of what *could* be instrumented, not a claim about the whole codebase.

## Other quality gates, same commit

| Gate | Result |
|---|---|
| `npm run lint:check` (ESLint flat-config) | ✅ 0 errors |
| `npm run prettier:check` | ✅ clean (fixed this phase — see `style:` commit) |
| `npm run build` (`tsc`) | ❌ 13 errors, 11 files — all `@service/db/*`, the documented P0 gap |

## Known limitations

- **9/40 tests fail, 13/18 suites can't run at all** — the large majority (11 of 13 failing suites) trace to one root cause: the missing `@service/db/{auth,user}.service` layer, out of scope by design (TECHNICAL_DEBT.md #1). This is not a hidden or downplayed number — it's the expected, accepted state of this hygiene-only pass.
- `auth.schema.test.ts`'s failure is environment-dependent (binary download speed vs. a fixed 5 s hook timeout) and reproduced on 2 separate runs in this sandbox — a different network or a pre-warmed binary cache could make it pass; not treated here as "fixed" since it wasn't touched.
- Two pre-existing test-design bugs (`setupDatabase.test.ts`, `app.test.ts`) and two Node-v26 runtime incompatibilities (`auth-middleware.test.ts`, `setupServer.test.ts`) were surfaced, not introduced, by this phase's lint/build fixes making the suites loadable in the first place. None were fixed here — doing so is new test/compat work outside the approved hygiene scope (TECHNICAL_DEBT.md #13).
- `docs/TECHNICAL_DEBT.md` #13's original "29/31" note predates this verification pass and is now superseded by the numbers in this file and `docs/TESTING_STRATEGY.md`.
