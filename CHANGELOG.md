# Changelog

## Phase 2 — Learning engine (2026-10-15)

- Content schema v2: lesson objectives, multiple worked examples, practical context, level descriptions, challenge roles (exercise / knowledge check), three progressive hints, and runnable checks for fill-in, ordering, tracing and bug-fix challenges.
- Evaluators for multiple choice, predict-the-output, fill-in-the-blank, arrange-the-lines, trace and find-the-bug, with an extensible registry; distinct outcomes for correct, incorrect, invalid submission and evaluation error; feedback that never reveals answers before they are solved.
- Progression domain (pure): unlocks, attempted/correct/completed/mastered states, hint tiers, XP ledger with award-once keys, replay policy and progression events; central configurable policy (DEC-002).
- Learning service boundary with strict request validation, idempotent submissions, server-side judging and XP, and a clearly non-durable in-memory progress store.
- Validation now reports file › level › field and checks reachability, the starting level, hint sequences, evaluator coverage, misconception keys and knowledge checks; Python verification now also runs fill-in variants, accepted line orders, trace values, and both buggy and fixed programs.
- Authored all 25 Python Fundamentals levels in the owner's topic order (DEC-003): 140 runnable claims verified with CPython 3.13.16; agent-reviewed, human review pending (DEC-004).
- Tests: 122 (from 47), including a full playthrough of levels 1–25 through the service.
- No authentication, database, leaderboard, hosted code execution, paid APIs, new dependencies or cloud resources.

## Phase 1 — Foundation (2026-10-15)

- Added the Next.js 16 / React 19 / TypeScript application skeleton with an honest "under construction" home page that reads real counts from content data.
- Added ESLint (with layer-boundary rules), Prettier, TypeScript type checking, Vitest (47 tests) and a GitHub Actions CI workflow (no deploy step).
- Added the learning-engine content model: Zod schemas for paths, zones, levels, lessons, seven challenge types, quests, achievements and sources; YAML loader; cross-reference validator and publication gate; public projection that withholds answer keys; server-only key access.
- Added `content:validate` and `content:verify-python` (runs curriculum examples and predict-output answers with a real CPython interpreter).
- Added the Python Fundamentals path skeleton: 5 zones and 25 draft level outlines (no lessons published).
- Added test fixtures covering every challenge type and a generated synthetic 100-level path.
- Added a disabled `CodeRunner` (learner code is never executed), `.env.example` (names only), `content/README.md`, `docs/phase-1-report.md`; recorded DEC-001 in `docs/decision.md`.
- No authentication, database, leaderboard, hosted execution, paid APIs or cloud resources.

## Phase 0 — Repository audit (2026-10-15)

- Added `docs/initial-audit.md`: verified repository state (documentation only; no application code, manifests, tests, CI or legacy prototype files), baseline checks and documentation reconciliation.
- Added `docs/architecture-proposal.md`: proposed stack, three-layer architecture, data/trust model, leaderboard, 25→100 level scaling and Python execution options (PROPOSED, not owner-approved).
- Added `docs/risk-register.md` and `docs/next-steps.md` (recommended next phase and open owner decisions).
- Annotated P-001 in `docs/decision.md` with the audit evidence; no confirmed decision changed.
- No application code, dependencies, secrets or external resources were added.

## Documentation pack v1

- Added root `CLAUDE.md` persistent project instructions.
- Added owner decision register, 0-to-100 rebuild handbook, execution phases and workflow.
- Added data model, content quality, security/privacy, testing/acceptance, audit seed and implementation plan docs.
- Included existing product blueprint, visual direction, Claude cloud setup note and owner-supplied visual references.
- No application source code or cloud infrastructure was changed by generating this documentation pack.
