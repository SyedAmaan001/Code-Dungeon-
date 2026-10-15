# Code Dungeon — Architecture Proposal

- **Status:** PROPOSED (agent recommendation, 15 October 2026). Not an owner decision. Nothing here is implemented.
- **Inputs:** `CLAUDE.md`, `docs/decision.md`, `docs/00_TO_100.md`, `docs/PRODUCT_BLUEPRINT_AND_MASTER_PROMPT.md`, `docs/EXECUTION.md`, `docs/WORKFLOW.md`, `docs/DATA_MODEL.md`, `docs/SECURITY_AND_PRIVACY.md`, `docs/VISUAL_DIRECTION.md`, and the verified audit in `docs/initial-audit.md`.
- **Respects:** D-001…D-012 (confirmed) and defaults R-001…R-007. Where this proposal goes beyond them it says so and lists the item under "Open decisions" in `docs/next-steps.md`.
- **After approval:** promote §3–§8 to `docs/architecture.md` and §6 to `docs/data-model.md` (or extend `DATA_MODEL.md`), and record the stack choice as a `DEC-` entry in `docs/decision.md`.

- **Implementation status (2026-10-15):** the foundation (§2 core tooling, §3 layout and boundaries, §4 content model) is implemented — see `docs/phase-1-report.md` and DEC-001. Differences from this proposal: TypeScript pinned to 6.0.3 and ESLint to 9.x (newer majors not yet supported by `typescript-eslint`/Next lint plugins); Tailwind, Radix, Shiki, Supabase, Drizzle and Playwright deferred until needed; levels gained an optional draft-only `outline` field; predicates gained `complete_level_count`; `sources.yaml` lives inside each pack; Python examples may declare `expectedException`.
- **Implementation status (Phase 2, 2026-10-15):** §4 learning engine (schema v2, six evaluators, feedback, hints, validation, real-Python verification), §5.1/§5.2 progression (unlocks, attempts, completion, mastery, XP ledger, replay) and the §6.3 submission flow are implemented against a non-durable in-memory store — see `docs/PHASE_2_REPORT.md`, DEC-002 and DEC-004. Mastery is defined more precisely than §5 (demonstrated knowledge checks). Quests, achievements, the leaderboard, the database and authentication are not implemented.

---

## 1. Starting point

The repository contains documentation only (see `docs/initial-audit.md`). There is no existing stack to preserve, so per R-001 we choose a maintainable default. The recommendation below is the blueprint's suggested default, made concrete, with the specific security design the blueprint implies but does not spell out.

## 2. Recommended technology stack

| Concern | Recommendation | Why | Alternatives considered |
|---|---|---|---|
| Language | **TypeScript** (strict) end to end | One language for content schemas, domain engine, server and UI; types make the three-layer contracts explicit | Python backend + JS frontend (two toolchains, duplicated types) |
| App framework | **Next.js (App Router)**, current stable major pinned at scaffold time | Full-stack React with server components, route handlers and server actions in one deployable; widely hosted; matches blueprint default; `server-only` imports let us keep answer keys out of the browser bundle | Remix/React Router (fine, smaller ecosystem for hosting presets); Vite SPA + separate API (two deployables) |
| Runtime / package manager | **Node 22 LTS** (installed in the cloud sandbox) with **npm** and a committed `package-lock.json`; `engines` field pinned | npm ships with Node — fewest moving parts for an owner on Windows and for cloud sessions; pnpm is also available if the owner prefers | pnpm (faster, stricter; fine choice), bun (less conservative) |
| Styling | **Tailwind CSS** + CSS custom-property design tokens taken from `VISUAL_DIRECTION.md` | Tokens let the art direction evolve without touching game/learning logic; Tailwind keeps layout fast | CSS Modules only (fine, more boilerplate) |
| Accessible primitives | **Radix UI** primitives (dialog, tabs, popover, radio group, toast) where needed | Keyboard/focus/ARIA handled by a mature library; we style them ourselves to the fantasy look (not a SaaS kit look) | React Aria (also good) |
| Validation | **Zod** | One schema library for content files, API inputs and view models | Valibot, TypeBox |
| Content format | **YAML files per level** in a content pack, parsed by `yaml`, validated by Zod, compiled at build time | Human-reviewable diffs in PRs; multi-line code blocks are readable; no CMS needed for 25–100 levels | MDX (mixes rendering into content), JSON (poor for code/prose), a CMS (extra service) |
| Code display | **Shiki** for static syntax highlighting | Build/server-time highlighting, no runtime editor needed for non-execution challenges | CodeMirror 6 — add only when a real code-writing challenge exists |
| Auth | **Supabase Auth** (managed), via `@supabase/ssr` cookie sessions | Managed password/magic-link/OAuth, no custom crypto (CLAUDE.md); integrates with Postgres RLS | Auth.js / Better Auth on our own Postgres (library-managed, more of our code); Clerk (second vendor) |
| Database | **PostgreSQL** (Supabase-managed when hosted; local PostgreSQL 16 for tests) | Relational constraints fit the progress/XP ledger and leaderboard; unique constraints implement idempotency | Firebase/Firestore (weak for ledgers/joins) |
| DB access | **Drizzle ORM** (query builder + types) over the `postgres` driver, from server code only; **SQL migrations** under `supabase/migrations/` as the single source of truth | Typed queries; plain SQL migrations are reviewable and carry RLS policies/grants natively | Supabase JS client for all writes (couples domain to PostgREST); Prisma (heavier, weaker RLS story) |
| Unit/integration tests | **Vitest** | Fast, TS-native | Jest |
| E2E tests | **Playwright** (Chromium already in the sandbox) | Covers signup→play→save→leaderboard flows | Cypress |
| Lint/format | ESLint (Next config) + Prettier; `tsc --noEmit` | Standard | Biome (fine; fewer Next-specific rules) |
| CI | GitHub Actions: lint, typecheck, unit, content validation, Python example verification, integration (service Postgres), build | Free for public repos / included minutes for private; no deploy step until a cloud plan is approved | — |
| Map / atmosphere | HTML + **SVG** paths and nodes over optimised 2D backdrops (AVIF/WebP), CSS motion with `prefers-reduced-motion` | Matches R-006; accessible DOM controls for nodes | Canvas/Pixi (later, only if needed), 3D (out of scope) |

Not proposed: microservices, Redis, a separate API server, GraphQL, a state-management library (server state + React is enough), a CMS, an AI/RAG layer, Kubernetes, GPUs.

## 3. Layered architecture

```text
┌──────────────────────── World / interface layer (React) ───────────────────────┐
│ routes: / (home) /map /level/[id] /journal /profile /leaderboard /auth/*        │
│ components: WorldMap, MapNode, RoomPanel, ChallengeRenderer(type→component),    │
│             FeedbackPanel, QuestJournal, LeaderboardTable                       │
│ theme packs: zone art, node layouts, tokens  (no curriculum or scoring logic)   │
└───────────────▲─────────────────────────────────────────────┬──────────────────┘
                │ typed view models (no answer keys)          │ user intents
┌───────────────┴──────── Application services (server only) ─▼──────────────────┐
│ getMap, getLevel, startLevel, submitAttempt, requestHint, getJournal,           │
│ getLeaderboard  —  verify session → load state → call engines → one DB txn      │
└───────▲─────────────────────────┬───────────────────────────────┬──────────────┘
        │                         │                               │
┌───────┴──────── Learning engine ┴───────┐   ┌────────── Game engine ───────────┐
│ content-pack loader + Zod schemas        │   │ pure functions, no I/O:          │
│ validators per challenge type            │   │ unlocks, level state machine,    │
│ public projection (strips answer keys)   │   │ XP rules, quest predicates,      │
│ subject-agnostic                         │   │ achievements, leaderboard rank   │
└──────────────────────────────────────────┘   └──────────────────────────────────┘
        │                                                 │
┌───────┴──────────── Repositories (server only) ─────────┴──────────────────────┐
│ Postgres via Drizzle (server role) · Supabase Auth (identity only)              │
│ optional CodeRunner adapter (disabled by default)                               │
└────────────────────────────────────────────────────────────────────────────────┘
```

Rules that keep the layers independent (enforced with ESLint `no-restricted-imports` boundaries and tests):

- `src/domain/**` (game engine) imports nothing from React, Next, the DB or content files. It receives plain data and returns decisions/events.
- `src/learning/**` knows content schemas and validators, not XP or UI.
- `src/ui/**` never imports answer-key modules; answer-key modules import `server-only` so a mistaken import fails the build.
- Content packs under `content/` contain data only — no executable code paths.

Proposed folder layout (adapts `WORKFLOW.md` §7):

```text
content/
  python-fundamentals/            # one content pack = one learning path
    path.yaml                     # subject, path, version, zones, quests, achievements
    levels/L001-wake-the-interpreter.yaml … L025-the-expedition.yaml
  sources.yaml                    # ContentSource registry (title, edition, URL, licence, reviewed)
themes/
  default-fantasy/                # world layer: zone art, map layouts, tokens
src/
  app/                            # Next.js routes (UI + route handlers/server actions)
  ui/                             # components, no domain rules
  learning/                       # schemas, loader, validators, projection
  domain/                         # game engine (pure)
  services/                       # application services (server only)
  db/                             # Drizzle schema mirror, repositories
  runner/                         # CodeRunner interface + DisabledRunner
supabase/migrations/              # SQL migrations incl. RLS + grants
scripts/                          # validate-content, verify-python-examples, sync-content-registry
tests/unit · tests/integration · tests/e2e
```

## 4. Learning engine

### 4.1 Content model

Entities follow `00_TO_100.md` §4 and `DATA_MODEL.md`. Concretely, a level file contains:

```yaml
id: py.L003                       # stable, never reused; display title can change
version: 1
path: python-fundamentals
number: 3
zone: py.zone.camp
status: draft | review | published
prerequisites: [py.L002]
skills: [py.skill.variables, py.skill.assignment]
estimatedMinutes: 8
lesson:
  objective: "Store a value in a variable and predict what is printed when it is reassigned."
  explanation: |  # original prose
  example: { code: "...", expectedOutput: "..." }   # verified by script
  misconceptions: [...]
challenges:
  - id: py.L003.c1
    version: 1
    type: predict_output
    difficulty: 1
    prompt: "..."
    code: "..."
    answer: { kind: exact_output, value: "..." , normalize: [trim_trailing_whitespace] }
    feedback: { correct: "...", byMistake: { "...": "..." }, default: "..." }
    hints: ["..."]
sources: [python-tutorial-3.13#3.1, think-python-3e#ch2]
review: { reviewer: "...", date: 2026-10-20, pythonVersion: "3.13" }
```

### 4.2 Challenge types and validators (MVP — no execution required)

| Type | Learner input | Validator (server) |
|---|---|---|
| `multiple_choice` | option id(s) | set equality with key |
| `predict_output` | text | normalised exact match (trailing whitespace, final newline) + listed accepted variants |
| `fill_blank` | token/expression per blank | per-blank accepted-variant list (whitespace-normalised); no `eval` |
| `order_lines` (Parsons) | ordered line ids (+ indent level) | compare to one or more accepted orderings |
| `trace` | value of variables at step N | exact match per field |
| `find_fix_bug` | chosen line + chosen/filled fix | line id + fix from accepted list |
| `code_write` | source code | **only via CodeRunner**; disabled until §9 decision; content with this type cannot be `published` while the runner is disabled |

Every validator is a pure function `(publicChallenge, answerKey, submission) → { correct, feedbackCode, normalizedAnswer }`, unit-tested with correct, incorrect and each accepted variant.

### 4.3 Publication gate (automated part of `CONTENT_QUALITY_STANDARD.md`)

`npm run content:validate` fails the build if a `published` item lacks objective, explanation, example + verified output, a challenge with key/feedback, sources, or review metadata; if IDs collide; if prerequisites reference missing/unpublished levels or form a cycle; or if a `code_write` challenge is published with the runner disabled.

`npm run content:verify-python` runs **author-written** example snippets and `predict_output`/`trace` keys with real CPython (pinned version, isolated `python -I`, timeout, no network in CI) and compares output. This is reviewed curriculum code in a dev/CI process, not learner code on an app server — permitted by `EXECUTION.md` Phase 2.

### 4.4 Answer-key secrecy and versioning

- The loader produces two projections: `PublicLevel` (sent to browser) and `LevelKeys` (server-only module). A unit test asserts no key field appears in any public projection; a build check greps the client bundle for a canary string placed in a test key.
- Hints are returned only on request and the request is recorded.
- Changing an answer or semantics bumps the challenge `version`. Attempts store `(challenge_id, challenge_version)`. Earned completions and XP stay valid across versions.

### 4.5 Subjects beyond Python

The engine knows only `Subject → LearningPath → Zone → Level → Challenge`. A new subject is a new content pack (e.g. `content/web-security-basics/`) plus, optionally, a new theme pack. Challenge types are subject-neutral (multiple choice, ordering, fill-blank work for any subject); `predict_output`/`trace`/`code_write` carry a `language` field so a later JavaScript path reuses them.

## 5. Game engine (pure, deterministic, unit-tested)

### 5.1 State machines (from `00_TO_100.md` §5)

- Level progress: `locked → available → in_progress → completed`. `available` is **derived** from prerequisites at read time (not stored), so adding level 26 never requires back-filling rows. Retrying a completed level keeps `completed`.
- Attempt: `submitted → evaluated` within one request (no long-running state for non-execution types).
- Quest: `locked → active → completed`.
- Achievement: `not_earned → earned` (insert-only).

### 5.2 Proposed scoring rules (for P-005 — numbers need owner confirmation)

| Event (server-detected) | XP | Uniqueness key (per user) |
|---|---|---|
| First correct answer to a challenge | 10 × difficulty (1–3) | `challenge:{challengeId}` |
| …answered correctly on first attempt with no hint | +5 bonus (cap) | `challenge-first-try:{challengeId}` |
| Level completed (all required challenges correct) | 25 | `level:{levelId}` |
| Checkpoint / major encounter / final boss completed | 50 / 75 / 150 | `level:{levelId}` (replaces the 25) |
| Quest completed | defined per quest (e.g. 50) | `quest:{questId}` |
| Incorrect answer, retry, replay of completed level | 0 | — |

Properties: correctness dominates (bonus ≤ 33% of base); hints only remove the cosmetic first-try bonus; no time bonus in MVP (speed is optional per blueprint and adds complexity); failure never deletes anything; content version bumps do not re-award. Uniqueness keys are **derived on the server**, so a client cannot mint new events by changing request IDs.

### 5.3 Quests and achievements

Defined as data in `path.yaml` using a small predicate vocabulary evaluated by the engine after each evaluated attempt:

```yaml
quests:
  - id: py.quest.repair-the-gate
    title: Repair the Gate
    activatesWhen: { always: true }
    objectives:
      - { id: o1, kind: complete_levels, levels: [py.L001, py.L002, py.L003] }
      - { id: o2, kind: complete_levels, levels: [py.L004, py.L005] }
    reward: { xp: 50, item: gate-key }      # item = cosmetic icon, per VISUAL_DIRECTION
achievements:
  - { id: py.ach.first-steps, predicate: { kind: complete_levels, count: 1 } }
  - { id: py.ach.clean-run, predicate: { kind: level_no_hints_first_try, count: 5 } }
```

Initial predicate kinds: `complete_levels`, `complete_zone`, `correct_challenges_of_type`, `level_no_hints_first_try`, `earn_xp`. New kinds are added in code with tests, never as free-form expressions in content (no executable content).

### 5.4 Checkpoints / resume

Progress is persisted after every evaluated attempt, so "resume" = the server computes the learner's current level (first available-but-not-completed level, or last in-progress). Checkpoint levels (5, 15, 25…) are content flags used for quest/zone milestones and UI, not a separate save system.

## 6. Authentication, database and trust model

### 6.1 Trust model (the key security design)

With Supabase, the browser receives a publishable key that can call the database's auto-generated REST API directly. If RLS allowed users to `insert`/`update` their own progress or XP rows, any user could award themselves XP. Therefore:

1. **The Next.js server is the only writer** of `attempts`, `level_progress`, `xp_transactions`, `quest_progress`, `user_achievements`. It connects with a dedicated, least-privilege Postgres role (not the superuser, not shipped to the browser) using a server-only `DATABASE_URL`.
2. **RLS is enabled on every table** as defence in depth. `anon`/`authenticated` roles get **no** insert/update/delete grants on progress tables; at most `select` on their own rows (`user_id = auth.uid()`). Content-registry tables are read-only.
3. The user ID always comes from the verified Supabase session on the server, never from the request body.
4. Profile handle updates go through a server action with validation (length, charset, reserved words, uniqueness).
5. The leaderboard is served by a server endpoint (or a `security definer` view exposing only handle, XP, rank).

This also reduces lock-in: apart from Auth, the database is plain Postgres used through our own server code.

### 6.2 Tables (refines `00_TO_100.md` §9 / `DATA_MODEL.md`)

Content lives in Git; the database holds a **content registry** (IDs, versions, numbers, status) synced by `scripts/sync-content-registry` during migration/deploy, so progress rows have real foreign keys without storing prose or keys in the DB.

```text
-- content registry (synced from content packs; read-only to clients)
subjects(id text pk, slug, title, status)
learning_paths(id text pk, subject_id fk, slug, title, version int, status)
zones(id text pk, path_id fk, order_index, theme_key)
levels(id text pk, path_id fk, zone_id fk, level_number int, content_version int, status,
       unique(path_id, level_number))
challenges(id text pk, level_id fk, type, current_version int, status)
quests(id text pk, path_id fk, status) · achievements(id text pk, path_id fk null)

-- learner data (user_id = auth.users.id, on delete cascade)
profiles(user_id pk, public_handle citext unique, leaderboard_visible bool, created_at, updated_at)
attempts(id uuid pk, user_id, challenge_id fk, challenge_version, idempotency_key uuid,
         correct bool, feedback_code text, hint_count int, created_at,
         unique(user_id, idempotency_key))            -- replay returns stored result
level_progress(user_id, level_id fk, state, attempts_count, first_completed_at, updated_at,
               primary key(user_id, level_id))
xp_transactions(id bigserial pk, user_id, source_event_key text, reason, delta int check (delta > 0),
                created_at, unique(user_id, source_event_key))   -- award-once guarantee
quest_progress(user_id, quest_id fk, state, objective_state jsonb, completed_at,
               primary key(user_id, quest_id))
user_achievements(user_id, achievement_id fk, awarded_at, source_event_key,
                  primary key(user_id, achievement_id))
```

Raw learner text answers are not stored beyond the normalised value needed for feedback analytics (decision O-9). All timestamps `timestamptz` UTC.

### 6.3 Submission flow (one transaction)

```text
POST submitAttempt { challengeId, submission, idempotencyKey }
 1. session → userId (reject if signed out)                     rate-limit check (per user/min)
 2. if attempts(userId, idempotencyKey) exists → return stored result (no new XP)
 3. load PublicLevel + LevelKeys (server-only); challenge must be published
 4. load user's progress; engine.isUnlocked(level) else 403
 5. learning.validate(type, key, submission) → { correct, feedbackCode }
 6. engine.applyAttempt(state, result) → { newLevelState, xpEvents[], questUpdates[], achievements[] }
 7. BEGIN; insert attempt; upsert level_progress;
    insert xp_transactions ... ON CONFLICT (user_id, source_event_key) DO NOTHING;
    upsert quest_progress; insert user_achievements ON CONFLICT DO NOTHING; COMMIT
 8. return { correct, feedback, explanation, xpAwarded (actually inserted), questChanges, nextStep }
```

### 6.4 Auth choices to confirm

Email + password with email confirmation, or magic link; optional GitHub/Google OAuth. Supabase's built-in email sender is intended for development and is rate-limited; a hosted launch needs a custom SMTP provider (decision O-5). Supabase Auth also provides sign-in rate limiting; we add per-user submission limits in Postgres.

## 7. Leaderboard

- **Metric (R-005 default):** lifetime XP = `sum(xp_transactions.delta)` for users with `leaderboard_visible = true`.
- **Tie-break (proposed, deterministic):** XP desc → time the user reached that total (`max(xp_transactions.created_at)`) asc → `public_handle` asc.
- **Output:** top N (default 50, paginated) with `rank, public_handle, xp`, plus the signed-in user's own rank. No emails, user IDs or progress details.
- **Implementation:** SQL with `rank()`/`row_number()` over an aggregate; at MVP scale a plain view/query is fast with an index on `xp_transactions(user_id)`. Add a materialised table only if measured load requires it.
- **Weekly board:** deferred (same query with a `created_at` window; cheap to add later).
- **Empty state:** "No adventurers ranked yet" — never seeded fake players outside tests.

## 8. World / interface layer

- **Map from data:** `WorldMap` renders `zones[]` and `levels[]` from the content registry plus a **theme layout** (`themes/default-fantasy/layouts/python-fundamentals.yaml`) giving each level ID a node position (percent coordinates) and each zone a backdrop. No per-level React branches. A level without a layout entry falls back to an auto-laid path, so adding levels never breaks the map.
- **Mobile:** the same data renders as a vertical route (zone headers + nodes) rather than a scaled-down landscape (`VISUAL_DIRECTION.md`).
- **States are not colour-only:** each node has icon + text label for locked / available / in progress / completed / checkpoint / boss.
- **Challenge surface:** `ChallengeRenderer` maps `type → component`; every type is a keyboard-operable form with labelled controls and an `aria-live` feedback region.
- **Art pipeline:** one representative zone (Overgrown Gate) + room + challenge + success state for owner review before bulk assets (P-006). Asset provenance recorded in `themes/*/ASSETS.md`.

## 9. 25 levels now, 100+ later

| Need | How the design supports it |
|---|---|
| 25 published, room for 100 | `level_number` is data with `unique(path_id, level_number)`; unlocks derive from `prerequisites` (a DAG), not from `n-1` arithmetic; nothing in UI or engine enumerates 25 |
| Future slots | Unpublished levels are absent from the public projection; the map may show a single "the path continues… (coming later)" marker if the owner wants it, never fake nodes |
| Content batches | Levels 26+ are added as YAML in reviewed PRs (≈5 per zone), each passing `content:validate` + `content:verify-python`; the registry sync adds rows; existing progress untouched |
| More zones/biomes | New zone entries + new theme layout/backdrop; curriculum IDs independent of art names (D-010) |
| More subjects | New content pack + optional theme pack; game engine and UI unchanged |
| Content corrections | Challenge/level `version` bumps; attempts keep the version they were graded against |
| Tests | A synthetic 100-level fixture pack in tests proves unlock, map layout fallback and leaderboard work beyond 25 |

## 10. Running Python safely and affordably

| Tier | What | Server risk | Cost | Can award XP? | Recommendation |
|---|---|---|---|---|---|
| 0 | Deterministic formats (§4.2) graded on the server; author examples verified with CPython in CI | None (no learner code runs) | $0 | **Yes** | **MVP default** — the whole 25-level path can be taught and assessed this way |
| 1 | **Pyodide** (CPython compiled to WebAssembly) in a Web Worker in the learner's browser, for a clearly labelled "try it" scratchpad | None — runs on the learner's device; worker terminated on timeout | $0 server cost; several-MB download, lazy-loaded | **No** — results are client-side and untrusted | Optional enhancement after the vertical slice; honest real execution for practice, never for score |
| 2 | Hosted sandbox behind a `CodeRunner` interface (e.g. **E2B** Firecracker microVMs; **Judge0** hosted or self-hosted) for graded `code_write` challenges | Isolated from app; runner gets no app secrets | Usage-based; e.g. E2B's official page currently lists a $0 Hobby tier with a one-time usage credit and per-second billing — **re-verify at decision time** | Yes, server calls the runner and grades its output | Only if owner decides graded code-writing is MVP-critical (O-4); requires cost plan + approval |
| 3 | Self-hosted isolation (gVisor/nsjail/Firecracker on our own VM) | We own the isolation | Always-on VM + ops time | Yes | Not recommended for MVP |

Notes: the public Piston API (`emkc.org`) is reported to require authorisation since early 2026 (third-party source, unverified) and should not be relied on. Whatever is chosen, the `CodeRunner` interface enforces code-size, time, memory, output and rate limits; the default implementation is `DisabledRunner`, and the UI states "live code execution is not enabled" rather than simulating it.

## 11. Minimum external services, APIs and libraries

**Needed for local development and the first phases: none.** Everything through Phase 3 (scaffold, content, domain engine) runs locally/in the cloud sandbox at $0. Integration tests use the locally installed PostgreSQL 16 with a minimal emulated `auth` schema.

**Needed before a hosted MVP (each requires the owner-approved cost plan from `EXECUTION.md` Phase 11):**

| Service | Purpose | Notes |
|---|---|---|
| Supabase project (Auth + Postgres) | Accounts, sessions, database | Free tier exists but third-party sources say inactive free projects pause after ~7 days; verify on the official pricing page; a separate staging project later |
| Web hosting for Next.js | Serve the app | Candidates: Vercel (check Hobby plan's non-commercial terms), Netlify, Cloudflare (via OpenNext), Render. Undecided (P-002) |
| Transactional email (SMTP) | Auth confirmation/magic links in production | Only if email auth is used at launch; OAuth-only would avoid it (O-5) |
| GitHub Actions | CI | Already available with the repo |

**Optional later:** error monitoring (e.g. Sentry, PII scrubbing on), hosted code sandbox (Tier 2), privacy-friendly analytics. No AI/model API is required for the MVP.

**Open-source libraries (initial set):** `next`, `react`, `react-dom`, `typescript`, `zod`, `yaml`, `shiki`, `tailwindcss`, `@radix-ui/react-*` (as needed), `@supabase/supabase-js`, `@supabase/ssr`, `drizzle-orm`, `postgres`, `server-only`; dev: `vitest`, `@testing-library/react`, `@playwright/test`, `eslint`, `prettier`, `drizzle-kit` (optional), `supabase` CLI (migrations; local stack needs Docker, which this sandbox lacks). Optional later: `pyodide`, `@codemirror/*`. Each added in the phase that needs it, not up front.

## 12. Testing strategy (maps to `TESTING_AND_ACCEPTANCE.md`)

- **Unit (Vitest):** schemas, validators, projection secrecy, unlock DAG, XP rules, idempotency logic, quest/achievement predicates, leaderboard ranking/ties, 100-level fixture.
- **Content:** `content:validate` and `content:verify-python` in CI.
- **Integration:** migrations applied to a clean local Postgres 16; RLS tests acting as two `authenticated` users (A cannot read/write B; neither can insert XP); submission transaction + replay; rate limit.
- **E2E (Playwright):** signup → map → lesson → wrong then right answer → XP → refresh/re-login → leaderboard, on desktop and mobile viewports; axe accessibility checks; reduced motion.
- **Security:** secret scan in CI, client-bundle canary check, dependency audit.

## 13. Estimated complexity

Sizes assume focused, reviewable cloud sessions; they are planning estimates, not commitments.

| Area | Size | Main difficulty |
|---|---|---|
| Scaffold + tooling + CI | S | Version pinning, keeping it minimal |
| Content schema + validators + verification scripts | M | Getting the schema right for 100 levels and multiple subjects |
| 25 levels of reviewed content | **L (largest)** | Accuracy, original wording, misconception feedback, review effort; best done in 5 zone batches |
| Domain engine | M | Idempotency, quest/achievement predicates, ties |
| Auth + DB + RLS + server writer | M–L | Trust model, migrations, cross-user tests, provider setup approval |
| Vertical slice UI | M | Accessible challenge components, feedback flow |
| Full map, journal, profile, leaderboard UI | M | Data-driven map, mobile route |
| Art direction / original assets | L | Original art sourcing and licensing (owner input needed) |
| Code runner (Tier 1 / Tier 2) | S / M–L | Tier 2 adds a paid service and threat testing |
| Hardening + staging deploy | M | Approval gate, cost controls |

## 14. Rejected or deferred options

- **Extending static HTML/JS:** there is none in the repo, and it cannot provide server-trusted scoring.
- **Separate Python (FastAPI/Django) backend:** a second deployable and duplicated types for no MVP benefit; Python is the subject taught, not a backend requirement.
- **Client-written progress via Supabase RLS:** rejected for scoring tables (§6.1).
- **Running learner code on the app server:** forbidden (CLAUDE.md).
- **Game engines (Phaser/Pixi/Three):** unnecessary for a node map and readable rooms; revisit after the vertical slice if the owner wants richer animation.
