# Data Model — Logical Contract

This is a provider-independent logical model. The implementation must adapt it to the chosen database/auth service and write migrations. It is not a claim that these tables currently exist.

## Main relationships

```text
Subject 1 ── N LearningPath 1 ── N Zone 1 ── N Level
                                  │              ├── N Lesson
                                  │              └── N Challenge
Skill N ── N Level/Challenge
LearningPath 1 ── N Quest
AuthUser 1 ── 1 Profile
AuthUser 1 ── N LevelProgress
AuthUser 1 ── N Attempt
AuthUser 1 ── N QuestProgress
AuthUser 1 ── N XPTransaction
AuthUser N ── N Achievement (via UserAchievement)
```

## Minimum integrity invariants

1. Every published level references an existing path and zone; order is unique within the path.
2. A learner only sees protected progress associated with their authenticated user ID.
3. An XP transaction references a qualifying event and cannot be awarded twice for the same idempotency/source event.
4. Attempt results are normalized and validated by trusted logic; a browser cannot directly set `score`, `xp`, `completed`, `role` or another user's ID.
5. Quest completion is derived from defined objective predicates; not merely a client boolean.
6. Achievement grants are unique and auditable.
7. Published content and answer keys are versioned; edits don't silently invalidate historical attempts.
8. Public leaderboard output contains only approved public fields and computed rank/score.
9. Deleting an account follows a documented policy and does not accidentally remove other users' shared content.
10. Database migrations and reset procedures are repeatable and tested against non-production data.

## Suggested tables/fields

See the detailed schema section in `00_TO_100.md`. Exact columns, constraints and indexes must be finalized after stack/provider selection and query patterns are known. Use foreign keys, UTC timestamps, unique constraints and indices for path sequence, user progress and leaderboard ranking. Avoid redundant totals unless there is an audited aggregate strategy.
