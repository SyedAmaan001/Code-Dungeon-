# Code Dungeon — Next Steps

- **Date:** 15 October 2026, after the Phase 0 audit.
- **Where we are:** "0" on the `00_TO_100.md` scale — the audit is complete and the truth is documented (`docs/initial-audit.md`). No application code exists.
- **Companion docs:** `docs/architecture-proposal.md` (stack and design), `docs/risk-register.md` (risks), `docs/EXECUTION.md` (phase gates, unchanged).

> **Update 2026-10-15:** Phase 1 was approved and implemented on `claude/tender-cerf-ooekni` — see `docs/phase-1-report.md`. The next phase is **Phase 2 — Domain/game engine** (§2). O-1 is resolved (DEC-001); O-3 and O-7 have defaults applied (see `decision.md` §7).

## 1. Recommended next phase (single best choice)

### Phase 1 — Foundation: scaffold, quality tooling, CI and the content-pack schema

**Why this one:** every later phase depends on it. It is entirely local, costs $0 in external services, needs no secrets, and needs only one owner confirmation (the stack). Including the content schema and validator — not just an empty scaffold — gives a reviewable result that tests the most important architectural idea early: curriculum as validated data, separate from game rules and UI, able to scale from 25 to 100+ levels. It also makes good use of the remaining cloud-session credit before its expiry.

**In scope**

1. Next.js + TypeScript (strict) scaffold with npm and a committed lockfile; Node version pinned (`engines`, `.nvmrc`).
2. ESLint, Prettier, `tsc --noEmit`, Vitest; import-boundary lint rules for `src/domain`, `src/learning`, `src/ui`.
3. Folder structure from `architecture-proposal.md` §3, with empty-but-typed module entry points.
4. `.env.example` with variable **names** only (no values; Supabase entries commented as "not yet provisioned").
5. Zod schemas for subject / path / zone / level / lesson / challenge / quest / achievement / source; YAML loader; public vs key projections with `server-only` guard.
6. `content:validate` script (required fields, unique IDs, prerequisite DAG, publish gate, `code_write` blocked while runner disabled).
7. `content:verify-python` script that runs author-written examples with pinned CPython under a timeout.
8. Test fixtures: one small valid pack, several invalid packs, and a synthetic 100-level pack. **No real curriculum levels are published** in this phase (any sample level stays `draft`).
9. GitHub Actions workflow running lint, typecheck, unit tests, content validation and build (no deploy step).
10. A minimal home page that honestly states the project is in development — no fake features, no dead buttons.
11. Docs: README setup/test commands; `DEC-` entry for the stack in `decision.md`; CHANGELOG.

**Out of scope:** auth, database, Supabase project, map/game UI, art assets, authored Python lessons, code runner, hosting.

**Acceptance criteria (with exact command output in the phase report)**

- `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run content:validate`, `npm run content:verify-python`, `npm run build` all pass from a clean checkout.
- Invalid fixture packs fail validation with clear messages (tested).
- The 100-level fixture validates and its prerequisite graph resolves (tested).
- Public projection never contains answer-key fields (tested).
- No secrets, no external resources created, diff reviewed for scope creep.
- Delivered on a feature branch / PR for owner review; not merged to `main` without review.

## 2. Following phases (from `EXECUTION.md`, refined by the audit)

| Order | Phase | Key output | External services | Owner input needed |
|---|---|---|---|---|
| 2 | Domain/game engine (pure) | Unlocks, attempt evaluation, XP rules, idempotency logic, quests, achievements, leaderboard ranking — all unit-tested | None | Confirm scoring numbers (O-2) — can start with proposed defaults as config |
| 3 | Curriculum batch 1 | Zone 1 (levels 1–5) fully authored and verified; then zones 2–5 in later batches | None | Python version (O-3); reviewer for content |
| 4 | Persistence + auth (local first) | SQL migrations, RLS/grants, server-writer, two-user isolation tests on local Postgres 16; Supabase Auth integration designed | None until hosted; Supabase project only after approval | Auth methods (O-5), audience age policy (O-8) |
| 5 | Vertical slice | sign up → map → lesson → challenge → feedback → XP → refresh/re-login, with levels 1–3 | Requires a dev Supabase project **or** a local auth emulation — owner approves whichever | Approve dev Supabase project (free tier) if used |
| 6 | Full 25 levels + quests | Five zones, checkpoints/encounters, quest journal | — | Content review |
| 7 | XP, achievements, profile, leaderboard UI | Real persisted leaderboard, privacy-safe handles | — | Leaderboard opt-out default (O-9) |
| 8 | Art direction slice → full visual pass | One approved zone/room/challenge/success, then expansion | Possibly art commissioning/licences | Art source and budget (O-11) |
| 9 | Code-runner decision | Tier 0 confirmed; optional Pyodide scratchpad; Tier 2 only if approved | Possibly sandbox provider | O-4 |
| 10 | Hardening + release candidate | Security, a11y, e2e, dependency/secret scans | — | — |
| 11 | Cloud plan + staging | `docs/cloud-plan.md`, approved named resources, staging deploy | Hosting + Supabase + SMTP | Hosting provider (O-1b), budget approval |

Phases 2 and 3 are independent and could run in either order after Phase 1.

## 3. Open decisions for the owner

Only items that repository evidence cannot settle. Each has a recommendation so non-billable work can continue.

| ID | Decision | Recommendation | Needed before | Maps to |
|---|---|---|---|---|
| O-1 | Approve the stack: Next.js + TypeScript, Tailwind + Radix, Zod/YAML content packs, Supabase Auth + Postgres (server-only writes), Vitest/Playwright | Approve as proposed | Phase 1 | P-001 (now answered: no stack exists), R-001/R-002 |
| O-1b | Hosting provider for staging/production | Decide at Phase 11; candidates in `architecture-proposal.md` §11 | Phase 11 | P-002 |
| O-2 | Scoring numbers, retry/hint rules, tie-break | Adopt the table in `architecture-proposal.md` §5.2 and §7 as v1 | Phase 2 (can start with defaults) | P-005 |
| O-3 | Python version for curriculum | Write content valid for Python ≥ 3.10, verify with CPython 3.13 in CI (installed in sandbox); revisit if a runner uses another version (current Pyodide reportedly tracks 3.14) | Phase 3 | CONTENT_QUALITY_STANDARD |
| O-4 | Is graded code-writing required for the first public MVP? | No — ship Tier 0 deterministic formats; optionally add a Pyodide practice scratchpad that never awards XP; decide Tier 2 after the slice | Phase 9 | P-004 |
| O-5 | Sign-in methods | Email + password with confirmation, plus GitHub OAuth; production SMTP chosen at cloud-plan time | Phase 4 | P-003 |
| O-6 | Should the legacy prototype files (`index.html`, `codeclash.html`, `page.js`, …) be added to the repo for reference? | Not needed for the build; if wanted, add under `legacy/` in a separate PR, never served | Any time | Audit §3 |
| O-7 | Docs naming convention | Keep existing UPPER_SNAKE docs canonical; new docs lower-kebab; `decision.md` remains the decision log; no lower-case duplicates | Phase 1 | Audit §6 |
| O-8 | Minimum learner age / audience | Decide before public launch; affects privacy obligations and consent flows | Phase 4 design, before public release | P-007 |
| O-9 | Leaderboard visibility default | Visible by default with an opt-out toggle in profile; handle (never email) only | Phase 7 | P-005/P-007 |
| O-10 | Reference images in Git: keep, or replace with a provenance note? Is the repo public? | Keep in Git only while the repo is private and record their source; never ship them | Before making the repo public | P-006, R-12 |
| O-11 | Source of original art (commission, licensed packs, owner-created, AI-assisted with licence review) | Decide after the representative slice is reviewed | Phase 8 | P-006 |
| O-12 | Confirm cloud-session credit expiry year | Check the Claude UI; plan sessions accordingly | Now | decision.md §3 |

## 4. What the owner should do now

1. Review this PR/branch (`claude/tender-cerf-ooekni`): `docs/initial-audit.md`, `docs/architecture-proposal.md`, `docs/risk-register.md`, `docs/next-steps.md`.
2. Answer **O-1** (stack). O-7 and O-12 are quick confirmations; everything else can wait for its phase.
3. Start the next session with a scoped prompt, for example:

> Goal: Phase 1 — Foundation (see `docs/next-steps.md` §1). Read `CLAUDE.md`, `docs/architecture-proposal.md`, `docs/next-steps.md`. Implement only the in-scope items, on a new branch, with the listed acceptance criteria and exact command output. No auth, database, UI beyond a minimal honest home page, authored curriculum, external services or secrets.
