# Changelog

## Leaderboard totals and account-write rate limits (2026-10-17, local session 2)

- Leaderboard scaling (migration 0004, DEC-020): `player_path_xp` keeps XP totals per player and path, maintained by a trigger in the same transaction as each award and backfilled from the ledger; `leaderboard_page()` ranks in SQL and returns only the top N plus the viewer. Ranking rules unchanged and proven equal to `rankLeaderboard()` (random, tie, duplicate, rollback, concurrency, deletion and RLS tests).
- Account writes rate-limited (migration 0005, DEC-021): profile update, onboarding and account deletion, 10 per 10 minutes each, shared across instances; fails closed. Answer and hint limits unchanged.
- Tooling: test `hookTimeout` 60 s for database setup; local Windows clusters initialise as UTF-8.
- Tests: 303 Vitest with PostgreSQL (26 new). XP, curriculum, quests, achievements, encounters and the interface unchanged.

## Local backend session — Windows setup, script CSP, contracts (2026-10-17)

- Script Content-Security-Policy (R-52, I-15): per-request nonce with `strict-dynamic`, sent by the proxy; the static CSP header moved out of `next.config.ts`.
- Windows: content issue paths are POSIX on every OS, `.gitattributes` keeps LF checkouts, `scripts/db/local-postgres.sh` runs the EnterpriseDB binaries from `.local/pgsql`, and the e2e database setup resolves the migrations folder correctly.
- Docs: `docs/API_CONTRACTS.md` (the backend surface for the redesigned interface) and `docs/LOCAL_BACKEND_HANDOFF.md`.
- Unchanged: curriculum, answer checking, XP, progression, quests, achievements, encounters, interface design.

## Onyx preview theme from the owner's Design.docx (2026-10-16)

- New display preference: **Fantasy** (default, unchanged) or **Onyx (preview)** — onyx surfaces, ivory text, one cobalt action colour, Bitcount pixel titles and headings, Inter reading text. Switch on Profile › Appearance or with the top-bar palette button; stored in a cookie, never in the game database (DEC-019).
- Onyx motion: Lenis smooth scrolling, GSAP scroll reveals of zones and trails, Motion spring entrances for rooms, feedback and hints; loaded only in Onyx and off with reduced motion.
- Styling infrastructure: Tailwind CSS v4 (utilities only, mapped to the design tokens) and shadcn/ui (Button), in cascade layers above the existing design system; Fantasy screens verified pixel-identical apart from the new switch.
- Not added from the document: Redis, the Motion AI kit, paid fonts, extra component registries, terminal UI libraries (reasons in `docs/design-input-2026-10-16.md`).
- Tests: 273 Vitest with a database (227 without); 35 Playwright tests (7 new for the theme in `dev-signin`, 2 new on the production build). Runtime audit 0 vulnerabilities.

## Phase 6 — Security, account lifecycle, polish and QA (2026-10-15)

- Audit baseline recorded (`docs/issues.md`): every check green before changes; found and fixed a 97px phone overflow in encounter rooms, an unreachable sticky challenge column on laptops, cramped rooms on landscape tablets and non-HttpOnly Supabase cookies.
- Account deletion (Profile): typed-handle confirmation; game data and the Supabase user deleted in one transaction (nothing deleted if Supabase refuses or the server-only key is missing). Confirmation page.
- Shared per-player rate limit in PostgreSQL (migration 0003, additive) behind a process-local flood guard.
- Hardening: security headers (anti-framing, nosniff, referrer and permissions policies, COOP, HSTS in production); HttpOnly/Secure Supabase cookies; refusal to run with secrets in `NEXT_PUBLIC_*` variables; sign-out for unverified-email sessions; https required for Supabase/app URLs in production except loopback.
- Interface: distinct checkpoint/major/boss seals, mastered halo, won badge, zone progress meters and a map legend; level progress strip (required challenges, XP earned of available, mastery); two-column rooms from 900px; offline notice and Retry; room loading skeleton.
- QA: 26 Playwright tests in two projects — `dev-signin` (19) and `supabase-mock` (7, production build against a local mock of Supabase Auth: Google OAuth and magic-link code paths, sessions, deletion). Every test fails on console errors or failed requests; all 25 rooms checked at phone width.
- Curriculum: generated human-review checklist for all 25 levels (`docs/CURRICULUM_REVIEW_CHECKLIST.md`); validation rejects AI reviewers recorded as human; release gate unchanged (0 of 25 human-reviewed).
- Tests: 270 Vitest with a database (224 without). Runtime audit 0 vulnerabilities. Curriculum, answer checking, XP, progression, quests, achievements and encounter rules unchanged.

## Phase 5 — First playable slice: sign-in, interface and decisions (2026-10-15)

- Decisions recorded (DEC-009 to DEC-013, owner-confirmed): Supabase Auth with Google OAuth and email magic link, verified email, no passwords; 13+ audience with jurisdiction questions documented; distinct AI/human review statuses with human review required for public release; game rules locked; local-first hosting with Supabase and Vercel intended but nothing provisioned. DEC-014 (leaderboard opt-in) proposed.
- Authentication: Supabase integration via `@supabase/ssr` (server-verified sessions, email verification enforced, callback and confirm routes, cookie refresh in `src/proxy.ts`), not connected to a real project yet; development-only sign-in refused in production builds; `requirePlayer()`/`playerForAction()` on every page and server action.
- Onboarding with a neutral 13+ age screen; migration `0002_age_check` stores only the check's outcome; identity-linked players must have passed it.
- Content: `review.kind` is required (no silent "human" default); `CONTENT_RELEASE=public` serves human-reviewed levels only; `npm run content:release-check`.
- Interface: original dark-fantasy design system and SVG art (five zone scenes, ten reward items, icons, medallions); landing, sign-in, onboarding, home, dungeon map, level room (all six challenge formats, feedback, hints, encounter lives and runs, completion), quest journal, collection, leaderboard, profile; loading, empty, error and locked states; responsive with a phone bottom bar; keyboard, focus, reduced-motion and forced-colours support.
- Services (additive): level-room read model with the active encounter run, zones and maximum XP in the player view, quest objective titles, presenter for display-ready results, process-local rate limiter, runtime wiring.
- Tests: 245 Vitest tests with a database (215 without) and 14 Playwright browser tests (auth boundaries, under-13 refusal, persistence across sessions, two-account isolation, no answer leakage, encounter lives, all challenge formats, full path at 2,455 XP, rewards, mobile layout, axe accessibility, reduced motion, exact code display). CI gains an end-to-end job.
- New dependencies: `@supabase/supabase-js` 2.117.2, `@supabase/ssr` 0.12.7, three OFL font packages; dev: `@playwright/test`, `playwright-core` 1.56.1, `@axe-core/playwright` 4.13.0. Runtime audit: 0 vulnerabilities.
- Unchanged: `src/domain` (XP policy, progression, game engine, leaderboard rules), evaluators and all 25 levels.

## Phase 4 — Saved progress and accounts, local first (2026-10-15)

- PostgreSQL schema (`db/migrations/0001_initial.sql`): players, learning progress, append-only XP ledger with database-enforced award-once, idempotent submissions, encounters, checkpoints, quests, achievements, reward items; row-level security on every player table through the non-owner role `code_dungeon_app`; narrow `SECURITY DEFINER` functions for the leaderboard and identity lookup.
- Migration runner (`npm run db:migrate`, `db:status`) with checksums and locking; local throwaway PostgreSQL (`npm run db:local`); CI runs PostgreSQL 16, applies migrations twice and requires the database tests.
- `PostgresPlayerStore` saves learning progress and game state in one transaction with rollback; `PostgresPlayerAccounts` (handles, visibility, identity link, cascade delete); `PostgresLeaderboardSource` (public fields only).
- Services refactored non-breakingly into pure plan steps plus persistence; `GameService` accepts a transactional store and a leaderboard source; in-memory transactional adapter.
- Authentication integration designed (`docs/auth-design.md`); no provider configured.
- New dependency: `postgres` 3.4.9 (zero dependencies). Tests: 207 with a database (178 without; database suites skip).
- Curriculum, evaluation, XP policy, game engine, quests, achievements and leaderboard rules unchanged.

## Phase 3 — Game engine (2026-10-15)

- Pure game engine (`src/domain/game/`): encounter runs for checkpoint, major and boss levels (checkpoints cannot be lost; 3 lives for major/boss; flawless victories), checkpoint records, quests with activation and optional objectives, achievements, cosmetic item rewards, and a read model for journals.
- Deterministic leaderboard ranking with documented tie-breaking and competition ranks, viewer rank, visibility and limits; public-handle validation and uniqueness (DEC-006).
- `GameService` derives every game event from verified `LearningService` results; idempotent per submission id with conflict recovery; quests and achievements re-derived from verified progress and awarded once. In-memory game store and player directory, flagged non-persistent.
- Content: 6 quests and 11 achievements for Python Fundamentals, all proven reachable by a full playthrough; additive schema predicates; validation of game references and of reward XP (rewards are cosmetic; DEC-005).
- `LearningService` additions (non-breaking): progress snapshot for server-side engines and per-level review status in the path view.
- XP policy, curriculum, evaluation and prerequisite rules unchanged (maximum path XP still 2,455).
- Tests: 174 (from 122). No new dependencies, database, authentication, external services or cloud resources.

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
