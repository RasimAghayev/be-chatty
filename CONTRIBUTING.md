# Contributing to be-chatty

Thank you for contributing. This repository is in an incremental remediation state; please keep changes scoped, evidence-based, and consistent with existing docs.

## Before you start

- Read `README.md`, `docs/ARCHITECTURE.md`, `docs/TECHNICAL_DEBT.md`, and `docs/BASELINE.md`.
- Do not treat host-only runs as verification. Use Docker/Make targets for build/test verification where applicable.
- Do not introduce or commit secrets (`.env`, tokens, keys, credentials). Use `.env.example` placeholders only.

## Development workflow

1. Create a focused branch for your change.
2. Make the smallest coherent change that addresses the issue.
3. Update documentation when behavior, commands, configuration, or known limitations change.
4. Run relevant checks in Docker and record outcomes.

Common commands:

```bash
make lint
make format
make test
make verify
```

Current baseline is red due a documented pre-existing gap (`@service/db/{auth,user}.service` missing). If your change does not address that gap, do not claim it is fixed; report whether results match or regress from the documented baseline.

## Code and commit guidelines

- Follow existing project structure and conventions.
- Prefer clear, maintainable changes over broad refactors unrelated to the task.
- Use Conventional Commits for commit messages (for example: `docs: ...`, `fix: ...`, `refactor: ...`).
- Keep commits logically scoped.
- Do not add AI attribution trailers or markers to commits, PR titles/descriptions, or comments.

## Pull requests

Include in your PR description:

- What changed and why
- Scope/limitations (what was intentionally not changed)
- Verification commands run and their outcomes (Docker-based when applicable)
- Links/references to relevant docs or debt items (for example `docs/TECHNICAL_DEBT.md` #1)

If CI is red for known pre-existing baseline reasons, explain that explicitly and distinguish it from regressions introduced by your change.

## Reporting issues

- For security issues, follow `SECURITY.md` instead of opening a public issue with sensitive details.
- For bugs or documentation gaps, include reproduction steps, expected vs actual behavior, environment details, and relevant logs/output (with secrets redacted).
