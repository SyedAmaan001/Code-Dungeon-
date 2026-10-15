# Code Dungeon — Decision Register

**Purpose:** record what has been decided, why it matters, when it applies, and what remains open. This is the canonical decision register. Do not silently turn a recommendation into an owner decision.

**Status vocabulary:** `CONFIRMED` = owner explicitly agreed; `DEFAULT` = recommended direction unless repository evidence disproves it; `PENDING` = requires verification or approval; `DEFERRED` = intentionally out of MVP.

## 1. Core product decisions

| ID | Decision | Status | Why | What it means now | When / revisit |
|---|---|---|---|---|---|
| D-001 | Product name is **Code Dungeon** (not Code Clash/CodeClash). | CONFIRMED | The experience is learning through a dungeon world, not just a coding battle. | Use Code Dungeon in all new branding, docs, routes and metadata. Legacy names may remain in files until safely migrated. | Immediately; revisit only if owner renames it. |
| D-002 | Architecture has three independent layers: learning engine, game engine, world/interface. | CONFIRMED | Subjects/content should change without rewriting progression or art/UI. | Define clear types/interfaces and separate content, domain rules and rendering. | Foundation phase; validate in architecture review. |
| D-003 | Broad, multi-subject platform; first path is Python Fundamentals. | CONFIRMED | Python proves the first learning loop while the engine remains general-purpose. | Model subjects, learning paths, skills, versions and challenge types as data. Do not build arbitrary subject generation as a requirement for MVP. | Python MVP; expand after validation. |
| D-004 | Prototype launches with 25 meaningful levels, while architecture supports 100+. | CONFIRMED | Focus the first release and avoid an empty, padded 100-level map. | Publish 25 real levels; level numbers are data, not UI branches. Future levels are locked/absent, not fake playable content. | MVP and data-model design; expand only after quality gate. |
| D-005 | Login/accounts are required; progress must persist. | CONFIRMED | Learners must return to their own saved progress and scores. | Implement managed auth where practical; protect private progress by user ownership. | Core playable milestone. |
| D-006 | Real quests and leaderboard are wanted in the MVP. | CONFIRMED | Goals and visible progression support engagement; scores need cross-session persistence. | Quest objectives/completion and score aggregation must be real. Use actual saved score data; no fake players in production. | After core challenge/progress loop; leaderboard metrics need documented rules. |
| D-007 | Single-player first; multiplayer is not MVP scope. | CONFIRMED | Prove learning and progression before introducing real-time complexity. | No rooms, spectator mode or real-time sync in current plan. Keep model extensible, but do not build multiplayer pre-emptively. | Revisit after MVP has users/validated need. |
| D-008 | Learning correctness outranks gamification. | CONFIRMED | A pretty game with incorrect answers undermines the product. | Every published lesson needs an observable objective, verified answer/rubric, feedback, example output where relevant, and source/review metadata. | Every content release. |
| D-009 | Mistakes may affect a run bonus, but must not erase account progress/mastery. | CONFIRMED in blueprint | Learners should be able to recover and learn from feedback. | Separate run state from durable learning history and completed progress. | Game engine. |
| D-010 | Art direction is atmospheric illustrated fantasy, not generic SaaS and not purely old-school pixel art. | CONFIRMED | References show painterly environments, distinct biomes, item illustration and ornate gold/teal details. | Use map/rooms as the product surface; preserve readability/accessibility. Create original or licensed assets. | Prototype art review before generating large asset packs. |
| D-011 | Use existing open source, managed services, APIs or MCP integrations when justified. | CONFIRMED | Avoid rebuilding commodity tools and wasting development time. | Evaluate security, license, maintenance, cost, permissions and fallback for each integration. | Every dependency/integration decision. |
| D-012 | Code Dungeon should be genuinely playable end-to-end, not just a marketing landing page. | CONFIRMED | Advertised features in HTML are not implementations. | No feature is “done” until its user flow and tests work. | All phases. |

## 2. Engineering recommendations (not yet fixed by repository evidence)

| ID | Recommendation | Status | Why | Decision gate |
|---|---|---|---|---|
| R-001 | Inspect repository before choosing or migrating framework. If no viable framework exists, evaluate a TypeScript/React full-stack framework. | DEFAULT | Avoid a gratuitous rewrite; also avoid layering a full product onto disconnected static HTML. | `docs/initial-audit.md` and architecture proposal. |
| R-002 | Prefer managed PostgreSQL + managed auth (e.g. Supabase or equivalent) if compatible with the actual stack, access and budget. | DEFAULT | Reduces custom auth/database operations; relational constraints suit learning/progress data. | Check current pricing, RLS, region, terms, credentials and owner approval before provisioning. |
| R-003 | Use structured/versioned learning content and domain functions for progression/scoring. | DEFAULT | Makes curriculum reusable, testable and expandable to multiple paths/100+ levels. | Architecture phase. |
| R-004 | Start with deterministic challenge formats; use an external sandbox only if safe and affordable. | DEFAULT | Unrestricted code execution on the main app server is dangerous and unnecessary for every exercise type. | Code-runner feasibility review. |
| R-005 | Lifetime earned XP is the simplest initial leaderboard metric; optional weekly board only if cheap/simple. | DEFAULT | Easy to explain and verify; correctness should dominate speed. | Decide exact metric, retry policy and tie-break before implementing production board. |
| R-006 | Use CSS/SVG/optimized 2D art first; avoid heavyweight 3D unless evidence shows it is needed. | DEFAULT | A readable interactive web app can deliver the game loop without a costly 3D pipeline. | After one map/room/challenge vertical slice. |
| R-007 | Keep MVP ongoing external costs near $0–$10/month where practical; alerts and caps where provider supports them. | DEFAULT | The available $100 is Claude cloud-session credit, not hosting budget. | Before choosing/deploying external services; owner approves costed plan. |

## 3. Confirmed cloud-session facts

- The supplied Claude UI screenshot labels the credit **Cloud session credits**, showing `$100 of $100 left` and an expiry displayed as `1:29 PM GMT+5:30, November 5`.
- The screenshot states that it applies automatically to cloud sessions; after use/expiry, regular plan usage applies.
- This is not proof of a production hosting credit. The exact expiry year/date must be confirmed in the account UI.
- The environment was created by the owner and called `code-dungeon-dev`; setup guidance says `Trusted` network access, no secrets/variables initially and blank setup script until the repository is inspected. Verify these settings in the actual account rather than trusting docs blindly.

## 4. Pending decisions (do not guess)

| ID | Open question | Recommendation | Why it remains open | Required before |
|---|---|---|---|---|
| P-001 | What framework/build system actually exists in GitHub? | **RESOLVED 2026-10-15** — see DEC-001. | Audit (`initial-audit.md`) found documentation only; owner approved the proposed stack for Phase 1. | — |
| P-002 | Which production hosting provider/project is available? | Identify from owner account/access; Claude cloud is not assumed to host the app. | No production provider was confirmed. | External deployment. |
| P-003 | Which auth/database vendor will be used? | Managed auth + managed relational DB if cost/fit/access checks pass. | Credentials, current pricing and provider not yet confirmed. | Provisioning and integration. |
| P-004 | Is arbitrary Python execution required in the first public MVP? | Launch deterministic challenge modes first; add safe sandbox only if feasible. | Security, service availability and current provider prices need research. | Exposing code-runner UI. |
| P-005 | Exact XP, retries, hint and leaderboard rules? | Correctness/completion dominate; speed bonus capped; no lost mastery. | Product requires rules, but exact numbers and tie method need formal testable spec. | Scoring implementation. |
| P-006 | Final typography/assets/licenses and per-biome art style? | Produce one approved map/room/challenge slice, then scale art. | References set direction, not finished production assets. | Bulk asset generation. |
| P-007 | Public launch/privacy terms/account deletion/analytics choices? | Minimize data; document retention and deletion. | Jurisdiction, audience and provider details must be known. | Public release. |

## 5. Decision workflow

1. Propose a decision with context, options, recommendation, cost/security impact, and consequences.
2. Label it `DEFAULT`, `PENDING` or `CONFIRMED` accurately.
3. Ask the owner only when repository evidence cannot resolve it and the choice materially affects architecture, cost, safety, data or product experience.
4. When the owner decides, update this file and any impacted docs in the same change.
5. Do not silently change confirmed decisions; record any superseding decision with date and reason.

## 6. Decision record template

```md
### DEC-XXX — Short decision title
- Status: PROPOSED | CONFIRMED | SUPERSEDED
- Date:
- Context/problem:
- Options considered:
- Decision:
- Why:
- Consequences/trade-offs:
- Security/privacy/cost impact:
- Revisit trigger:
- Links/tests/evidence:
```

## 7. Decision records

### DEC-001 — Application foundation stack
- Status: CONFIRMED (owner approval of Phase 1 as described in `next-steps.md` / `architecture-proposal.md`)
- Date: 2026-10-15
- Context/problem: The repository contained documentation only (P-001); the MVP needs a maintainable full-stack TypeScript foundation with content kept separate from game rules and UI.
- Options considered: see `architecture-proposal.md` §2 and §14.
- Decision: Next.js 16 (App Router) + React 19 + TypeScript (strict, pinned 6.0.3), npm with committed lockfile, Node 22 LTS (`.nvmrc`, `engines >=22.12`), Zod 4 schemas, YAML content packs, Vitest, ESLint 9 (Next config + layer-boundary rules), Prettier, GitHub Actions CI with a real CPython 3.13 for content verification.
- Why: one language across content schemas, engines and UI; reviewable content diffs; no external services required for the foundation.
- Consequences/trade-offs: TypeScript 7 and ESLint 10 exist but are not yet supported by `typescript-eslint` / Next's ESLint plugins, so they are pinned one major back. Tailwind, Radix, Shiki, Supabase, Drizzle and Playwright remain the documented baseline but are **not installed** until the phase that needs them (each to be confirmed then).
- Security/privacy/cost impact: no secrets, no external services, $0 infrastructure. `npm audit --omit=dev`: 0 vulnerabilities; 5 high findings exist only in dev lint tooling (see risk R-31).
- Revisit trigger: `typescript-eslint` supports TypeScript 7; Next.js major release; any need for a second backend.
- Links/tests/evidence: `docs/phase-1-report.md`, `.github/workflows/ci.yml`.

### Defaults applied in Phase 1 (not owner-confirmed; change by recording a new decision)
- **O-3 Python version:** content targets Python ≥ 3.10 (`minLanguageVersion` in `path.yaml`); CI verifies with CPython 3.13. Status: DEFAULT.
- **O-7 Docs naming:** existing UPPER_SNAKE docs stay canonical; new docs use lower-kebab; `decision.md` remains the decision log. Status: DEFAULT.
- **Content storage:** curriculum lives in Git as YAML content packs (`content/<pack>/`); the database will later hold only a registry of IDs/versions. Status: DEFAULT (architecture-proposal §6.2).

### DEC-002 — Progression policy: XP, completion, mastery, unlocks and replay
- Status: DEFAULT (applied in Phase 2; configurable; awaiting owner confirmation — open item O-2)
- Date: 2026-10-15
- Context/problem: The learning engine needs explicit, testable rules for attempts, completion, mastery, XP and replay (P-005). No owner-approved numbers existed.
- Options considered: speed/time bonuses; XP penalties for wrong answers or hints; mastery from a single answer; repeat XP on replay.
- Decision (all values live only in `src/domain/policy.ts`):
  - **XP:** first correct answer to a challenge = 10 × difficulty (1–3); +5 if the first counted attempt is correct with no hint; level completion 25 / checkpoint 50 / major 75 / boss 150; mastery bonus 0. No negative XP, no time bonus.
  - **Attempts:** only well-formed, judged answers count. Invalid submissions and engine errors are not attempts.
  - **Completed:** every required challenge in the level answered correctly at least once.
  - **Mastered:** completed, and every knowledge-check challenge demonstrated — correct without a hint either on its first counted attempt or in a replay after the level was completed.
  - **Unlock:** a level unlocks when all its prerequisites are completed.
  - **Replay:** allowed; earns no repeat XP (award keys are unique per learner), but can earn mastery.
  - **Duplicates:** a resent submission id returns the original result; XP is awarded at most once per source key.
- Why: correctness dominates (bonus ≤ a third of base), hints never block learning, mistakes never remove progress, and mastery is not claimed from an immediate retry after feedback.
- Consequences: total available XP for the Python path is fixed by content difficulty and level kinds (see `docs/PHASE_2_REPORT.md`). Changing a number changes future awards only; existing ledger entries are kept.
- Security/privacy/cost impact: XP is computed server-side from evaluator results; clients cannot submit XP, correctness or learner ids.
- Revisit trigger: owner confirms or changes the numbers; leaderboard design (weekly boards) or spaced review.

### DEC-003 — Python Fundamentals curriculum sequence and zone titles
- Status: CONFIRMED (owner-provided topic sequence in the Phase 2 instruction, 2026-10-15)
- Context/problem: The earlier outline (`00_TO_100.md` §6, blueprint §5) was explicitly a plan to be validated. The owner supplied a revised 25-topic sequence.
- Decision: levels 1–25 follow the owner's sequence exactly (no reordering was needed for prerequisites). Zone IDs, theme keys and art titles are unchanged; curriculum zone 3 is retitled "Looping Forge" (was "Function Forge") because functions now fall in zones 4–5. Checkpoints/major/boss stay at 5, 10, 15, 20 and 25. Topics from the old outline that are not in the new sequence: reading error messages is covered in level 22, exceptions in level 24 and problem decomposition in the level 25 capstone; **file handling is not covered** and is deferred to levels 26+.
- Consequences: `00_TO_100.md` §6 and the blueprint §5 outline are superseded for level content; those documents are kept unchanged as history.

### DEC-004 — Content schema v2 and agent-reviewed publication
- Status: DEFAULT (pending owner decision on human review — open item O-13)
- Decision: content schema v2 adds lesson objectives/examples/practical context, level descriptions, challenge roles (exercise/check), exactly three progressive hints for published challenges, and runnable checks for fill-in, ordering, tracing and bug-fix challenges. The 25 Python levels are `published` with `review.kind: agent`; validation emits a warning while any published level lacks human review, and the home page states it.
- Why: the levels pass every automated gate, but CONTENT_QUALITY_STANDARD asks for reviewer verification; an AI agent's self-review is recorded honestly rather than presented as human review.
- Revisit trigger: a human reviewer signs off a level (set `review.kind: human`) or the owner decides that agent review is insufficient for publication (then set levels to `review`).

### Note on report file naming
`docs/PHASE_2_REPORT.md` uses the UPPER_SNAKE name the owner requested; this is an explicit exception to the O-7 lower-kebab default. `docs/phase-1-report.md` keeps its existing name.

### DEC-005 — Game engine rules: encounters, checkpoints, quests, achievements and rewards
- Status: DEFAULT (applied in Phase 3; values configurable in `src/domain/game/policy.ts`; awaiting owner confirmation)
- Date: 2026-10-15
- Context/problem: Phase 3 adds quests, achievements, checkpoint and boss encounters on top of the learning engine, with the instruction to preserve the XP policy (DEC-002) and the prerequisite rules.
- Decision:
  - **Encounters** are checkpoint, major and boss levels, played in runs. A run starts with the first counted answer or revealed hint. Checkpoint runs cannot be lost; major and boss runs have **3 lives**, and each counted wrong answer costs one. At zero lives the run is defeated and the next answer starts a fresh run. An encounter is won when every required challenge is solved within one run; "flawless" means the winning run had no wrong answers and no hints. Replays after victory are practice and start no runs.
  - **Checkpoints** are recorded when a checkpoint encounter is won; the latest one is shown as the last checkpoint. The resume point is the first unlocked, unfinished level.
  - **Encounters do not gate unlocks or change XP.** Level completion and unlocks remain exactly as DEC-002; a defeat never removes progress or XP. (Gating the next level on boss victory would change the approved prerequisite rules and was not done.)
  - **Quests** activate when their optional `activation` predicate is met (or immediately), complete when all required objectives are met, and keep tracking optional objectives afterwards. **Achievements** unlock when their predicate is met. Both are evaluated from verified progress and awarded at most once.
  - **Rewards are cosmetic items only.** Quest/achievement XP is disabled (`rewards.xpEnabled: false`), and validation rejects `reward.xp > 0`, because paying it would change the approved XP totals. Enabling it needs an owner decision.
  - Content schema additions are additive (v2 files still parse): predicates `level_unlocked`, `master_level_count`, `encounter_won`, `encounters_won`, `flawless_encounters`; quest `activation`; objective `optional`.
- Consequences: the maximum XP of the Python path stays 2,455. Encounter state is a separate game record; until storage is transactional, an encounter update can be lost if its save fails, while quests and achievements self-heal (R-37).
- Revisit trigger: owner wants boss gating, quest XP, different lives, or penalties; learner testing shows lives are too strict or too lenient.

### DEC-006 — Leaderboard ranking and public handles
- Status: DEFAULT (ranking implemented; persistent leaderboard pending storage and authentication)
- Date: 2026-10-15
- Decision: metric = lifetime XP from the verified XP ledger (R-005). Order: XP descending → time the current XP total was reached, earliest first → handle (case-insensitive, then exact) → internal player id (never displayed). Rank = competition ranking (1, 2, 2, 4) on equal XP *and* equal reached-at time; the later rules only fix display order within a shared rank. Only visible players with at least 1 XP are ranked; output shows rank, handle and XP only, plus the viewer's own rank or the reason they are unranked (hidden, no XP, unknown). Default top 10, maximum 100. Handles: 3–20 characters, starting with a letter, letters/digits/`_`/`-`, reserved words refused, unique case-insensitively. No offensive-word filter yet (R-08).
- Consequences: with in-memory adapters the leaderboard only compares players held in one server process and is flagged `persistent: false`. It is not a persistent or cross-session leaderboard.
- Revisit trigger: persistence/authentication phase; weekly boards; moderation needs.
