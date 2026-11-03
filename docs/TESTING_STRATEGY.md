# Testing strategy

Written 2026-11-03 as the Phase 5 deliverable per `PROMPT.md`. See `docs/IMPROVEMENT_ROADMAP.md` for this repo's scope decision (hygiene/config only — the auth feature's missing `@service/db/{auth,user}.service` layer is deliberately not implemented here) and `docs/TECHNICAL_DEBT.md` for the full debt ledger this report cross-references.

## Approach

Jest 29 (`ts-jest`) unit/integration tests, run via `npm test` (`jest --coverage --passWithNoTests -w=4 --forceExit --detectOpenHandles --watchAll=false --noStackTrace`). No new tests were written in this phase — per the approved Phase 2.6 plan, writing tests for the missing `@service/db/*` layer is out of scope (that layer doesn't exist; tests for it would be tests for code that was never written). This phase's job was to get accurate, verified numbers and document *why* each existing suite passes, fails, or can't run at all — not to paper over any of it with skips or mocks replacing real logic.

**Mocking:** existing suites already mock at the right boundary — `jest.mock()` on `mongoose`/`ioredis`/external services in unit tests, nothing mocked in the schema-level test that talks to a real (in-memory) Mongo instance. Nothing was changed here.

## Verified result (2026-11-03, Node v26.12.1, this sandbox)

```
Test Suites: 13 failed, 5 passed, 18 total
Tests:       9 failed, 31 passed, 40 total
```

This is a **real, freshly re-run** number — not copied from the TECHNICAL_DEBT.md #13 narrative written earlier in this pass, which is why the breakdown below doesn't match that entry's "29/31" figure exactly (see "Divergence from the #13 narrative" below).

## Why each failure happens

| Suite | Outcome | Root cause |
|---|---|---|
| `auth.schema.test.ts` (7 tests) | All fail: `Exceeded timeout of 5000 ms for a hook` | `mongodb-memory-server` downloads a ~600 MB mongod binary on first use in this sandbox; the download alone takes longer than Jest's default 5 s hook timeout. **Reproduced twice, same failure both times** — not a one-off flake, but an environment/network-dependent cost, not an app bug. |
| `setupDatabase.test.ts` (1 test) | Fails: `TypeError: Cannot read properties of undefined (reading 'on')` | Pre-existing test-design bug — the `mongoose` auto-mock doesn't stub `.connection.on`. Unrelated to this phase's hygiene work. |
| `app.test.ts` (1 test) | Fails: `Matcher error: received value must be a mock or spy function` | Pre-existing bad assertion — asserts on a value that was never a mock. Unrelated to this phase's hygiene work. |
| `auth.worker.test.ts`, `user.worker.test.ts`, `signup.test.ts`, `signin.test.ts`, `password.test.ts`, `current-user.test.ts` (controllers), `routes.test.ts` | Suite fails to run: `TS2307 Cannot find module '@service/db/{auth,user}.service'` | The documented, in-scope P0 gap (TECHNICAL_DEBT.md #1) — the db service layer this phase deliberately didn't write. |
| `auth-middleware.test.ts` | Suite fails to run: `TypeError: Cannot read properties of undefined (reading 'prototype')` | Node v26 runtime incompatibility with a transitive dependency, surfaced only once lint/build were clean enough for the suite to actually load (TECHNICAL_DEBT.md #13). |
| `setupServer.test.ts` | Suite fails to run: `TypeError: argument fn must be a function` | Same class of Node-version incompatibility (`express`/`depd` internals), TECHNICAL_DEBT.md #13. |
| `email.worker.test.ts` | Suite fails to run: `Your test suite must contain at least one test` | Empty stub file — never had a test body. Pre-existing, unrelated to this phase. |

## What passes (5 suites, 31 tests)

`auth.queue.test.ts`, and the Joi schema suites (`signup`, `signin`, `password` under `src/features/auth/schemes/test/`), plus `signout.test.ts` — all suites that don't import the missing `@service/db/*` modules and don't depend on a real Mongo/Redis connection or a Node-version-sensitive code path.

## Divergence from the TECHNICAL_DEBT.md #13 narrative

Item #13 (written earlier in this pass) reported "29/31 runnable tests pass, 2 fail" and noted `mongodb-memory-server`'s mongod binary failed to spawn (`EFTYPE`) in that sandbox run, so `auth.schema.test.ts` couldn't run at all. In this verification pass, the binary *did* download (progress logged to console) but the download itself blew the 5 s hook timeout, so the suite ran and failed 7 tests instead of not running. Net effect: 31 tests pass in both runs (nothing regressed), but the fail count and the specific reason for `auth.schema.test.ts` differ by environment/network conditions on the day — a real example of why this phase re-verified rather than trusting the earlier note. `docs/TECHNICAL_DEBT.md` #13 has been updated to point here for the current numbers rather than carrying its own, now-superseded count.

## What is deliberately not tested

- **The missing `@service/db/{auth,user}.service` layer** — doesn't exist; out of scope by the approved Phase 2.6 plan.
- **Real MongoDB/Redis integration beyond what `auth.schema.test.ts` already attempts** — that one in-memory-Mongo suite is the extent of DB-level testing in this repo; adding more would mean writing against the missing service layer above.
- **RabbitMQ/Bull queue broker internals** — `auth.queue.test.ts` already mocks `bull`/`ioredis` at the right boundary; testing the broker itself would test the library, not this repo's code.

## Running the suite

```bash
npm ci
npm run lint:check
npm run prettier:check
npm test
```

All four now run automatically in `.github/workflows/ci.yml` on every push/PR to `main` — lint and prettier are a blocking gate; test (and `npm run build`) run for real signal but are non-blocking until the gaps above are closed (see that workflow's comments).
