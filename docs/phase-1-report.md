# Phase report — Phase 1: Foundation

- **Status:** PASS locally (all checks green from a clean `npm ci`). GitHub Actions CI has not run yet — it will run on the first push of this branch.
- **Date:** 15 October 2026
- **Branch:** `claude/tender-cerf-ooekni` (review branch; not merged to `main`)
- **Goal and acceptance criteria:** `docs/next-steps.md` §1.

## Implemented and verified

| Item | Where | Verified by |
|---|---|---|
| Next.js 16 + React 19 + TypeScript (strict) skeleton, npm lockfile, Node 22 pin | `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `next.config.ts` | `npm run build` |
| Honest status home page (no buttons, no fake features) rendering real counts from content | `src/app/`, `src/services/content-overview.ts` | Prerendered HTML contains "25 levels outlined across 5 zones, 0 published" |
| ESLint (Next core-web-vitals + TypeScript) with layer-boundary rules | `eslint.config.mjs` | `npm run lint`; temporary probe files importing React/`node:fs` into `src/domain` and answer keys into `src/ui` produced 3 errors (probes deleted) |
| Prettier, `tsc --noEmit`, Vitest | `.prettierrc.json`, `.prettierignore`, `vitest.config.ts` | `npm run format:check`, `npm run typecheck`, `npm test` |
| Content-pack schemas (subject, path, zone, level, lesson, 7 challenge types, quest, achievement, source) | `src/learning/schema.ts` | `tests/learning/loader-and-schema.test.ts` |
| YAML loader with file/field-located errors | `src/learning/loader.ts` | malformed YAML, schema errors, unknown-field typos tested |
| Cross-reference validator + publication gate | `src/learning/validate.ts` | 12 rejection tests in `tests/learning/validate.test.ts` |
| Public projection (whitelist) + server-only answer keys | `src/learning/projection.ts`, `src/learning/keys.ts` | canary test over all 7 challenge types; deterministic `order_lines` shuffle never shows an accepted order |
| Real-Python verification of examples and `predict_output` keys | `src/learning/python-verify.ts`, `scripts/verify-python-examples.ts` | Python 3.13.16: correct/incorrect output, expected exceptions, stdin, timeout kill, output cap, isolated mode, missing interpreter |
| `content:validate` CLI | `scripts/validate-content.ts` | exits 0 on valid packs, 1 on a broken copy of the fixture |
| Python Fundamentals path skeleton: 5 zones, 25 **draft** level outlines from the documented curriculum plan | `content/python-fundamentals/` | `tests/content/python-fundamentals.test.ts` (numbering, zones, kinds at 5/10/15/20/25, nothing published) |
| Synthetic 100-level path (20 zones, 25 published + 75 draft, non-linear prerequisites, quests) | `tests/support/synthetic-pack.ts` | `tests/learning/synthetic-100.test.ts` (loads from YAML, validates, topological order, real-Python sample) |
| Disabled `CodeRunner` | `src/runner/index.ts` | `tests/runner.test.ts` |
| CI workflow (read-only permissions, no deploy) | `.github/workflows/ci.yml` | Every step run locally (below); not yet run on GitHub |
| `.env.example` (names only) | `.env.example` | contains no values |

## Partial / deferred (by design)

- **No curriculum content authored.** The 25 levels are outlines (`status: draft`, `outline:` notes). Lessons, challenges, sources and reviews are Phase 3.
- **Answer grading functions** (validators that mark a learner's submission) are not implemented; Phase 2 alongside the game engine.
- **Game engine:** only shared state types exist (`src/domain/index.ts`).
- **Not installed yet:** Tailwind, Radix, Shiki, Supabase, Drizzle, Playwright (baseline per `architecture-proposal.md`, added in the phases that need them).
- **No auth, database, leaderboard, hosted execution, paid API or cloud resource.**
- **Client-bundle canary check** in CI is deferred until a page renders challenge data.

## Commands run and exact results (clean `rm -rf node_modules .next && npm ci`)

| Command | Result |
|---|---|
| `npm run lint` | exit 0, no findings |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run typecheck` | exit 0 |
| `npm test` | 7 files, **47 tests passed** |
| `npm run content:validate` | `content/python-fundamentals`: 25 levels (0 published, 0 review, 25 draft), 5 zones → 0 errors, 0 warnings |
| `npm run content:verify-python -- content tests/fixtures/packs` | Python 3.13.16; curriculum 0/0 (no examples authored yet); fixtures 3/3 verified |
| `npm run build` | Next.js 16.4.1 (Turbopack) compiled; `/` prerendered static |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| `npm audit` (including dev tooling) | 5 high, all in `braces`→`micromatch`→`fast-glob`→`@next/eslint-plugin-next` (lint-time only; see risk R-31) |
| Negative checks | broken prerequisite → validate exit 1; wrong answer key → verify exit 1 (expected "5", actual "23"); `PYTHON=nope` → exit 1 |

## Security / privacy

- No secrets added; `.env.example` holds names only; `.env*` remains ignored.
- Answer keys are reachable only through `src/learning/keys.ts` (`server-only`), and ESLint blocks importing them from `src/ui`/`src/app`.
- Python verification runs **repository curriculum code only**, in isolated mode, minimal environment, temp working directory, 5 s timeout with SIGKILL and 64 KB output cap. It has no network sandbox; acceptable for reviewed repository content, never for learner code (which stays disabled).

## External services, cost

- None created or used. Package downloads from the public npm registry only.
- Infrastructure cost: **$0**. Claude cloud-session usage only (development credit), no other spend.

## Next recommended task

Phase 2 — Domain/game engine (pure): grading validators per challenge type, unlocks, attempt evaluation, XP events with idempotency keys, quests/achievements predicates, leaderboard ranking and ties. Scoring numbers default to `architecture-proposal.md` §5.2 unless the owner confirms otherwise (O-2).

## Owner decisions required

None to continue. Open items are listed in `docs/next-steps.md` §3 (O-2 scoring numbers is the next one that matters).
