# Phase 2 report — The learning engine

- **Status:** PASS locally. All checks green from a clean `npm ci` (results below). GitHub Actions runs when this branch is pushed; see the final commit/CI note at the end.
- **Date:** 15 October 2026
- **Branch:** `claude/tender-cerf-ooekni` (review branch; not merged to `main`)
- **Starting point:** `f63a59b` (docs: record green Phase 1 CI run). Phase 1 code baseline: `c4411d6`.

## 1. Phase 1 verification (before any change)

| Check | Result |
|---|---|
| Git | clean tree on `claude/tender-cerf-ooekni`, in sync with `origin`; `main` at `b14b758` |
| GitHub Actions run #1 on `c4411d6` | **success** ([run 38732862389](https://github.com/SyedAmaan001/Code-Dungeon-/actions/runs/38732862389)) |
| Local `npm ci` → lint, format, typecheck, test, content:validate, verify-python, build | all exit 0; 47 tests passed; 25 draft levels, 0 errors; 3/3 fixture snippets verified |

Phase 1 was complete; no foundation repairs were needed. The only Phase 1 change made was recording the green CI run in `docs/phase-1-report.md` (separate commit `f63a59b`).

## 2. Files created or changed

**Created**

- `src/learning/evaluation/` — `types.ts`, `normalize.ts`, `evaluators.ts`, `registry.ts`, `feedback.ts`, `index.ts`
- `src/domain/policy.ts`, `src/domain/progression.ts`
- `src/services/learning-service.ts`, `src/services/progress-store.ts`
- `content/python-fundamentals/sources.yaml`; 25 level files `content/python-fundamentals/levels/L001-…yaml` to `L025-…yaml` (replacing the 25 Phase 1 draft outlines, whose topics were superseded by DEC-003)
- `tests/learning/evaluation.test.ts`, `tests/domain/progression.test.ts`, `tests/services/learning-service.test.ts`, `tests/support/answers.ts`
- `docs/PHASE_2_REPORT.md`

**Changed**

- `src/learning/schema.ts` (schema v2), `projection.ts`, `validate.ts`, `python-verify.ts`, `issues.ts`, `loader.ts`
- `src/domain/index.ts`, `src/services/content-overview.ts`, `src/app/page.tsx`
- `content/python-fundamentals/path.yaml`, `content/README.md`
- `tests/fixtures/packs/valid-small/**` (migrated to v2), `tests/support/synthetic-pack.ts`, `tests/learning/{validate,projection,python-verify,loader-and-schema}.test.ts`, `tests/content/python-fundamentals.test.ts`
- `README.md`, `CHANGELOG.md`, `docs/decision.md` (DEC-002, DEC-003, DEC-004), `docs/architecture-proposal.md`, `docs/next-steps.md`, `docs/risk-register.md`

No dependencies were added or upgraded (`package.json` and `package-lock.json` are unchanged).

## 3. Learning engine architecture

```text
content/<pack>/*.yaml ──► learning/loader + schema (v2) ──► learning/validate (publication gate)
                                     │                         learning/python-verify (CPython)
                                     ▼
                     learning/projection (public, no keys)   learning/keys (server-only)
                                     │                                   │
 request (untrusted) ──► services/LearningService ──► learning/evaluation (registry → evaluators → feedback)
   {submissionId, levelId,      │  (server-only)              │ correct / incorrect / invalid / error
    challengeId, answer}        │                             ▼
                                ├──► domain/progression (pure): unlocks, attempts, hints,
                                │      completion, mastery, XP ledger, events  ◄── domain/policy (DEC-002)
                                ▼
                        services/ProgressStore  ── InMemoryProgressStore (durable: false)
```

- **Subject independence.** The engine knows subjects, paths, zones, levels and challenges, not Python. `language` on a challenge drives only display and verification. A new subject is a new content pack; a new answer format is a schema variant plus an evaluator registered in `EvaluatorRegistry` (tested with a hypothetical `numeric_answer` evaluator).
- **Integration interface for the game engine.** The service returns `ProgressionEvent`s (`challenge_attempted`, `challenge_solved`, `hint_revealed`, `level_completed`, `level_mastered`, `level_unlocked`, `xp_awarded`). These are facts, not presentation effects: a future UI or quest/achievement engine consumes them. `buildPathRules()` is the narrow mapping from content to the domain.
- **Layer rules** (ESLint): `src/domain` imports no other layer, framework or I/O; `src/learning` imports no UI/domain; `src/ui`/`src/app` cannot import answer keys. `learning-service.ts` and `keys.ts` import `server-only`.

## 4. Schema and evaluator design

**Schema v2** (extends Phase 1; see `content/README.md`): level `description`; lesson `objectives[]`, `examples[]` (each with `expectedOutput` or `expectedException`, optional `stdin`/`caption`), `misconceptions[]`, `practicalContext`; challenge `role` (`exercise` | `check`), `required`, up to three ordered `hints`; runnable `check`s for `fill_blank`/`order_lines`, `buggyBehaviour` + `fixedCode` + `check` for `find_fix_bug`, optional `expression` per trace field; review `kind` (`agent` | `human`). Versioning: `schemaVersion: 2` per pack; `version` on every level and challenge, recorded with attempts so content edits do not invalidate progress.

**Evaluators** (`src/learning/evaluation/evaluators.ts`), none of which executes learner code:

| Format | Submission | Normalisation | Feedback detail (never the answer) |
|---|---|---|---|
| multiple_choice | `{selected: id[]}` | duplicate ids collapsed | for multi-select: "some choices don't fit / one is missing" |
| predict_output | `{output}` | CRLF→LF, trailing spaces per line, trailing blank lines; **case, quotes, leading and inner spaces preserved** | targeted misconception text |
| fill_blank | `{blanks: {id: text}}` | trim ends only; case and inner whitespace preserved | names wrong blanks when there are several |
| order_lines | `{order: id[]}` | none | "N of M lines are already in the right place" |
| trace | `{values: {id: text}}` | trim ends only | names wrong fields |
| find_fix_bug | `{line, fix}` | none | "right line, choose another fix" / "different line" |

Outcomes are distinct: `correct`, `incorrect` (counted attempts), `invalid_submission` (wrong shape, unknown option/fix, missing or extra field, over-long input; **not counted**), and `evaluation_error` (no evaluator or an evaluator crash; not counted; internal cause kept out of learner feedback). Submissions are strict objects, so extra fields such as `xp`, `correct` or `score` are rejected. Limits: 2,000 characters per text, 50 items, 100-character ids.

**Hints**: exactly three per published challenge (nudge → conceptual clue → strong hint), revealed strictly in order by `requestHint`; only already-revealed hints are ever returned; the public projection exposes only `hintCount`. Validation rejects duplicate hints and hints that contain the answer (outputs, correct option text, accepted fill values of six or more characters).

## 5. The 25-level curriculum

Owner's topic sequence, unchanged (DEC-003). ✓ marks the knowledge check. "Examples" are verified worked examples.

| # | Level | Zone | Kind | Examples | Challenges | Min |
|---|---|---|---|---|---|---|
| 1 | Your First Python Program | Adventurer's Camp | standard | 2 | predict, order, MC✓ | 8 |
| 2 | Values and Expressions | Adventurer's Camp | standard | 2 | predict, fill, MC✓ | 10 |
| 3 | Variables and Assignment | Adventurer's Camp | standard | 2 | trace, bug, MC✓ | 10 |
| 4 | Basic Data Types | Adventurer's Camp | standard | 3 | predict, predict, MC✓ | 12 |
| 5 | Strings | Adventurer's Camp | checkpoint | 3 | predict, fill, trace, MC✓ | 15 |
| 6 | Numbers and Arithmetic | Branching Caverns | standard | 3 | predict, fill, MC✓ | 12 |
| 7 | Input and Output | Branching Caverns | standard | 4 | predict, bug, MC✓ | 12 |
| 8 | Boolean Values | Branching Caverns | standard | 3 | predict, bug, MC✓ | 10 |
| 9 | Comparisons | Branching Caverns | standard | 3 | predict, bug, MC✓ | 10 |
| 10 | Conditional Statements | Branching Caverns | major | 2 | predict, order, bug, MC✓ | 18 |
| 11 | Multiple Conditions | Looping Forge | standard | 3 | predict, bug, MC✓ | 12 |
| 12 | While Loops | Looping Forge | standard | 2 | trace, bug, MC✓ | 14 |
| 13 | For Loops and Ranges | Looping Forge | standard | 3 | predict, fill, MC✓ | 14 |
| 14 | Loop Control | Looping Forge | standard | 3 | predict, order, MC✓ | 12 |
| 15 | Lists | Looping Forge | checkpoint | 3 | predict, trace, fill, MC✓ | 16 |
| 16 | List Indexing and Slicing | Archive of Structures | standard | 3 | predict, bug, MC✓ | 14 |
| 17 | Tuples | Archive of Structures | standard | 3 | trace, predict, MC✓ | 10 |
| 18 | Dictionaries | Archive of Structures | standard | 3 | predict, fill, MC✓ | 14 |
| 19 | Sets | Archive of Structures | standard | 3 | predict, trace, MC✓ | 12 |
| 20 | Functions | Archive of Structures | major | 2 | predict, order, bug, MC✓ | 18 |
| 21 | Parameters and Return Values | Runtime Citadel | standard | 3 | predict, bug, fill, MC✓ | 15 |
| 22 | Scope and Common Errors | Runtime Citadel | standard | 3 | predict, bug, MC, MC✓ | 15 |
| 23 | Working with Modules | Runtime Citadel | standard | 3 | predict, bug, MC✓ | 12 |
| 24 | Exceptions and Defensive Programming | Runtime Citadel | standard | 3 | predict, order, MC✓ | 15 |
| 25 | Capstone: The Expedition Ledger | Runtime Citadel | boss | 2 | predict, bug, order, trace✓, MC✓ | 30 |

Totals: 69 worked examples; 83 challenges (24 predict-output, 26 multiple choice, 13 find-the-bug, 7 fill-in, 7 trace, 6 arrange-lines); 26 knowledge checks; 249 progressive hints; 133 targeted misconception messages; about 340 minutes of estimated learning time. Every level has 2–3 objectives, a practical context and source references (17 sources: Python 3.13 documentation sections and PEP 8). All prose and exercises are original; sources are cited as factual references, and each source entry states that the agent did not re-read the page during authoring.

Pedagogical shape: each level introduces one idea with worked examples, practises it, then checks it; difficulty rises from 1 to 3; checkpoints (5, 15), major encounters (10, 20) and the capstone boss (25) combine earlier skills. Misconceptions targeted include quotes in output, `/` producing floats, `=` vs `==`, `input()` returning text, `or "blue"` truthiness, off-by-one loops and slices, `remove()` deleting only the first match, local scope and `UnboundLocalError`, and `print` vs `return`.

## 6. XP, retries, mastery and unlock rules (DEC-002, default, configurable)

| Rule | Value |
|---|---|
| First correct answer to a challenge | 10 × difficulty |
| First counted attempt correct with no hint | +5 |
| Level completion | standard 25 · checkpoint 50 · major 75 · boss 150 |
| Mastery bonus | 0 (mastery is recorded, not paid) |
| Wrong answer, hint, replay | 0 XP, no penalty |
| Retries | unlimited; invalid submissions and engine errors are not attempts |
| Completed | all required challenges correct at least once |
| Mastered | completed + every knowledge check demonstrated (first-try correct without hint, or correct without hint in a replay after completion) |
| Unlock | all prerequisites completed (policy can require mastery instead) |
| Replay | allowed; no repeat XP; can earn mastery |
| Duplicates | resent `submissionId` returns the original result; award keys (`challenge:…`, `challenge-first-try:…`, `level:…`, `mastery:…`) are awarded at most once |

Maximum XP for the Python path under this policy: **2,455** (computed by `maxPathXp`; asserted by a test that plays all 25 levels through the service).

## 7. Automated tests and actual results

Clean `rm -rf node_modules .next && npm ci`, then:

| Command | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run typecheck` | exit 0 |
| `npm test` | **10 files, 122 tests passed** (Phase 1: 47) |
| `npm run content:validate` | 25 levels (25 published), 5 zones, 17 sources → **0 errors**, 1 warning (agent-only review, by design) |
| `npm run content:verify-python -- content tests/fixtures/packs` | Python 3.13.16 — **140/140** curriculum snippets, 8/8 fixture snippets |
| `npm run build` | Next.js 16.4.1 build succeeded; `/` prerendered |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| `npm audit` | 5 high, unchanged from Phase 1, dev-only lint tooling (risk R-31) |

Test counts by file (measured with Vitest's JSON reporter): `loader-and-schema` 9; `validate` 19 (incl. the new Phase 2 rules); `projection` 4; `evaluation` 25 (correct, incorrect, edge cases, malformed and oversized input, untrusted fields, evaluator crashes); `python-verify` 12; `synthetic-100` 5; `domain/progression` 20 (unlocks, state transitions, mastery, XP, duplicate prevention, replay policy, hints); `services/learning-service` 15 (views, judging, idempotency, untrusted fields, prerequisites, learner isolation, replay, hints, store); `content/python-fundamentals` 12 (structure, sequence, reachability, every answer key accepted, a wrong answer judged incorrect for every challenge, all 133 misconception messages delivered, XP derivation, full 1→25 playthrough); `runner` 1. Total 122.

## 8. Python example verification

`content:verify-python` executes, with CPython 3.13.16 in isolated mode (temp directory, minimal environment, 5-second timeout, 64 KB output cap): 69 lesson examples, 24 predict-output answer keys, 8 fill-in accepted answers (every variant), 6 accepted line orders, 7 trace answers, 13 buggy programs (proving the bug is real) and 13 fixed programs — **140 runnable claims, all passing**.

To confirm the checker actually detects errors, six deliberate mutations were made to a scratch copy of the real content (a wrong slice output, a wrong exception type in an example and in a bug, a wrong trace value, a wrong fixed-program output, and an extra wrongly-accepted fill-in answer). **All six were reported as failures.** Multiple-choice facts are not executable; the ones that state Python behaviour (error types and messages, `range`, slicing, `==` across types, imports) were spot-checked directly with Python 3.13 and all matched.

Boundary notes: set and dictionary output in examples uses `sorted()` or `len()` so it is deterministic; random values are never printed exactly; examples using `input()` supply `stdin` and call `input()` without a prompt so the output is unambiguous.

## 9. Security review

- **No learner code is executed.** All six formats are judged deterministically. The CodeRunner remains disabled; `code_write` cannot be published.
- **Answers stay on the server.** The public projection is a whitelist; tests plant canary strings in every key field of every format and check all 25 real levels for hint/explanation leakage. Explanations are returned only after a correct answer; hints only on request and in order.
- **Clients cannot set scores.** Request schemas are strict: `xp`, `correct`, `score` or `learnerId` in a body is a `bad_request`. Correctness comes from the evaluator; XP from the domain policy; prerequisites are checked by the service on every read and write.
- **Idempotency and races.** Submission ids are idempotent and cannot be reused for another challenge; XP award keys are unique; the store uses optimistic revisions and rejects stale writes.
- **Abuse limits.** Submission text and list sizes are capped; evaluation failures are contained and their internal causes are not sent to clients.
- **Not yet addressed (no endpoint exists):** authentication (the learner id is trusted from the caller, R-36), rate limiting, durable storage and database-level constraints/RLS (R-01–R-03, R-33).
- No secrets, environment variables, network calls or new dependencies were added. Diff reviewed for secrets before committing.

## 10. Dependency and cloud-cost impact

- Dependencies: **none added or changed**.
- External services or cloud resources: **none**. Infrastructure cost: **$0**.
- Usage: Claude cloud-session credit for this session, and GitHub Actions minutes for CI on push.

## 11. Known limitations

- **Human review is pending** for all 25 levels (`review.kind: agent`, validator warning, home-page notice; DEC-004, O-13). Automated checks prove runnable claims, not teaching quality.
- Multiple-choice and explanation prose are not machine-verifiable; facts were spot-checked, wording was not independently reviewed.
- No code-writing exercises: they need an approved sandbox (P-004). The path teaches by prediction, tracing, completion, ordering and debugging.
- Fill-in answers accept only listed variants (trimmed); equivalent formatting such as `x+1` vs `x + 1` must be listed by authors.
- Mastery is a defined heuristic (clean first try or clean replay of knowledge checks), not a measured learning outcome; there is no spaced review yet.
- File handling is not covered (deferred to levels 26+). The level 22 error message quoted in a question uses Python 3.13 wording; only exception class names are machine-checked.
- Progress is stored in memory only: lost on restart, not shared across servers or devices (`progressIsDurable: false`). No authentication, UI, quests, achievements or leaderboard.
- The hint leak check is heuristic (catches copied answers of six or more characters, not paraphrases).

## 12. What remains for the game engine and interface

- **Game engine:** quests and achievements evaluated from `ProgressionEvent`s using the existing predicate vocabulary in `path.yaml`; checkpoint presentation; leaderboard ranking and tie-break rules on the XP ledger; owner confirmation of DEC-002 numbers.
- **Persistence and identity:** Postgres schema and migrations mirroring `LearnerProgress`/XP ledger with unique constraints and RLS, a durable `ProgressStore`, managed authentication supplying the learner id, rate limiting.
- **Interface:** map rendered from zones/levels, room/lesson view from `PublicLevel`, a component per challenge format using the submission shapes above, feedback and hint UI, journal, profile, leaderboard.

## 13. Commit and branch

- Branch: `claude/tender-cerf-ooekni`; previous head `f63a59b`.
- The Phase 2 commit hash and its CI result are reported in the hand-off message for this phase (a commit cannot contain its own hash).

## 14. Recommended Phase 3 starting point

**Phase 3 — Game engine: quests, achievements and leaderboard ranking (pure domain).** Build on the Phase 2 progression events and XP ledger: quest objective evaluation and persistence shape, achievement predicates, checkpoint rules and a deterministic leaderboard ranking with documented ties, all as pure tested functions behind the same service boundary, still with no database or external services. Before it starts, the owner should confirm or adjust the XP numbers (DEC-002 / O-2), because the leaderboard ranks on them, and decide O-13 (agent-reviewed content).
