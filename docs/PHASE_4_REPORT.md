# Phase 4 report — Saved progress and accounts (local first)

- **Status:** PASS locally with a real PostgreSQL 16.15 database: all checks green from a clean `npm ci`, including migrations and 29 database tests. GitHub Actions now runs a PostgreSQL 16 service; its result for this push is reported in the hand-off message.
- **Date:** 15 October 2026
- **Branch:** `claude/tender-cerf-ooekni` (review branch; not merged to `main`)
- **Starting point:** `e276bb5` (Phase 3, CI run #3 green). Commits: `6002d5e` (database and migrations), `12220d4` (service refactor), `5cfbe87` (PostgreSQL store and tests), then this documentation commit.

## 1. Conflicts with the existing architecture, and how they were resolved

None required a breaking change. All 174 Phase 3 tests still pass unchanged.

| Conflict | Resolution |
|---|---|
| Learning progress and game state were saved by two independent stores, but the requirement is one transaction | `LearningService` gained pure `planSubmit`/`planHint` (its existing logic, moved, not rewritten). `GameService` gained an optional `TransactionalPlayerStore` that loads both records under a row lock and commits them together. Without it, the previous two-store path runs as before |
| The Phase 3 leaderboard read every player's progress, which per-user isolation forbids | Optional `LeaderboardSource`. The PostgreSQL version uses a narrow `SECURITY DEFINER` function returning only handle, XP and reached-at for visible players, plus the viewer's own row under their own access rights. Ranking rules (DEC-006) are unchanged |
| In-memory records hold every submission ever made; a database should not load them all on each request | Store `load` takes an optional `{ submissionId }` (non-breaking); the PostgreSQL store loads only that submission |
| One class could not implement both `ProgressStore` and `GameStateStore` (same method names, different record types) | Stores expose `progressStore` and `gameStore` views over the same underlying records |
| The architecture proposal named `supabase/migrations/` | No provider is approved, so provider-neutral SQL lives in `db/migrations/` (DEC-007) |

## 2. Database schema (`db/migrations/0001_initial.sql`)

| Table | Primary key | Notes |
|---|---|---|
| `players` | `id uuid` | Handle (format CHECK, unique on `lower(handle)`), leaderboard visibility, `auth_provider` + `auth_subject` (unique pair, for the future identity provider) |
| `player_paths` | player, path | `progress_revision`, `game_revision`; locked `FOR UPDATE` to serialise one player's writes |
| `level_progress` | player, path, level | completed/mastered timestamps; CHECK mastered ⇒ completed |
| `challenge_progress` | player, path, level, challenge | attempts, correct, hint counters, first-try flag, demonstrated; CHECKs (correct ⇒ attempted; demonstrated ⇒ correct) |
| `xp_ledger` | player, path, **source_key** | **Award-once enforced by the primary key**; `amount > 0`; reason enum; append-only for the app (no UPDATE/DELETE grant) |
| `submissions` | player, path, **submission_id** | Original learning result and game events (JSON): **database-level idempotency** |
| `encounters` | player, path, level | status enum, runs, defeats, current run (JSON), won/flawless; CHECKs tie status to fields |
| `checkpoints`, `player_achievements`, `reward_items` | per entity | Insert-only; ordered by `position` |
| `quest_progress` | player, path, quest | state enum, timestamps, objectives met (`text[]`) |
| `schema_migrations` | version | Migration history and checksums |

**Isolation:**
- Row-level security is enabled on all 11 player tables, with one policy each. Each policy allows only rows where `player_id = app_current_player()`.
- The application switches to the role `code_dungeon_app` in every transaction (`SET LOCAL ROLE`). The role has no login, no superuser and no RLS bypass. The transaction also sets `app.player_id` from the server's verified player id; when it is unset, nothing is visible.
- Cross-player access exists only through two `SECURITY DEFINER` functions, `leaderboard_records(path)` and `player_id_for_identity(provider, subject)`. Both have a fixed `search_path` and EXECUTE is revoked from PUBLIC.

## 3. Migration plan and local setup

- `db/migrations/NNNN_name.sql` files are applied in order by `src/db/migrate.ts` (`npm run db:migrate`; `npm run db:status` lists state).
- Each file is applied in its own transaction under an advisory lock. Its SHA-256 checksum is recorded, and an edited applied migration is refused. Re-running applies nothing.
- `npm run db:local -- start|stop|status|reset` runs a throwaway PostgreSQL cluster in `.local/postgres`, which is git-ignored, loopback-only and development-only. It works without Docker and under root by switching to the `postgres` user. Any PostgreSQL 15+ reachable through `DATABASE_URL` also works.
- CI starts a `postgres:16` service, applies the migrations twice and runs the tests with `REQUIRE_DB_TESTS=1`, so the database tests cannot be silently skipped there.

## 4. Files

**Created:**
- `db/migrations/0001_initial.sql`
- `src/db/client.ts`, `src/db/migrate.ts`
- `scripts/db/migrate.ts`, `scripts/db/local-postgres.sh`
- `src/services/player-store.ts`, `src/services/postgres-player-store.ts`
- `tests/support/db.ts`
- `tests/db/{migrations,isolation,persistence,accounts}.test.ts`, `tests/services/player-store.test.ts`
- `docs/auth-design.md`, `docs/PHASE_4_REPORT.md`

**Changed:**
- Services: `src/services/learning-service.ts`, `game-service.ts`, `progress-store.ts`, `game-store.ts` (additive)
- Config and CI: `package.json` and `package-lock.json` (`postgres` 3.4.9; `db:*` scripts), `.env.example` (variable names only), `.gitignore` (`.local/`), `.github/workflows/ci.yml`
- Docs: `README.md`, `CHANGELOG.md`, `docs/decision.md` (DEC-007, DEC-008), `docs/EXECUTION.md`, `docs/WORKFLOW.md`, `docs/risk-register.md`, `docs/next-steps.md`, `docs/architecture-proposal.md`

**Unchanged:** `git diff e276bb5` is empty for `src/domain` (XP policy, progression, game engine, leaderboard rules), `src/learning` (evaluation), `content/` (25 levels, quests, achievements) and `src/runner`.

## 5. Checks and results

Clean `rm -rf node_modules .next && npm ci`, PostgreSQL 16.15 local, `TEST_DATABASE_URL` set, `REQUIRE_DB_TESTS=1`:

| Check | Result |
|---|---|
| Migrations on a clean database, twice | "1 migration(s) applied", then "0 migration(s) applied, 1 already up to date"; status `applied 0001_initial` |
| `npm run lint` | exit 0 |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npm run typecheck` | exit 0 |
| `npm test` | **18 files, 207 tests passed** (without a database: 178 passed, 29 skipped; with `REQUIRE_DB_TESTS=1` and no URL the database suites fail, as intended) |
| `npm run content:validate` | 0 errors, 1 warning (agent-only review, by design) |
| `npm run content:verify-python` | 140/140 curriculum, 8/8 fixture snippets (Python 3.13.16) |
| `npm run build` | compiled; `/` prerendered |
| `npm audit --omit=dev --audit-level=high` | **0 vulnerabilities** (including the new `postgres` driver) |
| `npm audit` (with dev tooling) | 5 high, unchanged from Phase 1, lint tooling only (R-31) |
| Secret scan of all Phase 4 changes | 0 matches; `.env.example` holds names only |
| Server-only code in the client bundle (`.next/static`) | none found (no `DATABASE_URL`, role or function names) |
| Each intermediate commit, checked on its own with the database | `6002d5e` 179 passed · `12220d4` 183 · `5cfbe87` 207; typecheck and lint 0 for all three |
| Leftover test databases after the run | 0 |

**Test counts by file:**
- Database suites: `db/accounts` 5, `db/isolation` 9, `db/migrations` 5, `db/persistence` 10.
- Services: `services/player-store` 4, `services/game-service` 12, `services/learning-service` 15.
- Domain: `domain/game-engine` 18, `domain/leaderboard` 16, `domain/progression` 20.
- Learning: `learning/evaluation` 25, `learning/loader-and-schema` 9, `learning/projection` 4, `learning/python-verify` 12, `learning/synthetic-100` 5, `learning/validate` 22.
- Other: `content/python-fundamentals` 15, `runner` 1.

**Required coverage:**

| Requirement | Tests |
|---|---|
| Persistence | A full 25-level playthrough is saved to PostgreSQL and reloaded through a **new connection pool and fresh services**. The view, path and raw progress equal an identical in-memory run exactly (2,455 XP, all quests and achievements). Hints and encounter runs persist. The non-transactional store path also works |
| Transaction rollback | A game step failing after the learning step leaves no rows in any table, and the same submission then succeeds normally. A constraint violation (XP amount 0) rolls back the level progress written earlier in the same transaction. The in-memory adapter has the same semantics |
| Duplicate submissions | A resent id returns the original learning result and game events, including after a restart. Six concurrent copies of one submission produce one evaluation and five duplicates, one attempt and two ledger rows. Eight concurrent different submissions all count (no lost updates). A direct duplicate ledger insert is rejected by the database |
| Cross-account access | Another account's rows in all 10 player-data tables and `players` are invisible to reads. Updates and deletes match zero rows. Inserting rows for another account is refused (42501). The ledger can't be updated or deleted, even by its owner. Without a player id nothing is visible. Services keep results per account. The leaderboard exposes only rank, handle and XP (exact function signature asserted), and hidden players are excluded |
| Accounts | Create, read and update; handle rules and case-insensitive uniqueness in code and in the database; identity link and lookup; duplicate identity refused; deletion cascades to all player data |

## 6. Security review

- **Isolation in depth.** Services take the player id as an argument and never from request bodies. On top of that, the database enforces RLS for the role every transaction uses, and the tests attack it directly with SQL.
- **Integrity in the database, not just code:** award-once, append-only ledger, idempotent submissions, state CHECKs and handle format.
- **Secrets.** The connection string comes from the environment, is redacted when displayed and is never logged. No real values are committed. CI uses a throwaway trust-auth container with no credentials.
- **Remaining risks (documented in the risk register):**
  - RLS only protects queries that go through `scoped()` (R-41).
  - The two `SECURITY DEFINER` functions run with owner rights (R-42).
  - The local cluster uses trust authentication (R-43, development only).
  - Hosted-provider compatibility of `SET LOCAL ROLE` is unverified (R-44).
  - There is still no authentication and no rate limiting, so nothing is exposed over HTTP (R-36).

## 7. Unresolved issues and limitations

- **Authentication is not implemented.** It is designed in `docs/auth-design.md`; the provider, O-5 and O-8 need your approval. Until then no route or UI uses the services, and player ids are supplied by tests.
- **No hosted database.** Everything ran locally and in CI only. Compatibility with a managed provider (Supabase roles, `SET LOCAL ROLE`) must be verified when one is chosen (R-44).
- The database doesn't check content ids against the curriculum; the services validate them against the loaded pack.
- Each save checks every row of the player's state for changes but writes only changed rows. That's fine at 25 levels; revisit at scale.
- Retention of old submission rows is not yet defined (R-40). Account deletion removes everything.
- The in-memory adapters remain for tests and are flagged non-durable.

## 8. Dependency and cost impact

- **One new runtime dependency:** `postgres` 3.4.9. It has zero transitive dependencies, an Unlicense licence and 0 known vulnerabilities.
- **No external services, accounts or cloud resources** were created. Infrastructure cost is **$0**.
- The CI PostgreSQL container uses GitHub Actions minutes only. This session used Claude cloud-session credit.

## 9. Next recommended phase

**Phase 5 — First playable vertical slice (local).** Wire the services to Next.js routes and a minimal, accessible interface: map, level room, challenge, feedback, hints, quest journal and leaderboard, backed by the PostgreSQL store. It needs one owner decision first: either approve an identity provider (DEC-008), or approve a clearly labelled **local-development-only sign-in** for the slice, disabled outside development, so the slice can be played before a provider is chosen.
