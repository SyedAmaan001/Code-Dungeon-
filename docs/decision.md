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
| P-001 | What framework/build system actually exists in GitHub? | Audit first; preserve a viable existing stack. | The provided file set mixed static HTML/CSS/JS with legacy compiled CodeClash artifacts; actual repo may differ. **Audit 2026-10-15 (`initial-audit.md`): the repository contains documentation only — no framework, manifest or legacy source files. Stack proposal awaiting owner approval in `architecture-proposal.md` (open item O-1 in `next-steps.md`).** | Architecture choice. |
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
