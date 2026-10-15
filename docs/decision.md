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
| P-002 | Which production hosting provider/project is available? | **PARTLY RESOLVED 2026-10-15** — see DEC-013: Supabase (auth + PostgreSQL) intended, Vercel proposed for the frontend; nothing provisioned. | Compatibility, region and cost verification, then explicit approval to create resources. | External deployment. |
| P-003 | Which auth/database vendor will be used? | **RESOLVED 2026-10-15** — Supabase Auth and Supabase PostgreSQL (DEC-009, DEC-013). | Project creation and credentials still need explicit approval. | Provisioning and integration. |
| P-004 | Is arbitrary Python execution required in the first public MVP? | Launch deterministic challenge modes first; add safe sandbox only if feasible. | Security, service availability and current provider prices need research. | Exposing code-runner UI. |
| P-005 | Exact XP, retries, hint and leaderboard rules? | Correctness/completion dominate; speed bonus capped; no lost mastery. | Product requires rules, but exact numbers and tie method need formal testable spec. | Scoring implementation. |
| P-006 | Final typography/assets/licenses and per-biome art style? | Produce one approved map/room/challenge slice, then scale art. | References set direction, not finished production assets. | Bulk asset generation. |
| P-007 | Public launch/privacy terms/account deletion/analytics choices? | Minimize data; document retention and deletion. Audience is 13+ (DEC-010); launch jurisdictions are still unknown. | Jurisdiction and provider region must be known; legal questions are listed in DEC-010. | Public release. |

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
- Status: CONFIRMED by DEC-012 (2026-10-15); was DEFAULT (applied in Phase 2)
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
- Status: REFINED by DEC-011 (2026-10-15): human review required before public release
- Decision: content schema v2 adds lesson objectives/examples/practical context, level descriptions, challenge roles (exercise/check), exactly three progressive hints for published challenges, and runnable checks for fill-in, ordering, tracing and bug-fix challenges. The 25 Python levels are `published` with `review.kind: agent`; validation emits a warning while any published level lacks human review, and the home page states it.
- Why: the levels pass every automated gate, but CONTENT_QUALITY_STANDARD asks for reviewer verification; an AI agent's self-review is recorded honestly rather than presented as human review.
- Revisit trigger: a human reviewer signs off a level (set `review.kind: human`) or the owner decides that agent review is insufficient for publication (then set levels to `review`).

### Note on report file naming
`docs/PHASE_2_REPORT.md` uses the UPPER_SNAKE name the owner requested; this is an explicit exception to the O-7 lower-kebab default. `docs/phase-1-report.md` keeps its existing name.

### DEC-005 — Game engine rules: encounters, checkpoints, quests, achievements and rewards
- Status: CONFIRMED by DEC-012 (2026-10-15); was DEFAULT (applied in Phase 3; values in `src/domain/game/policy.ts`)
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
- Status: CONFIRMED by DEC-012 (2026-10-15); persistent since Phase 4, shown in the interface since Phase 5
- Date: 2026-10-15
- Decision: metric = lifetime XP from the verified XP ledger (R-005). Order: XP descending → time the current XP total was reached, earliest first → handle (case-insensitive, then exact) → internal player id (never displayed). Rank = competition ranking (1, 2, 2, 4) on equal XP *and* equal reached-at time; the later rules only fix display order within a shared rank. Only visible players with at least 1 XP are ranked; output shows rank, handle and XP only, plus the viewer's own rank or the reason they are unranked (hidden, no XP, unknown). Default top 10, maximum 100. Handles: 3–20 characters, starting with a letter, letters/digits/`_`/`-`, reserved words refused, unique case-insensitively. No offensive-word filter yet (R-08).
- Consequences: with in-memory adapters the leaderboard only compares players held in one server process and is flagged `persistent: false`. It is not a persistent or cross-session leaderboard.
- Revisit trigger: persistence/authentication phase; weekly boards; moderation needs.

### DEC-007 — Local-first PostgreSQL persistence
- Status: DEFAULT (implemented in Phase 4; no hosted database chosen — P-002/P-003 remain open)
- Date: 2026-10-15
- Context/problem: Phase 4 requires durable player profiles, learning progress, XP records, encounters, quests and achievements; learning and game state saved in one transaction; per-user isolation; no external services.
- Decision:
  - **PostgreSQL** (tested on 16) with plain SQL migrations in `db/migrations/`, applied by a small in-repo runner (ordered files, SHA-256 checksums, advisory lock, one transaction per file). `supabase/migrations/` from the proposal was not used because no provider is approved; the SQL is provider-neutral.
  - **Driver:** `postgres` 3.4.9 (zero dependencies, Unlicense) — the only new dependency. No ORM.
  - **Isolation:** row-level security on every player table. Each transaction switches to the non-owner role `code_dungeon_app` and sets `app.player_id` from the server's verified identity; with no identity set, nothing is visible. Cross-player reads happen only through `leaderboard_records()` (public fields) and `player_id_for_identity()` (id only), both `SECURITY DEFINER`.
  - **Atomicity:** `PostgresPlayerStore.transaction` locks the player's `player_paths` row and writes learning progress and game state together; any failure rolls back both. `GameService` uses this when given a transactional store; the previous two-store path still exists for the in-memory adapters.
  - **Integrity in the database:** award-once XP (primary key on source key), append-only ledger (no UPDATE/DELETE grants), idempotent submissions (primary key on submission id), state CHECK constraints, handle format and case-insensitive uniqueness.
  - **Content stays in Git;** the database stores content ids without foreign keys to a content registry (validated against the loaded pack by the services).
  - **Account deletion** cascades to all of the player's data.
  - **Local development:** `scripts/db/local-postgres.sh` (throwaway cluster, loopback-only trust authentication); any PostgreSQL 15+ reachable through `DATABASE_URL` also works.
- Consequences: the leaderboard and progress are persistent *when* a PostgreSQL store is wired in; nothing is exposed over HTTP until authentication exists (DEC-008). Learning and game services are unchanged in behaviour (all earlier tests still pass).
- Revisit trigger: hosting/database provider approval; content registry need; scale (index or partition the ledger).

### DEC-008 — Authentication integration design (provider pending approval)
- Status: SUPERSEDED by DEC-009 (2026-10-15) — the owner chose the provider and methods; the design in `docs/auth-design.md` stands
- Date: 2026-10-15
- Decision so far: player ids come only from a server-verified session; `players.auth_provider/auth_subject` link one provider identity to one player; `player_id_for_identity()` resolves it under RLS. Recommended provider: Supabase Auth with GitHub/Google OAuth plus email magic link, no passwords at launch.
- Needs owner approval: the provider, sign-in methods (O-5), minimum learner age and consent (O-8), an email sender if email sign-in is chosen, and hosting (P-002).

### DEC-009 — Authentication: Supabase Auth with Google OAuth and email magic link
- Status: CONFIRMED (owner, Phase 5 instruction, 2026-10-15). Supersedes DEC-008.
- Context/problem: accounts and saved progress are required (D-005). Phase 4 prepared the identity link (`players.auth_provider/auth_subject`) and RLS, but no provider was chosen.
- Decision:
  - **Provider:** Supabase Auth. **Methods:** Google OAuth and email magic link. **No passwords** in the initial release.
  - **Email verification is required** for new accounts: the server rejects any session whose user has no confirmed email (`email_confirmed_at`), whatever the sign-in method.
  - **Server-side authorization:** every protected page and server action resolves the session on the server (`supabase.auth.getUser()`, which verifies the token with Supabase) and maps it to a player id with `player_id_for_identity`. The Next.js proxy only refreshes cookies and redirects signed-out visitors early; it is never the security check.
  - **Credentials** live in environment variables. Only the Supabase URL and *publishable* key may reach the browser. No service-role key is used by the application.
  - **No external credentials are configured** without the owner's approval. Until then the Supabase mode is implemented and unit-tested but not exercised against a real project.
  - **Development-only sign-in** (`AUTH_MODE=dev`): an HMAC-signed cookie identity used to play and test the whole app locally against PostgreSQL. It is refused when `NODE_ENV=production`, shows a visible "development sign-in" label and never talks to Supabase. Added because neither a Supabase project (needs approval) nor the Supabase local stack (needs Docker, unavailable here) can be used in this environment.
- Why: managed authentication avoids custom password storage and reset flows; magic link and Google cover learners without a GitHub account; verified email reduces throwaway and mistyped accounts.
- Consequences: the provider identity (`provider = 'supabase'`, `subject = auth user id`) is the only link between Supabase and game data; email addresses are not copied into the game database. Account deletion must also delete the Supabase user, which needs a server-only admin credential — deferred until approved (R-46).
- Security/privacy/cost impact: Supabase free tier is sufficient for development; production plan and cost are part of DEC-013 approval. Session cookies are HttpOnly and set by `@supabase/ssr`.
- Revisit trigger: owner approves creating the Supabase project and credentials; other sign-in methods requested.
- Evidence: `src/auth/`, `tests/auth/`, `docs/auth-design.md`, `docs/PHASE_5_REPORT.md`.

### DEC-010 — Age and consent: 13+ audience, jurisdiction-specific controls pending
- Status: CONFIRMED (audience 13+); launch jurisdictions PENDING
- Date: 2026-10-15
- Decision:
  - Initial target audience is **13 and older**.
  - Onboarding asks a **neutral age question** (birth month and year, no pre-selected answer, no hint about the threshold). The server decides; only the fact that the 13+ check passed, its time and the policy version are stored — **not the birth date**. Under-13 answers create no account and store nothing in the database; a short-lived cookie discourages immediate re-entry.
  - **No further age or consent controls are implemented** until launch jurisdictions are agreed, because no single threshold is universally compliant.
  - **Personal data is minimised:** the game database holds a chosen handle, leaderboard visibility, the provider subject id and the age-check record. Emails stay with the identity provider.
- Unresolved legal requirements (documented, not assumed):
  - **United States (COPPA):** under-13 users need verifiable parental consent; a general-audience service with actual knowledge of under-13 users has obligations. Neutral age screening is the FTC-recognised approach; whether it is sufficient for this product is a legal question.
  - **EU/EEA (GDPR Art. 8):** the age of digital consent varies by member state from 13 to 16; users below it need parental consent where consent is the legal basis. A 13+ threshold is not enough for every member state.
  - **United Kingdom:** UK GDPR sets 13; the ICO Age Appropriate Design Code applies to services likely to be accessed by children under 18 (high-privacy defaults, no nudging, data minimisation).
  - **Other jurisdictions** (e.g. India's DPDP Act defines children as under 18 and requires verifiable parental consent) may make an 18+ or parental-consent flow necessary.
  - Also needed before public release: privacy notice, terms, data retention schedule, account deletion process, and a lawful basis per jurisdiction (P-007).
- Revisit trigger: the owner names launch jurisdictions; legal review.

### DEC-011 — Curriculum publication: distinct AI and human review statuses
- Status: CONFIRMED (owner, 2026-10-15). Refines DEC-004.
- Decision:
  - All 25 existing levels stay playable in **local development and testing**.
  - AI review and human review are **distinct statuses**: `review.kind` is now required (`agent` or `human`); it no longer defaults to `human`, so AI review can never be recorded as human approval by omission. The interface labels agent-reviewed levels "AI-reviewed · human review pending" and never shows them as approved.
  - **Human review is required before public release.** The content release mode (`CONTENT_RELEASE=development|public`, default `development`) decides what is playable: `public` publishes only human-reviewed levels (others are withheld and anything depending on them stays locked), and `npm run content:release-check` fails while any published level lacks human review.
- Consequences: a public build today would have no playable levels; that is intended until a person reviews them.
- Revisit trigger: human review sign-off per level.

### DEC-012 — Game rules locked for Phase 5
- Status: CONFIRMED (owner, 2026-10-15). Confirms DEC-002, DEC-005 and DEC-006, which were DEFAULT.
- Decision: three lives per major or boss run; checkpoint runs cannot be lost; quests and achievements grant **no XP** (cosmetic items only); a boss victory does **not** gate the next level; the Python path maximum stays **2,455 XP**; all progression, checkpoint, quest, achievement and leaderboard rules stay as implemented. Any change needs a new recorded decision with an explanation first.
- Evidence: `src/domain` is unchanged in Phase 5; the domain tests and the 25-level playthrough test (2,455 XP) still pass.

### DEC-013 — Hosting: local first; Supabase and Vercel intended, nothing provisioned
- Status: CONFIRMED direction; provisioning PENDING explicit approval
- Date: 2026-10-15
- Decision: development stays local (PostgreSQL via `npm run db:local`, development sign-in). **Supabase** is the intended hosted authentication and PostgreSQL service. **Vercel** is the proposed frontend host, pending compatibility and cost verification. No production deployment, paid resource or external service is created or activated without explicit approval.
- Compatibility notes to verify before approval: Supabase connection pooling vs. the app's `SET LOCAL ROLE` + `set_config` per transaction (transaction pooling is compatible because both are transaction-scoped; verify) and the `code_dungeon_app` role creation on Supabase (R-44); serverless connection limits on Vercel (use the Supabase pooler); region choice for latency and data residency (DEC-010).
- Revisit trigger: owner approves creating the projects and the cost plan.

### DEC-014 — Leaderboard visibility is opt-in at onboarding
- Status: PROPOSED (implemented in Phase 5; owner to confirm — open item O-9)
- Date: 2026-10-15
- Context: the earlier recommendation (O-9) was visible by default with an opt-out. Phase 5 set the audience to 13+ (DEC-010) and asked to minimise personal information.
- Decision: the onboarding checkbox "Show my handle and XP on the leaderboard" starts unchecked; players can change it at any time in their profile. Only handles (never emails) are shown. Ranking rules are unchanged (DEC-006).
- Why: high-privacy defaults are expected for services that minors may use (e.g. UK Age Appropriate Design Code), and the leaderboard still works for everyone who opts in.
- Consequences: an emptier leaderboard early on; no fake players are added to compensate.
- Revisit trigger: owner prefers visible-by-default, or legal review of launch jurisdictions.
