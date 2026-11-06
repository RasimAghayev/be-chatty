# 0001 — Extract duplicated auth-token signing (DRY)

- Status: Accepted
- Date: 2026-11-06
- Phase: 8 (Architecture)

## Context

`src/features/auth/controllers/signin.ts` and `signup.ts` each built the
session JWT independently. Both constructed the exact same payload shape —
`{ userId, uId, email, username, avatarColor }` — and signed it with
`config.JWT_TOKEN!` via `jsonwebtoken`'s `JWT.sign`. This is not a
coincidental resemblance: both are producing the same artifact (a session
token asserting the same five identity claims) for the same purpose
(setting `req.session.jwt` right before responding). The duplication was
real and present, not speculative.

## Decision

Extract the shared logic into a single static helper,
`Helpers.signAuthToken(userId, data)`, in
`src/shared/globals/helpers/helpers.ts` — the file that already hosts the
other small auth-adjacent statics this codebase uses
(`firstLetterUppercase`, `lowerCase`, `generateRandomIntegers`). Both
controllers now call this one function instead of each calling
`JWT.sign` with a hand-copied payload.

`userId` is typed `unknown` deliberately: `signup.ts` passes a freshly
minted `mongodb.ObjectId`; `signin.ts` passes whatever `_id` resolves to
on a looked-up `IUserDocument`. The helper only ever embeds the value in
the signed payload — it never operates on it — so a precise shared type
isn't needed and forcing one would add friction without a benefit.

## Why here (not elsewhere)

- Not placed under `@service/db/*` — that's the deliberately-deferred,
  not-yet-implemented service layer (`docs/TECHNICAL_DEBT.md` #1); adding
  new code there would blur the scope boundary between "hygiene/structure"
  and "new business logic."
- Not extracted into a brand-new file/module — `Helpers` is already the
  de-facto shared bag for small auth-flow utilities, and a single new
  static method is the smallest footprint that removes the duplication
  without introducing a new abstraction layer (KISS/YAGNI).

## Consequences

- One place signs an auth session token instead of two; a future change to
  the claim shape (e.g. adding a new claim) is a one-line change, not a
  two-file hunt for every copy.
- No behavior change: identical payload, identical secret, identical
  `JWT.sign` call — verified against the Phase 7 baseline signature
  (`docs/BASELINE.md`) before and after, byte-for-byte identical.
- `signin.ts` and `signup.ts` each lose a now-unused `jsonwebtoken` import
  (`signin.ts` also loses its now-unused `config` import); `signup.ts`'s
  private `signupToken` wrapper method is deleted outright rather than
  kept as a one-line pass-through, since keeping it would just reintroduce
  a second named thing that does what `Helpers.signAuthToken` already
  does (YAGNI).
