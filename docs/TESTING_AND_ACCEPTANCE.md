# Testing and Acceptance Checklist

Do not mark a check complete without an actual result. Add commands/results specific to the verified stack during the repository audit.

## Baseline and build
- [ ] Current build command identified and documented.
- [ ] Lint/format/typecheck commands identified.
- [ ] Unit/integration/e2e tests identified; baseline run recorded.
- [ ] Legacy/pre-existing failures separated from newly introduced failures.
- [ ] Clean setup from README instructions has been tested.

## Curriculum
- [ ] Unique stable IDs and required fields.
- [ ] Published content has objective, explanation, challenge, rubric/answer, feedback and source review metadata.
- [ ] Examples/output tested where relevant.
- [ ] Draft/invalid content cannot be published.
- [ ] Accepted answer variants and ambiguous prompts covered.

## Game rules
- [ ] Unlock prerequisites and state transitions.
- [ ] Failed attempt never deletes durable progress.
- [ ] Checkpoint/resume survives refresh/re-login.
- [ ] Duplicate request cannot award XP twice.
- [ ] Client cannot submit trusted score/XP/unlock/achievement.
- [ ] Quest and achievement predicates work and cannot be duplicated.
- [ ] Leaderboard score, ranking, ties and pagination are deterministic.
- [ ] Level/path model is not hardcoded only to 25.

## Auth/data
- [ ] Signup/login/logout and protected routes.
- [ ] User A cannot read/write user B private records.
- [ ] Ownership is enforced server-side/database-side.
- [ ] No privileged keys in browser bundle, Git, logs or docs.
- [ ] Errors and rate limits behave safely.

## UI/e2e
- [ ] Start → lesson → challenge → feedback → XP → saved progress → next unlock.
- [ ] Correct and incorrect feedback are useful and accurate.
- [ ] Quests and leaderboard update using actual persistence.
- [ ] Loading, empty, offline/error, signed-out and expired-session states.
- [ ] Keyboard navigation, visible focus and form labels.
- [ ] Contrast, responsive desktop/mobile and reduced motion.
- [ ] Visual/reference assets have provenance/licence notes.

## Deployment
- [ ] Actual provider/account is confirmed and approved.
- [ ] Costed resource plan, budget alert/hard-cap distinction and cleanup plan approved.
- [ ] HTTPS/auth redirect/database secrets configured properly.
- [ ] Staging smoke test and backup/rollback path verified.
- [ ] Cloud costs/resources reported accurately.

## Acceptance definition

The 25-level MVP is accepted only when the user journey is actually verified, critical/high security issues are resolved, required tests pass, and any incomplete item is prominently documented rather than implied complete.
