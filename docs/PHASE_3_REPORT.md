# Phase 3 report — Game engine

- **Status:** PASS locally. All checks green from a clean `npm ci` (results below). GitHub Actions runs on push; its result is reported in the hand-off message.
- **Date:** 15 October 2026
- **Branch:** `claude/tender-cerf-ooekni` (review branch; not merged to `main`)
- **Starting point:** `3443257` (Phase 2, CI run #2 green). Baseline re-checked: 122 tests passing, content valid.

## 1. Conflicts with the existing architecture, and how they were resolved

None required a breaking change.

| Conflict | Resolution |
|---|---|
| The Phase 1 schema has `reward.xp` on quests/achievements, but the approved XP policy (DEC-002) has no quest/achievement XP; paying it would raise the path's 2,455 XP maximum | Engine pays no reward XP (`rewards.xpEnabled: false`); validation rejects `reward.xp > 0`; rewards are cosmetic items. Two test fixtures that declared 50-XP quest rewards were corrected to item rewards (DEC-005) |
| Making boss victory a requirement to unlock the next level would change the approved prerequisite rules | Encounters are a game layer on top of learning progress and do not gate unlocks or change XP (DEC-005) |
| A leaderboard needs saved player records and identities; neither persistence nor authentication exists | Deterministic ranking implemented as a pure function; only in-memory, explicitly non-persistent adapters (DEC-006) |
| Learning and game state live in two stores, so there is no single transaction | Game updates are idempotent per submission id and can be re-applied by resending; quests/achievements are re-derived from verified progress (R-37) |

## 2. Files changed

**Created:** `src/domain/game/{policy,types,predicates,engine,leaderboard,index}.ts`, `src/services/game-service.ts`, `src/services/game-store.ts`, `tests/domain/game-engine.test.ts`, `tests/domain/leaderboard.test.ts`, `tests/services/game-service.test.ts`, `docs/PHASE_3_REPORT.md`.

**Changed:** `src/learning/schema.ts` (additive predicates, quest `activation`, objective `optional`), `src/learning/validate.ts` (game references, reward-XP rule), `src/services/learning-service.ts` (additive: `progressSnapshot`, `progressIsDurable`, per-level `review` in the path view), `src/domain/index.ts`, `content/python-fundamentals/path.yaml` (6 quests, 11 achievements), `tests/content/python-fundamentals.test.ts`, `tests/learning/validate.test.ts`, `tests/fixtures/packs/valid-small/path.yaml`, `tests/support/synthetic-pack.ts`, `content/README.md`, `README.md`, `CHANGELOG.md`, `docs/decision.md` (DEC-005, DEC-006), `docs/architecture-proposal.md`, `docs/risk-register.md`, `docs/next-steps.md`, `docs/EXECUTION.md` and `docs/WORKFLOW.md` (status sections appended).

**Unchanged (verified with `git diff 3443257` — empty):** `src/domain/policy.ts` (XP values), `src/domain/progression.ts`, all 25 level files, `sources.yaml`, `src/learning/evaluation/**`, `package.json`, `package-lock.json`.

## 3. Implemented behaviour

```text
request ──► GameService.submit ──► LearningService.submit (validation, evaluation, XP, unlocks — unchanged)
                 │                        │ evaluated result only
                 │                        ▼
                 │        applyVerifiedAttempt (encounters, checkpoints)   ◄── GamePolicy (DEC-005)
                 │        reconcile(progress snapshot) (quests, achievements, items)
                 ▼
          GameStateStore (in-memory, durable: false)  ── processed[submissionId] = events
```

**Encounters** (levels of kind checkpoint, major, boss):

- A run starts with the first counted answer or revealed hint on the level.
- Correct answers mark challenges solved for the run. Wrong answers cost a life on major/boss runs (3 lives). Checkpoint runs cannot be lost.
- At zero lives the run is defeated (`encounter_defeated`). The next answer starts a new run; challenges must be solved again within that run.
- The encounter is won when all required challenges are solved in one run. It is flawless when the winning run had no wrong answers and no hints. Winning a checkpoint records it (`checkpoint_reached`).
- After victory, replays start no runs and change no game state.
- Encounters never change XP, completion or unlocks. Learning progress and XP earned in a lost run are kept.

**Quests:**

- A quest activates when its `activation` predicate holds, or immediately if it has none.
- Each objective is announced once when met. The quest completes when all required objectives are met.
- Optional objectives keep being tracked after completion; this was a bug found and fixed in this phase.
- Completion awards the reward item once.

**Achievements:** unlock once when their predicate holds; they award their item once.

**Predicates (11, closed vocabulary):** completed levels, level count, zone, mastered count, correct challenges of a format, clean first-try levels, XP total, level unlocked, encounter won, encounters won (by kind), flawless encounters (by kind). Each reports `current` and `target` so a quest journal can show progress.

**Leaderboard:**

- Metric is lifetime XP. Order: XP descending, then the time the current XP total was reached (earliest first), then handle (case-insensitive, then exact), then the internal id (never shown).
- Competition ranks (1, 2, 2, 4) apply only when both XP and reached-at time are equal.
- Only visible players with XP are ranked. The viewer's own rank is returned, or why they are unranked (hidden, no XP, unknown).
- Top 10 by default, at most 100.
- Handles: 3–20 characters, starting with a letter, letters/digits/`_`/`-`, reserved words refused, unique case-insensitively.

**GameService:**

- `submit` and `requestHint` pass the request body unchanged to `LearningService` and derive game events only from evaluated answers or revealed hints.
- Resending a submission id returns the stored game events (`duplicate: true`).
- A game-store write conflict returns `status: "conflict"`. Resending the same id later applies the game update exactly once, while the learning result stays the original one.
- `getView` returns encounters, checkpoints, the resume level, quests with titles and progress, achievements, items, per-level review status and `persistent: false`.
- `leaderboard` ranks the players in a player directory by their verified ledgers and returns `persistent: false`.

**Python Fundamentals content:**

- Six quests, all with cosmetic rewards:
  - Repair the Gate
  - Cross the Ember Hall (with an optional flawless objective)
  - Kindle the Looping Forge
  - Restore the Archive
  - Ascend the World-Tree
  - The Debugger's Apprentice (a side quest with an optional "all 13 bugs" objective)
- Eleven achievements, including Flawless Victory (beat the boss with no lost lives or hints) and Python Pathfinder (complete all 25 levels).
- Levels keep `review.kind: agent`. The validator warning, the home-page notice and the per-level `review` field keep that status visible.

## 4. Tests and results

Clean `rm -rf node_modules .next && npm ci`, then:

| Command | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run typecheck` | exit 0 |
| `npm test` | **13 files, 174 tests passed** (Phase 2: 122) |
| `npm run content:validate` | 25 levels, 5 zones, **6 quests, 11 achievements**, 17 sources → 0 errors, 1 warning (agent-only review, by design) |
| `npm run content:verify-python -- content tests/fixtures/packs` | Python 3.13.16 — 140/140 curriculum, 8/8 fixture snippets |
| `npm run build` | compiled; `/` prerendered |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| `npm audit` | 5 high, unchanged, dev-only lint tooling (R-31) |
| Secret scan of the staged diff | 0 matches |

Test counts by file (Vitest JSON reporter): `content/python-fundamentals` 15, `domain/game-engine` 18, `domain/leaderboard` 16, `domain/progression` 20, `learning/evaluation` 25, `learning/loader-and-schema` 9, `learning/projection` 4, `learning/python-verify` 12, `learning/synthetic-100` 5, `learning/validate` 22, `runner` 1, `services/game-service` 12, `services/learning-service` 15.

Coverage of the required scenarios:

| Scenario | Where it is tested |
|---|---|
| Normal progress | `game-engine`: quest activation, objectives, achievements and items in order. `content`: a perfect 1→25 playthrough completes all 6 quests (including optional objectives), unlocks all 11 achievements, wins all 5 encounters flawlessly, records 2 checkpoints, awards 10 items, and keeps XP at exactly 2,455 |
| Failed attempts | Lives lost per wrong answer; defeat at zero; learning progress kept; checkpoints cannot be lost; malformed answers have no game effect |
| Replays | No new runs and no state change after victory; replay through the service earns no XP (Phase 2 tests still pass) |
| Duplicate events | Resent submission returns the stored events; `reconcile` is idempotent; items and achievements are awarded once; conflict-then-resend applies exactly once |
| Locked levels | Learning rejects them, so there is no game effect; quests stay locked |
| Checkpoint completion | Fixture and real content |
| Boss completion | Flawless, hint-tainted and defeat-then-retry (including the real level 25) |
| Achievement eligibility | Progress reporting; first-try-clean rules; empty zones; unpublished references rejected |
| Leaderboard ties | Equal XP with different times; shared ranks; handle order; internal-id last resort; input-order independence; hidden, zero-XP and unknown viewers; limits; empty board |

## 5. Security review

- **No client authority.** The game service has no endpoint of its own for XP, completions, encounter results, quest completion or achievement unlocks. Every event comes from a `LearningService` result that has already been evaluated. Bodies with extra fields (such as `achievements` or `xp`) are rejected as `bad_request` and have no game effect (tested).
- **Idempotency.** Every learning submission id is processed by the game at most once. Award keys (`quest:…`, `achievement:…`) and achievement records are unique.
- **Privacy.** Leaderboard output contains rank, handle and XP only; internal ids are never output (tested). Handles cannot be emails.
- **Trust gaps still open (no endpoint exists yet):** learner and player ids are trusted from the caller until authentication exists (R-36); there is no rate limiting yet; there is no offensive-handle filter (R-08).
- No secrets, environment variables, network calls or new dependencies.

## 6. Remaining limitations

- **Nothing persists.** Learning progress, game state and the player directory are in memory. The leaderboard compares only players in one process and is not persistent or cross-session (`persistent: false` everywhere).
- No authentication, profiles or account management. There is no UI for the map, encounters, journal or leaderboard.
- Learning and game state are not saved atomically (R-37). Encounter-run effects can be lost if a game save fails and the client never resends.
- The game defaults are untested with learners: 3 lives, flawless rules and achievement thresholds (R-39, O-14).
- The 25 levels are still agent-reviewed only (DEC-004, O-13).
- Idempotency maps grow without bound in memory (R-40).
- Weekly leaderboards, spaced review and an inventory economy are not implemented, by design.

## 7. Cost impact

No dependencies, external services or cloud resources were added, so infrastructure cost is **$0**. Usage: Claude cloud-session credit for this session, and GitHub Actions minutes for CI on push.

## 8. Next recommended phase

**Phase 4 — Persistence and identity (local first).**

- SQL migrations for learning and game state (levels/challenges registry, attempts, XP ledger with unique award keys, encounter runs, quests, achievements, processed submissions, player profiles), with row-level security.
- A durable store that saves learning and game updates in **one transaction**.
- Two-account isolation tests against the local PostgreSQL 16 already in the cloud environment.
- The managed-authentication integration design, so learner ids come from verified sessions.

No external service is created until you approve a cost plan. Owner input needed first: O-5 (sign-in methods) and O-8 (minimum learner age). O-13 and O-14 should be decided before any public release.
