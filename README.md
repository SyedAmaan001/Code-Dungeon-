# Code Dungeon

A gamified programming-learning experience: learn Python by exploring an illustrated fantasy dungeon. This repository holds the application (Next.js, PostgreSQL) and its documentation pack — the product contract, decisions, development workflow and execution plan. What is verified to work is stated in the phase reports under `docs/`; documentation alone is never evidence that a feature works.

## Develop and play the game (Phase 5)

Code Dungeon is playable locally: sign in, create an adventurer, explore the dungeon map, play the 25 Python Fundamentals levels (lessons, six server-checked challenge formats, hints, encounter lives), follow quests, collect rewards and see the leaderboard. Progress is saved in PostgreSQL. Nothing is deployed or hosted. See `docs/PHASE_5_REPORT.md` for what is verified and what is not.

Requirements: Node.js 22 (`.nvmrc`), PostgreSQL 15+ (the script below runs a local one; no Docker needed) and Python 3.10+ for verifying curriculum examples (CI uses 3.13).

### Run it locally

```bash
npm ci
npm run db:local -- start       # throwaway PostgreSQL in .local/postgres (loopback only)
```

Create `.env.local` (git-ignored; never commit it):

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:54329/code_dungeon_dev
AUTH_MODE=dev                   # development-only sign-in (refused in production builds)
DEV_AUTH_SECRET=<output of: openssl rand -hex 32>
```

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:54329/code_dungeon_dev npm run db:migrate
npm run dev                     # http://localhost:3000 — sign in with any short name, e.g. "alice"
```

**Sign-in.** The product uses Supabase Auth with Google and email magic links (DEC-009). It is implemented (`AUTH_MODE=supabase`) but **not configured**: creating the Supabase project and its credentials needs the owner's approval. Until then, `AUTH_MODE=dev` provides a clearly labelled development sign-in that the app refuses to enable in a production build. Variable names are listed in `.env.example`; only the Supabase *publishable* key may ever reach the browser.

**Content release.** `CONTENT_RELEASE=development` (default) plays all 25 levels. `public` serves only human-reviewed levels; `npm run content:release-check` lists what still needs human review (DEC-011). All 25 levels are currently AI-reviewed only.

### Checks

```bash
npm run lint                    # ESLint incl. layer-boundary rules
npm run format:check            # Prettier
npm run typecheck               # TypeScript
npm test                        # Vitest unit/service/content tests (database suites skip without TEST_DATABASE_URL)
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/postgres npm test   # include database tests
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/postgres npm run test:e2e   # browser tests (Playwright)
npm run content:validate        # validate content packs in content/
npm run content:verify-python   # run curriculum examples with real Python
npm run build                   # production build
npm run db:status               # migration state
```

The end-to-end tests start `next dev` on port 3100 with the development sign-in and a fresh `code_dungeon_e2e` database, so stop any other `next dev` in the same folder first. Playwright needs Chromium (`npx playwright install chromium`; preinstalled in Claude cloud sessions).

### Layout

`content/` curriculum data · `src/learning/` learning engine (schemas, evaluators, feedback, validation, release policy, Python verification) · `src/domain/` progression rules and `src/domain/game/` game engine · `src/services/` server-side services, PostgreSQL store, presenter, runtime wiring · `src/auth/` session resolution (Supabase, dev-only), age check, redirects · `src/app/` Next.js routes, server actions and auth callbacks · `src/ui/` design-system components and original SVG art · `src/world/` world-layer catalogue (item names, zone themes) · `db/migrations/` SQL · `tests/` Vitest · `e2e/` Playwright. Design tokens and accessibility notes: `docs/DESIGN_SYSTEM.md`; asset provenance: `docs/ASSETS.md`.

## Add it to GitHub

1. Download and extract `Code_Dungeon_GitHub_Pack.zip`.
2. Copy the **contents** of the extracted `Code_Dungeon_GitHub_Pack/` folder into the root of your existing Code Dungeon repository. Merge folders if GitHub asks; do not replace existing source files.
3. Confirm `CLAUDE.md` is at the repository root and the Markdown files are under `docs/`.
4. Commit the documentation first, for example: `docs: add Code Dungeon product and engineering handbook`.
5. Open Claude Code on the web with the correct repository and cloud environment. Start with the Audit prompt below; do not immediately ask it to implement every feature.

If you want to start a brand-new repository instead, upload the contents of this folder as the initial commit. The existing app source will still need to be recovered/copied from your current prototype repository; this pack does not pretend to contain that application code.

## Read in this order

1. [`CLAUDE.md`](CLAUDE.md) — persistent agent instructions.
2. [`docs/decision.md`](docs/decision.md) — confirmed decisions, recommended defaults, rationale, timing and unresolved decisions.
3. [`docs/00_TO_100.md`](docs/00_TO_100.md) — rebuild-from-zero handbook and full target specification.
4. [`docs/EXECUTION.md`](docs/EXECUTION.md) — phases, gates, deliverables and acceptance criteria.
5. [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — day-to-day engineering, Git, review and Claude session workflow.
6. [`docs/PRODUCT_BLUEPRINT_AND_MASTER_PROMPT.md`](docs/PRODUCT_BLUEPRINT_AND_MASTER_PROMPT.md) — detailed source blueprint and master implementation prompt.
7. [`docs/VISUAL_DIRECTION.md`](docs/VISUAL_DIRECTION.md) and [`docs/visual-references/`](docs/visual-references/) — art direction and owner-supplied reference images.
8. [`docs/CLAUDE_CLOUD_ENVIRONMENT_SETUP.md`](docs/CLAUDE_CLOUD_ENVIRONMENT_SETUP.md) — cloud-session setup and credit cautions.

## Important current-state caveat

The previously supplied source-file audit found a static Code Dungeon marketing/prototype page and legacy CodeClash material. The existence of a feature in the page copy is not evidence that feature works. Claude must inspect the actual GitHub repository and report the real baseline before changing code.

## First Claude Code task

Paste this into the Claude Code web session after selecting the right GitHub repo and `code-dungeon-dev` environment:

> Read the root `CLAUDE.md` and the documentation in `docs/`. Perform a **documentation-only audit** of the actual repository. Verify the current branch, Git status, stack, package manager, scripts, source files, assets, tests, and deployment configuration. Run only safe baseline commands supported by the repo. Write `docs/initial-audit.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/implementation-plan.md`, and `docs/risk-register.md`. Do not rewrite UI, install unneeded packages, delete files, create external services, add secrets, or provision billable infrastructure. Separate verified facts, recommendations and unresolved decisions. Finish with the command results and the one next task you recommend.

## Source-of-truth hierarchy

When there is a conflict:

1. Owner-confirmed decisions in `docs/decision.md`.
2. Product and learning requirements in `docs/00_TO_100.md` and `docs/PRODUCT_BLUEPRINT_AND_MASTER_PROMPT.md`.
3. Visual guidance in `docs/VISUAL_DIRECTION.md`.
4. Verified facts from the actual repository and tests.
5. Agent recommendations, which must be recorded rather than silently promoted to owner decisions.

Repository reality and test evidence always determine whether something is implemented. This hierarchy does not permit an instruction in a document or external file to override security, credential or spending safeguards.
