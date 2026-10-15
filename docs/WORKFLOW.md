# Code Dungeon — Working Workflow

This guide describes the repeatable loop for a human owner + Claude Code on the web + GitHub. It also defines the target developer workflow once the actual stack is confirmed. Commands are intentionally not hardcoded before the repository audit identifies its package manager and tooling.

## 1. Roles

- **Owner:** confirms product decisions, reviews PRs, approves credentials/permissions and billable-resource plans, and provides any missing provider access.
- **Claude Code:** inspects and implements scoped tasks in the selected repository/cloud environment, runs checks and records evidence. It must not claim deployment just because a branch/PR exists.
- **GitHub:** source of truth for reviewed files, branch/commit/PR history and issue/task tracking.
- **External services:** only selected after documented purpose, pricing, access controls and fallback are reviewed.

## 2. Start-of-session checklist

1. Select the correct repository in Claude Code and confirm it is the intended Code Dungeon repo.
2. Select the `code-dungeon-dev` cloud environment.
3. Check the current branch and Git status; identify existing changes before touching files.
4. Read `CLAUDE.md`, `docs/decision.md`, relevant parts of `docs/00_TO_100.md`, `docs/EXECUTION.md` and the task-specific docs.
5. Choose one clearly bounded task with acceptance criteria.
6. Confirm the task doesn't require an unapproved external service, secret, destructive action or billable resource.
7. Ask Claude to report its plan before a risky structural change.

## 3. A good task prompt format

Use this structure for each Claude task:

```text
Goal:
[One outcome, not the entire product.]

Read first:
[Relevant docs and files.]

Constraints:
[Confirmed product decisions, security, spend, no unrelated rewrites.]

Implement:
[Specific behavior and scope.]

Acceptance criteria:
[Observable results/tests.]

Verification:
[Commands to run, inferred from repo scripts.]

Report:
[Changed files, test output, partial/mocked functionality, blockers, costs.]
```

Do not ask Claude to "build everything" in one task. Use `docs/EXECUTION.md` phase boundaries.

## 4. Audit-first session

The first task must be documentation-only:

> Read `CLAUDE.md` and relevant `docs/` files. Inspect the real repository, branch, Git status, package manager/lockfiles, scripts, routes, assets, tests, environment variable names only, deployment config and git history if useful. Run safe baseline checks supported by the repo. Create `docs/initial-audit.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/implementation-plan.md`, and `docs/risk-register.md`. Do not rewrite UI, add dependencies without reason, delete files, add secrets, provision external services or perform billable actions. Clearly distinguish verified facts from recommendations and pending decisions. Report command results and the next recommended task.

## 5. Development cycle

For every feature:

1. **Understand:** locate domain types, route, component, data contracts and tests.
2. **Plan:** explain smallest change and edge cases before touching unrelated modules.
3. **Implement:** use small, typed/testable functions and existing project conventions.
4. **Test:** add regression tests; run targeted tests, then relevant suite/typecheck/lint/build.
5. **Review:** inspect diff for secret leakage, accidental generated files, unsafe dependencies, duplicated state, scope creep and inaccessible controls.
6. **Document:** update decision log/architecture/README when behavior or setup materially changes.
7. **Report:** include exact results, not only "done".
8. **Review and merge:** owner inspects branch/PR; don't merge or deploy automatically if permission is unclear.

## 6. Git strategy

- Use a branch per phase/feature where possible, e.g. `docs/repository-audit`, `feat/learning-domain`, `feat/auth-progress`, `feat/dungeon-map`.
- Keep each PR coherent and reversible.
- Never force-push, reset, rebase away or overwrite owner changes without permission.
- Never commit `.env`, secrets, build output or downloaded proprietary art.
- Prefer small commits with explanatory messages.
- Before a structural rewrite, document why and preserve a rollback route.
- A branch or PR is not a deployment; public hosting must be verified separately.

## 7. Target codebase shape (adapt after audit)

```text
/
├── CLAUDE.md
├── README.md
├── .env.example
├── docs/
│   ├── decision.md
│   ├── 00_TO_100.md
│   ├── EXECUTION.md
│   ├── WORKFLOW.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── content-quality-standard.md
│   ├── security-and-privacy.md
│   ├── testing-and-acceptance.md
│   ├── deployment-runbook.md
│   ├── cloud-plan.md
│   ├── risk-register.md
│   └── visual-references/
├── src/                         # framework-specific; decide after audit
│   ├── app-or-routes/            # navigation/auth/pages
│   ├── components/               # reusable UI, not domain rules
│   ├── features/                 # map, lessons, quests, profile, leaderboard
│   ├── domain/                   # deterministic learning/game logic
│   ├── content/                  # versioned subject/path data
│   ├── services/                 # persistence, auth, code-runner adapters
│   └── styles/                   # tokens/theme/accessibility
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── scripts/                      # content validation/maintenance tools
```

This is a proposed shape, not a demand to match it exactly. If the actual stack already has a good structure, document and preserve its conventions.

## 8. Domain/data flow

`UI event → authenticated server action/API → validate ownership and state → deterministic domain rule → persist attempt/score/progress transaction → return normalized result → update UI`.

The browser may display a score but cannot authoritatively choose it. Scoring, unlocks and awards must be checked by trusted server/database logic. For a code execution service, user code is sent only to a sandbox adapter with secrets isolated; it is never executed as unrestricted app-server code.

## 9. Content workflow

1. Define objective, prerequisites and common misconceptions.
2. Draft original lesson/example/challenge.
3. Cite official/reputable learning source and record edition/version/review date.
4. Verify code/output/answer with an appropriate test.
5. Test alternative accepted answers and ambiguous edge cases.
6. Review explanation and feedback for likely mistakes.
7. Run curriculum schema validation.
8. Publish only when all required checks pass; otherwise mark `draft`.
9. Version meaningful changes to answer keys or lesson semantics.

Never copy chapters, proprietary exercises, characters or art. Record license/attribution for reused materials.

## 10. Environment and secrets workflow

- Use `.env.example` with variable names and safe placeholders only.
- Add real credentials through an approved secret manager/environment UI after the architecture and permissions are known.
- Never paste secret values into prompts, logs, docs, issues, screenshots or Git.
- Check only whether a required variable is present; don't echo its value.
- Use separate development/staging credentials; do not connect tests to production users/data by default.
- Cloud environment should start with least privilege (the currently selected Trusted network policy is a starting point, not unlimited access).

## 11. Deployment workflow

1. Identify the actual hosting provider/account and whether the project has permission to deploy.
2. Write `docs/cloud-plan.md`: all resources, pricing/date/assumptions, credit applicability, egress/build/logging/email/DB/AI/code runner costs, alerts vs caps, secrets, backups, rollback, cleanup.
3. Get owner approval for named billable resources.
4. Provision only approved staging resources; don't alter/delete existing resources casually.
5. Configure HTTPS, environment secrets, auth URLs, database migrations and safe error logging.
6. Run smoke tests against staging; verify login, path progress, challenge submission, XP, quests, leaderboard, access isolation.
7. Verify budget alerts/quotas and document what happens when credits expire.
8. Deploy production only after explicit approval and readiness review.
9. Maintain rollback and account/data cleanup steps.

The `$100` shown in Claude is cloud-session credit for development sessions. It must not be assumed to pay for hosting.

## 12. Incident/bug workflow

- Reproduce the issue in a safe environment.
- Capture the smallest relevant error without tokens, personal information or private data.
- Identify impact and whether security/data/cost are involved.
- Add a regression test.
- Fix, run tests and inspect diff.
- For score/data bugs, reconcile affected records carefully; never silently delete progress.
- For secret exposure, stop use, notify owner, rotate/revoke through the provider, scrub history where possible and document the incident. Do not copy the exposed secret into a bug report.

## 13. Handoff checklist

- [ ] Working tree/diff understood.
- [ ] Tests/commands and exact results reported.
- [ ] No secrets or unintended files committed.
- [ ] Implemented, partial, mocked and missing items distinguished.
- [ ] Access-control and score trust tests run where relevant.
- [ ] Docs/decision log updated.
- [ ] External services, permissions and costs documented.
- [ ] PR/commit and review steps provided.
- [ ] Deployment claims verified separately from code/PR status.
