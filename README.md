# be-chatty

Node.js/TypeScript backend for a course-based MERN chat/social-network application. This repository currently contains the backend service scaffold and an implemented auth feature surface (routes, controllers, schemas, workers, queues) but is **not** a production-ready or fully runnable application in its current state.

## Current status

- **Runtime stack:** Node.js `>=26.13.0 <27` (see `package.json`/`.nvmrc`), TypeScript, Express 5, Mongoose/MongoDB, Redis, Bull queues, Socket.IO, JWT/cookie-session auth helpers.
- **Implemented area:** auth-related HTTP routes/controllers/schemes, queue/worker infrastructure, email templates, and supporting shared utilities.
- **Known baseline gap (P0, pre-existing):** `src/shared/services/db/auth.service.ts` and `src/shared/services/db/user.service.ts` are missing. TypeScript build and most tests fail because imports to `@service/db/*` cannot be resolved (see `docs/TECHNICAL_DEBT.md` #1, `docs/BASELINE.md`, `docs/IMPROVEMENT_ROADMAP.md`).
- **Docker baseline:** multi-stage `Dockerfile`, `docker-compose.yml`, and `Makefile` are present, but `make verify` / runtime image build are red because of the documented baseline gap above. Do not treat a successful `docker compose config` or dependency install as proof the app runs.

## Repository layout

- `src/` — application source (`features/auth`, `shared/*`, server/bootstrap, mocks/tests colocated by area)
- `docs/` — architecture, audit, baseline, roadmap, testing, technical debt, ADRs
- `enpoints/auth.http` — sample HTTP requests for auth endpoints
- `docker-compose.yml` — local app + MongoDB/Redis (+ UI) services
- `Dockerfile`, `Makefile` — container build/test targets

## Prerequisites

- Docker + Docker Compose v2 (recommended verification path)
- GNU Make (for `make` targets)
- Node.js/npm only if running host scripts intentionally; host runs are not verification evidence for this repo

## Environment

Copy `.env.example` to a local `.env` only for local development and fill placeholders as needed. `.env` files are gitignored.

Key variables (see `.env.example` for the full list/placeholders):

- App: `SERVER_PORT`, `NODE_ENV`, `CLIENT_URL`
- Auth/session: `JWT_TOKEN`, `SECRET_KEY_ONE`, `SECRET_KEY_TWO`
- Data/services: `DATABASE_URL`, `REDIS_URL`
- Compose credentials/ports: `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, `REDIS_PASSWORD`, `APP_HOST_PORT`, `MONGO_HOST_PORT`, `MONGO_UI_HOST_PORT`, `REDIS_HOST_PORT`, `REDIS_UI_HOST_PORT`
- Integrations: Cloudinary, SMTP/SendGrid placeholders

Reserved local compose ports (defaults): `20050` app, `20051` mongo, `20052` mongo UI, `20053` redis, `20054` redis UI (`projects/info/state/ports.md` context).

## Docker / Make usage

All verification should be done in Docker.

```bash
make help
make lint      # eslint via deps image
make format    # prettier --check via deps image
make test      # docker build --target test (runs jest in container)
make verify    # test + build + runtime build chain (currently expected to fail: baseline red)
make up        # depends on verify; will fail while baseline is red
make down
make logs
make clean     # removes local build/coverage; CONFIRM=1 also removes containers/images/volumes
```

Notes:
- `make verify` is the authoritative Docker gate. Current documented baseline: exit non-zero due pre-existing TS/build/test failures (see `docs/BASELINE.md`).
- `make up` depends on `make verify` and cannot succeed until the baseline P0 is resolved.
- Compose service names include `app`, `mongo`, `mongo-ui`, `redis`, `redis-ui`; see `docker-compose.yml` for healthchecks and dependencies.

## Local npm scripts

Defined in `package.json` (primarily for development/CI contexts):

- `npm run dev` / `npm run dev:mac` — nodemon + tsconfig-paths (requires dependencies/services configured)
- `npm run lint:check` / `npm run lint:fix`
- `npm run prettier:check` / `npm run prettier:fix`
- `npm test` — Jest with coverage flags (`--forceExit --detectOpenHandles`)
- `npm run build` — `tsc` + `tsc-alias` (currently fails on missing `@service/db/*` modules)

## API / endpoints

Routes are mounted under `/api/v1` (see `src/routes.ts`):

- Auth: signup, signin, signout, forgot/reset password (exact handlers/routes in `src/features/auth/routes/`)
- Current user: protected route(s) behind `authMiddleware.verifyUser`
- Bull Board UI: `/queues`

Example requests are provided in `enpoints/auth.http` (note directory name spelling is `enpoints/` in this repo).

## Testing and quality

- Test framework: Jest + ts-jest + Supertest (`jest.config.ts`)
- Current verified baseline and per-suite status: `docs/BASELINE.md`, `docs/TEST_REPORT.md`, `docs/TESTING_STRATEGY.md`
- Known limitations and deferred items: `docs/TECHNICAL_DEBT.md`, `docs/IMPROVEMENT_ROADMAP.md`
- CI workflow on this branch: `.github/workflows/ci.yml` (lint/prettier and other jobs as configured there)

## Documentation

- `docs/ARCHITECTURE.md` — implemented architecture and request flow
- `docs/REPOSITORY_AUDIT.md` — audit findings
- `docs/TECHNICAL_DEBT.md` — tracked debt (including P0 build/test blockers)
- `docs/IMPROVEMENT_ROADMAP.md` — planned phases/scope decisions
- `docs/BASELINE.md` — Docker-verified behavior contract
- `docs/TESTING_STRATEGY.md`, `docs/TEST_REPORT.md` — test approach and recorded results
- `docs/adr/` — architecture decision records

## Security

- Do not commit secrets, tokens, `.env` files, or private keys. Use `.env.example` placeholders only.
- See `SECURITY.md` for vulnerability reporting guidance.

## Contributing

See `CONTRIBUTING.md` for development workflow, verification expectations, and pull request guidance.

## License

No `LICENSE` file is currently present in this repository. License status should be treated as unspecified until one is added explicitly.
