# Code Dungeon — Execution Plan

This document says **what to do, in what order, what evidence to produce, and when a phase is allowed to finish**. It is a plan, not a claim that the phases have already been completed.

## Working rules

- One coherent phase at a time; keep diffs reviewable.
- Use a feature branch/PR where possible. Never assume a Claude cloud session's filesystem automatically equals a merged GitHub branch or a deployed site.
- Record exact commands and results. An unavailable external integration is `BLOCKED`, not `PASS`.
- Keep cloud-session usage focused. Do not provision external billable infrastructure without an approved named-resource cost plan.
- At each gate, report completed, partial, mocked, failed, blocked and not started separately.

## Phase plan

### Phase 0 — Repository audit (documentation-only)
**Goal:** understand the actual code before changing it.

Tasks:
- Verify repo URL/root, branch, working tree, default branch, current code and docs.
- Identify package manager, scripts, lockfiles, asset paths, environment variable names (never values), routes, tests, build/deployment configuration.
- Map Code Dungeon files versus legacy CodeClash files.
- Run safe baseline tests/build/lint/typecheck if present.
- Identify missing referenced assets and dependency/license concerns.

Deliverables:
- `docs/initial-audit.md`
- `docs/implementation-plan.md`
- `docs/risk-register.md`
- Exact baseline command output summary.

Gate: no source rewrite; owner can understand current reality and proposed stack.

### Phase 1 — Architecture and local development foundation
**Goal:** prepare the smallest maintainable foundation after the audit.

Tasks:
- Confirm stack choice with recorded rationale; preserve any viable existing architecture.
- Define content types, domain functions, data model, route/state boundaries and environment config.
- Establish formatter/linter/typecheck/test commands consistent with stack.
- Add safe `.env.example`, never real secrets.
- Set up migrations if a database is selected later; don't create paid external DB yet.

Deliverables: architecture/data-model docs, a clear folder structure, health/build smoke test, environment instructions.

Gate: clean local/cloud build of the app shell and tests; no external billable resource created.

### Phase 2 — Curriculum and content validation
**Goal:** create accurate, versioned Python Fundamentals content.

Tasks:
- Define schema for subject, path, zone, level, skill, lesson, challenge, answer/rubric, feedback, hints and source citation.
- Author the 25-level outline and actual lesson/challenge content in original wording.
- Validate material against official Python docs and reputable learning references.
- Add content schema/unique ID/answer-key tests; run safe example snippets in a bounded development test process.

Gate: every published challenge has a tested answer/rubric, explanation and source/review metadata. Unreviewed items remain drafts.

### Phase 3 — Domain/game engine (independent of UI)
**Goal:** make the learning/game rules deterministic and unit-testable.

Implement:
- Level prerequisites/unlocks.
- Challenge submission/result normalization.
- Idempotent XP/score events.
- Checkpoint/resume semantics.
- Quest objective state and completion.
- Achievement predicates.
- Progress calculations and leaderboard aggregation/tie rules.
- Content-version compatibility.

Gate: unit tests cover valid/invalid paths, duplicate submissions, failed attempts, retries, unlocks and score integrity. Client cannot set its own score.

### Phase 4 — Account, persistence and permissions
**Goal:** save each learner's state securely.

Tasks:
- Select an auth/database provider only after fit/access/pricing review.
- Use managed authentication unless there is a clear reason not to.
- Create schema migrations, unique constraints, indexes, access/row-level-security policies and ownership validation.
- Protect secrets; use separate dev/staging config.
- Test cross-user reads/writes and idempotency.

Gate: user A cannot read/change user B's progress. Login, logout, protected routes and progress persistence are verified with test accounts. Any external service provisioning requires approval.

### Phase 5 — First playable vertical slice
**Goal:** prove the product loop before scaling visuals/content.

Required journey:
`sign up → log in → open map → enter lesson → complete challenge → receive accurate feedback → earn XP → save checkpoint/progress → unlock next step → refresh/re-login and see saved state`.

Use a small number of fully verified levels initially; do not wait for every visual asset. Build the interface components to consume the reusable content/game types.

Gate: end-to-end test passes; errors/loading/signed-out states exist; a user can complete and resume a level. Review one representative map/room/challenge before bulk visual work.

### Phase 6 — Full 25-level path, five zones and quests
**Goal:** publish the 25-level MVP, not a fake 100-level world.

Tasks:
- Map curriculum levels 1–25 into five zones of five levels each.
- Add meaningful zone/level transitions, checkpoints and major encounters around levels 10, 15/20 as approved in the blueprint. Do not make bosses arbitrary timers.
- Add quests with real objectives/predicates/rewards and persistent quest state.
- Add hints, retry and review behavior.
- Keep content data independent of screen components.

Gate: all 25 levels have valid structured content; quest and unlock rules are tested; no future levels are mislabeled as playable.

### Phase 7 — XP, achievements, profile and leaderboard
**Goal:** make progression persistent, fair and non-fake.

Tasks:
- Implement score/XP transactions using server-trusted results.
- Define retry, hint, first-attempt and tie semantics.
- Profile shows saved progress/achievements; leaderboard uses genuine persisted users/scores and privacy-safe handles.
- Use development fixtures only in clearly labeled development/tests.

Gate: duplicate requests cannot multiply awards; manipulated client scores are rejected; privacy tests pass; rules are explained to players.

### Phase 8 — Art direction and UX completeness
**Goal:** transform the playable slice into the intended fantasy game-world interface.

Tasks:
- Implement tokens, typography, backgrounds, illustrated zone atmosphere, map paths, icons, reward visuals and responsive composition using original/licensed assets.
- Keep lesson/code surfaces readable over dramatic art.
- Add focus, labels, reduced motion, responsive map behavior and empty/loading/error states.
- Avoid copying proprietary elements from the references.

Gate: owner reviews one representative zone + lesson + challenge + success state; accessibility/viewport checks pass before producing many more assets.

### Phase 9 — Safe code-runner decision
**Goal:** decide honestly whether live arbitrary Python execution is feasible.

Tasks:
- Research current providers, isolation guarantees, quotas, terms, costs, latency and privacy.
- If selected, implement an adapter with time/memory/output/code-size/request limits and negative tests.
- If not viable, keep validated deterministic exercises and clearly label live code execution as deferred.

Gate: no arbitrary user code runs unsandboxed on the main application server; no fake execution results.

### Phase 10 — Hardening and release candidate
**Goal:** confirm correctness, accessibility, security and reproducibility.

Run unit, integration, content-validation, typecheck, lint, build and end-to-end tests. Perform dependency/secrets checks, authorization tests, accessibility checks, responsive checks and manual smoke test. Fix critical/high issues before any public release.

Deliver `docs/testing-and-acceptance.md`, `docs/security-and-privacy.md`, updated changelog and a known-limitations list.

Gate: every required acceptance criterion passes or has an explicit owner-approved exception documented as incomplete.

### Phase 11 — Staging/deployment (separate approval gate)
**Goal:** deploy only to a clearly identified, owner-approved provider/project.

Before resources are created, prepare `docs/cloud-plan.md` showing actual provider/project, named resources, region, pricing date, low/moderate cost estimates, credits and eligibility, variable costs, alert vs hard cap distinction, secrets, data/backups, rollback and cleanup. Claude's $100 cloud-session credits do not pay for production hosting by assumption.

Gate: owner approves exact resource plan. Use least privilege, staging first, HTTPS, correct environment variables, rollback and cost controls. Do not delete existing resources as cleanup without explicit approval.

### Phase 12 — Handoff and next 100 levels
**Goal:** leave the project reproducible and ready to expand.

Deliver:
- Setup instructions proven from a clean environment.
- Architecture/data model/decision log.
- Full 25-level curriculum status and sources.
- Actual test results and unresolved failures.
- Deployment and rollback runbook.
- Resource/cost inventory and cleanup steps.
- Next-path/level authoring guide.

The 100-level expansion is a content/quality roadmap, not MVP acceptance. Design should support it without publishing empty content.

## End-of-phase report template

```md
## Phase report — [phase]
- Status: PASS | PARTIAL | BLOCKED | FAIL
- Commit/PR:
- Files changed:
- Features implemented and verified:
- Features partial/mock/deferred:
- Commands run and exact results:
- Security/privacy findings:
- External services/dependencies/permissions:
- Cloud resources/costs (or "none created"):
- Known bugs/blockers:
- Next task:
- Owner decision required (if any):
```
