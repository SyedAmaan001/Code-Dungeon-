# Local backend session — handoff

- **Date:** 17 October 2026. Two local sessions on the owner's Windows 11 laptop with normal Claude Code, not Claude Cloud. Session 1 handled recovery, Windows fixes and the CSP. Session 2 handled leaderboard totals and account-write rate limits. Session 3 (18 October) prepared the hosted-staging approval package; nothing was provisioned.
- **Repository:** https://github.com/SyedAmaan001/Code-Dungeon-.git
- **Local path:** `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1\.claude\worktrees\code-dungeon-recovery-b0a626`. This is a git worktree of the checkout at `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1`, which stays on `main`.
- **Branch:** `claude/tender-cerf-ooekni`, tracking `origin/claude/tender-cerf-ooekni`. `main` is only the three documentation commits and is an ancestor of this branch. Never treat `main` as the application.
- **Starting commit:** `a431bed`, "fix(ui): phone map status line under tagged rooms; scroll-reveal coverage", the remote tip on 17 October 2026.
- **Current commit:** the code is at `c7574b5` (CI green), followed by one docs-only commit. Working tree clean.

## 1. Verified Phase 1–6 status (re-run here, not copied from the reports)

| Area | State | Evidence in this session |
|---|---|---|
| Next.js 16 / TypeScript / quality tooling | Implemented and verified | lint, typecheck, format: exit 0 |
| 25-level Python Fundamentals pack, validator, 6 deterministic evaluators | Implemented and verified | `content:validate`: 0 errors, 1 warning (AI-only review). `content:verify-python`: 148/148 with CPython 3.13.6 |
| Learning and game engines (XP, mastery, unlocks, encounters, lives, checkpoints, quests, achievements, items, leaderboard ranking) | Implemented and verified | Vitest: 318 of 318 pass with PostgreSQL after session 3 |
| PostgreSQL schema (migrations **0001–0005**), RLS, `SET LOCAL ROLE code_dungeon_app`, one-transaction saves, idempotent submissions, concurrency, rollback, cross-player isolation, shared rate limits, account deletion, maintained leaderboard totals | Implemented and verified locally | `tests/db/*` against PostgreSQL 16.15. On a clean disposable database: "5 applied", then "0 applied, 5 already up to date" |
| Auth: dev sign-in (HMAC cookie), Supabase Auth code (Google OAuth with PKCE, magic link, `/auth/callback`, `/auth/confirm`, `safeNext`, HttpOnly cookies, config guards) | Implemented. Supabase is **integrated against a local mock only** | Unit tests plus the `supabase-mock` Playwright project (§4) |
| Real Google OAuth, real Supabase email, real Supabase admin deletion, `SET LOCAL ROLE` on hosted Supabase | **Not verified**, blocked on approval (no Supabase project exists, DEC-013, R-44, R-47) | None possible without a project |
| Game interface (map, rooms, journal, collection, leaderboard, profile, Onyx preview theme) | Implemented. The owner dislikes it and it **will be redesigned separately** | Not modified in either local session, apart from the CSP header and account actions' error messages |
| Human content review | **0 of 25** levels (DEC-011). `content:release-check` exits 1 by design | Checklist test passes |
| Hosting, staging, production | Deferred. Nothing is provisioned | None |

## 2. Architecture map (where things live)

- **Domain, pure:** `src/domain/` covers progression, XP policy (`policy.ts`, DEC-002 defaults) and the game engine (`game/`).
- **Learning engine:** `src/learning/` holds the schema, loader, validation, evaluators (`evaluation/`), the answer-key-free projection (`projection.ts`) and the release gate.
- **Services, the server boundary:** `src/services/`
  - `learning-service.ts` and `game-service.ts`: the request schemas and orchestration
  - `postgres-player-store.ts`: `scoped()` RLS transactions, accounts and the leaderboard source
  - `postgres-rate-limit.ts` and `rate-limit.ts`
  - `presenter.ts`: the views sent to the browser
  - `runtime.ts`: wiring
- **Auth:** `src/auth/`
  - `server.ts`: `requirePlayer` and `playerForAction`
  - `config.ts`: mode and guards
  - `identity.ts`, `dev-session.ts`, `redirect.ts`
  - `supabase-admin.ts`: server-only
- **Writes:** server actions in `src/app/actions/` (`game.ts`, `account.ts`, `auth.ts`, `appearance.ts`). Route handlers are only `src/app/auth/{callback,confirm}`.
- **Proxy:** `src/proxy.ts` refreshes the session, redirects early and **now sends the CSP**. The policy itself is in `src/csp.ts`.
- **Database:** `db/migrations/*.sql`, `src/db/migrate.ts`, `scripts/db/`.
- **Deployment checks:** `src/deploy/preflight.ts` (`npm run config:check`) and `src/deploy/smoke.ts` (`npm run smoke -- <url>`). The staging proposal is `docs/cloud-plan.md`.
- **Backend contracts for the redesigned interface:** **`docs/API_CONTRACTS.md`**, new in this session.
- Decisions are in `docs/decision.md` (DEC-001…021), risks in `docs/risk-register.md` (to R-59), issues in `docs/issues.md` (to I-25).

## 3. What session 1 did

| Commit | Change | Why |
|---|---|---|
| `e968f31` | Level-file references are now POSIX (`levels/L001.yaml`) on every OS. Added `.gitattributes` with `* text=auto eol=lf` | On Windows, 6 unit tests failed: backslash paths, and CRLF in the checklist freshness test. Prettier also flagged 187 files, all CRLF-only. CI on Linux never saw either problem |
| `4847e04` | `scripts/db/local-postgres.sh` supports the Windows EnterpriseDB binaries in `.local/pgsql`: TCP only, relative `pg_ctl` paths, psql options before the URL | The laptop had no PostgreSQL or Docker. `pg_ctl.exe` can't start a data directory whose path has spaces |
| `b82b2c7` | `scripts/e2e/prepare-db.ts` uses `fileURLToPath`, and the `e2e/helpers.ts` seed runs with `process.execPath`. **Nonce-based script CSP** (`src/csp.ts`, `src/proxy.ts`). The static CSP header was removed from `next.config.ts`. Added `tests/auth/csp.test.ts` and e2e assertions. Added `docs/API_CONTRACTS.md` and this handoff | The e2e DB setup broke on Windows (`C:\C:\…`). I-15 and R-52 were the only open security engineering items |

CSP details: `script-src 'self' 'nonce-<per request>' 'strict-dynamic'`, plus `'unsafe-eval'` under `next dev` only. It also keeps `object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. Every route is already dynamic (the root layout reads the theme cookie), so every page gets its nonce. Styles are not restricted, because motion and GSAP set inline styles. `form-action` is not set, so the Google OAuth redirect after a no-JS form post keeps working.

## 4. Session 1 test results (Node 24.20.0, PostgreSQL 16.15, Python 3.13.6)

| Check | Result |
|---|---|
| `npm ci` | ok. npm 11 warns that esbuild and unrs-resolver install scripts are not on the allow-list, but builds and tests work |
| lint / format:check / typecheck | 0 / 0 (after the LF fix) / 0 |
| `npm test` without a database | 227 passed, 46 skipped (after the Windows fix; 6 failed before it) |
| `npm test` with `REQUIRE_DB_TESTS=1` | 27 files, **273 passed** before the CSP test was added. See the final row for after |
| content:validate / verify-python | 0 errors, 1 warning / 148 of 148 |
| `npm run build` | pass, all routes dynamic (ƒ) |
| `npm audit --omit=dev` | **0 vulnerabilities**. The full audit's 5 high findings are lint tooling only (`braces` via eslint tooling, R-31) |
| Browser bundle scan (`.next/static`) for secrets, answer-key fields, connection strings and `createHmac` | no matches |
| `npx playwright test` (35 tests) | See below |

### Final results after all changes (commit in §3)

| Check | Result |
|---|---|
| lint / format:check / typecheck | 0 / 0 / 0 |
| `npm test` with PostgreSQL (`REQUIRE_DB_TESTS=1`) | **28 files, 277 passed** |
| content:validate / verify-python / review-checklist `--check` | 0 errors, 1 warning / 148 of 148 / up to date |
| `npm run build` | pass |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Bundle scan of `.next/static` | clean |
| gitleaks: git history (33 commits) | no leaks. The working-tree scan flags only Next.js's auto-generated preview and encryption keys in the git-ignored `.next*/` build folders |
| `npx playwright test --timeout=180000` | **35 passed** (dev-signin 26, supabase-mock 9), including the new nonce assertions on the production build |

e2e notes, so nobody repeats the investigation:
- With the default 90 s per-test timeout, one run had 33 passed and 1 failed: the axe accessibility test timed out partway through its 11 scans on Windows `next dev`, and the test after it did not run. Run with its seeding test, the same test passes in 49.5 s.
- The full suite passed with `--timeout=180000`. The limit was not changed in the config, because CI on Linux passes with 90 s.
- Two earlier failures came from the `seedPlayer` helper spawning `npx`, which on this laptop resolves to the nvm shim that wants Node 22. It now uses `process.execPath --import tsx`.
- `game.spec.ts` tests share state and run serially, so a single test can't be run alone.

## 4a. What session 2 did: leaderboard totals and account-write rate limits

**Task 1: leaderboard scaling (migration `0004_player_path_xp.sql`, DEC-020, I-23)**

- **Schema:** `player_path_xp`:
  - Columns: `player_id`, `path_id`, `xp > 0`, `reached_at`.
  - Primary key `(player_id, path_id)`, with a foreign key to `player_paths ON DELETE CASCADE`.
  - Index `(path_id, xp DESC, reached_at)`.
  - RLS policy for own rows. The app role has `SELECT` only.
- **Maintenance:** the `xp_ledger_total` `AFTER INSERT` trigger runs `xp_ledger_add_to_total()` (`SECURITY DEFINER`, fixed `search_path`). It upserts `xp += amount` and `reached_at = greatest(...)` in the same transaction as the award. Duplicate awards fail on the ledger primary key first, and a rolled-back transaction rolls the total back too. Concurrent awards are serialised by the upsert's row lock. Same-player submissions were already serialised by the `player_paths FOR UPDATE` lock.
- **Backfill:** inside the migration's single transaction, `LOCK TABLE xp_ledger IN SHARE ROW EXCLUSIVE MODE`, then create the trigger, then `INSERT … SELECT sum(amount), max(awarded_at) … GROUP BY player_id, path_id`. To rebuild after manual ledger edits (R-58), run as the owner: `TRUNCATE player_path_xp;` then the same `INSERT … SELECT`.
- **Verification query** (expect zero rows):

  ```sql
  SELECT * FROM (SELECT player_id, path_id, sum(amount)::int xp, max(awarded_at) r
                 FROM xp_ledger GROUP BY 1, 2) l
  FULL JOIN player_path_xp t USING (player_id, path_id)
  WHERE l.xp IS DISTINCT FROM t.xp OR l.r IS DISTINCT FROM t.reached_at;
  ```

- **Reads:**
  - `leaderboard_page(path, limit, min_xp)` (`SECURITY DEFINER`) returns `handle, xp, reached_at, rank, is_viewer, total_ranked`. That is the top `limit` rows plus the caller's own row when it is ranked lower: at most `limit + 1` rows. The caller is `app_current_player()`. No player ids are returned.
  - `leaderboard_records()` keeps its 0001 signature and reads the totals.
  - `PostgresLeaderboardSource.page()` uses `leaderboard_page()`. `GameService.leaderboard()` prefers `page()` when the source has one. The in-memory path still uses `rankLeaderboard()`.
- **Ranking semantics (unchanged):**
  - Order: XP descending, `reached_at` ascending, `lower(handle) COLLATE "C"`, `handle COLLATE "C"`, then `player_id`.
  - Rank: `rank()` on (XP, `reached_at`), so "1224" competition ranking.
  - Only visible players with XP ≥ `minXp` are ranked.
  - Handles are ASCII by constraint, so this matches JavaScript ordering.
  - Viewer reasons (`hidden`, `no_xp`, `unknown`) come from the shared domain helper `unrankedReason()`. Limit clamping comes from `leaderboardLimit()`.
- **Tests** (`tests/db/leaderboard.test.ts`, 9 tests):
  - Backfill from a ledger written before 0004.
  - 480 random awards with frequent XP and time ties, compared against the old ledger SQL plus `rankLeaderboard()`. This covers 8 viewer kinds (none, ranked, hidden, no XP, non-existent) × 8 limits (including 0 and −3), and `minXp` values 0, 30 and 60.
  - At most `limit + 1` rows, and no ids in the function signature.
  - A duplicate award is rejected and the total is unchanged.
  - Rollback.
  - 40 concurrent awards.
  - Explicit ties (shared rank, case-insensitive handle order).
  - The deletion cascade.
  - Concurrent and duplicate real submissions through the services under the application role.
  - Cross-account tests: `player_path_xp` was added to the isolation table list, and update, delete and insert are refused with `42501`. The migration test checks grants.
  - **Mutation check:** changing `rank()` to `row_number()` made 3 of these tests fail, so they do detect ranking errors.

**Task 2: account-write rate limits (migration `0005_account_rate_limits.sql`, DEC-021, I-24)**

- **Table and function:**
  - `account_rate_limits(bucket, window_start, hits)` has RLS with no policy and no grants, so the app role can't touch it.
  - `account_rate_limit_hit(bucket, window_seconds, limit)` (`SECURITY DEFINER`) counts one hit atomically in a window on the database clock. It cleans up windows older than a day (or two windows, if longer) when a new window starts. It refuses (`42501`) to charge a `player:` bucket that isn't the session's own player.
- **Buckets:** `player:<uuid>:profile|delete` comes from the verified session. Onboarding uses `identity:<sha256(provider, subject)>:onboarding`, because there is no player yet. Only a hash is stored.
- **Budget:** `runtime.accountLimiter` = local guard of 20 per 10 minutes, then PostgreSQL at 10 per 10 minutes per action.
- **Actions** (`src/app/actions/account.ts`): `completeOnboarding` checks the limit after the identity is verified. `updateProfile` and `deleteAccount` check it after the session's player is resolved.
  - Over the limit: an error message, and nothing is written.
  - Limit check failure: an error message and the action fails closed, with the error logged server-side (message only).
  - Signed out: redirected before any budget is charged.
  - Answer and hint limits are unchanged.
- **Tests:**
  - `tests/db/account-rate-limit.test.ts` (8 tests): budget per bucket, 30 concurrent hits → exactly 10 allowed, identity buckets store only a hash, cross-account charging refused, table unreadable by the app role, malformed bucket and invalid limit rejected, cleanup, next window.
  - `tests/auth/account-actions-rate-limit.test.ts` (9 tests): bucket comes from the session and not the form, repeated and concurrent requests, cross-account independence, database failure, signed-out callers, onboarding, deletion stays usable after typos, deletion refused when the budget is spent.
  - `tests/db/account-deletion.test.ts` now runs with the real PostgreSQL limiter in front.

**Other session 2 changes**

- `vitest.config.ts` gains `hookTimeout: 60_000`. With 8 database suites seeding in parallel on this laptop, some `beforeAll` hooks exceeded the 10 s default. Every suite passes with more setup time, and no assertion changed.
- `scripts/db/local-postgres.sh` now initialises new Windows clusters with `-E UTF8 --locale=C`. The existing cluster is WIN1252 and was left alone (I-25, R-59), so migrations must stay ASCII-safe.
- When starting the database, **don't pipe** `local-postgres.sh start` into another command. The postmaster inherits the pipe and the shell hangs, and killing that shell took PostgreSQL down once (Windows error `0xC0000142`). Redirect to a file instead.

## 4b. Session 2 test results

| Check | Result |
|---|---|
| lint / format:check / typecheck | 0 / 0 / 0 |
| `npm test` with PostgreSQL (`REQUIRE_DB_TESTS=1`) | **31 files, 303 passed** (26 new) |
| content:validate / verify-python | 0 errors, 1 warning / 148 of 148 |
| Migrations on a clean disposable database | "5 applied", then "0 applied, 5 already up to date". `db:status` lists all 5 as applied. Dev database upgraded with "2 applied" (it holds 0 players) |
| `npm run build` | pass |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npx playwright test --timeout=180000` | **35 passed** (11.2 min): onboarding, profile, deletion and leaderboard journeys run through the new limiter and SQL ranking |
| CI for session 1 (`1e917f1`) | success (GitHub Actions run 39024106490) |
| CI for session 2 (`bd5ca83`) | success (run 39026427130: both jobs) |

## 4c. What session 3 did: hosted-staging approval package (no provisioning)

- **`docs/cloud-plan.md`** is the plan `docs/EXECUTION.md` requires before any resource is created. It covers:
  - Proposed resources: Supabase project `code-dungeon-staging` in `ap-south-1`, a Vercel project with functions in `bom1`, a Google OAuth web client, and Resend as custom SMTP.
  - Option A: free-tier private staging at $0, recommended now.
  - Option B: paid tiers at about $45–65/month, before any public use.
  - Pricing read on 18 October 2026, with source URLs.
  - Secrets per variable, the database connection strategy, the R-44 verification SQL, sign-in configuration, the verification run, data and privacy, rollback and cleanup, and an owner checklist.
- **Points the owner must decide:**
  - Vercel Hobby is "for personal, non-commercial use" (R-60).
  - Supabase Free has no backups and pauses after a week of inactivity (R-61).
  - The region depends on the launch jurisdictions (DEC-010).
- **`DATABASE_PREPARE=false`** (`src/db/client.ts`, `.env.example`, I-26). A Vercel deployment needs Supabase's IPv4 shared pooler in transaction mode (port 6543), which doesn't support prepared statements; this setting turns them off.
  - The default is unchanged.
  - Every app query already runs inside `scoped()` transactions, so `SET LOCAL ROLE` stays per-transaction.
  - The DB suite passes 63/63 with `DATABASE_PREPARE=false`. That proves the driver setting only, not a real pooler.
- **`npm run config:check`** (`src/deploy/preflight.ts`, `scripts/config-check.ts`): a production preflight that reuses `readAuthConfig`, `readAdminConfig` and `parseContentRelease`. It reports **names, never values**, and exits 1 on errors.
  - Errors:
    - `AUTH_MODE` is not `supabase`
    - a missing or invalid `SUPABASE_SECRET_KEY`
    - a `NEXT_PUBLIC_` secret
    - a non-https `APP_URL`
    - `DATABASE_URL` missing, invalid, or remote without `sslmode=require`
    - port 6543 without `DATABASE_PREPARE=false`
    - a bad `CONTENT_RELEASE`
  - Warnings: a pooler with `DATABASE_POOL_MAX` above 2, a leftover `DEV_AUTH_SECRET`, and `CONTENT_RELEASE=development`.
  - `.env*` files load through `@next/env`, imported as the CommonJS default; it is a dependency of `next`.
- **`npm run smoke -- <url>`** (`src/deploy/smoke.ts`, `scripts/smoke.ts`): GET requests only, no credentials, no writes. Its 15 checks cover:
  - security headers and a per-response nonce
  - the signed-out `/play` redirect and `/sign-in`
  - a forged `/auth/callback` code being refused
  - forbidden strings in the HTML and every same-origin script
- **Verified locally:** `next build` and `next start` in Supabase mode against the repo's Supabase Auth mock (`e2e/mock-supabase/server.ts`): **15/15 PASS**, scanning 11 scripts. `config:check` gave 0 errors and 1 warning with the mock-backed env, and 2 errors and exit 1 with an empty env.
- **Tests:** `tests/deploy/preflight.test.ts` (9) and `tests/deploy/smoke.test.ts` (6, using a fake deployment where each check is shown to fail when its behaviour breaks).

### Session 3 test results

| Check | Result |
|---|---|
| lint / format:check / typecheck | 0 / 0 / 0 |
| `npm test` with PostgreSQL | **33 files, 318 passed** (15 new) |
| DB suite with `DATABASE_PREPARE=false` | 8 files, 63 passed |
| content:validate / verify-python | 0 errors, 1 warning / 148 of 148 |
| `npm run build` / `npm audit --omit=dev` | pass / 0 vulnerabilities |
| `npm run smoke -- http://localhost:3200` (production build, Supabase mock) | 15 passed, 0 failed |
| e2e | not re-run. No proxy, auth or page code changed, and the DB client default is unchanged. Last run: 35/35 in session 2 |

## 5. Local setup (Windows laptop): exact commands

Prerequisites already on this laptop:
- Node 24.20.0 through nvm. `.nvmrc` says 22 and the nvm shim refuses because 22 is not installed, so put 24 on the PATH (it satisfies `engines >=22.12`).
- Python 3.13.6.
- PostgreSQL 16.15 binaries in `.local/pgsql`. These are git-ignored and per worktree. They came from `https://get.enterprisedb.com/postgresql/postgresql-16.15-1-windows-x64-binaries.zip`, SHA-256 `25e6fcdfb8caec38691bf461125e7564508760666f7b8e5dc6a5f0818f58f81e`, and are not Authenticode-signed.
- Playwright Chromium build 1194.

From Git Bash in the worktree:

```bash
export PATH="/c/Users/syeda/AppData/Local/Author Software/nvm/installs/v24.20.0:$PATH"
bash scripts/db/local-postgres.sh start > /tmp/pg.txt 2>&1   # never pipe it; not `npm run db:local` (WSL bash)
export DATABASE_URL=postgresql://postgres@127.0.0.1:54329/code_dungeon_dev
export TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/postgres
export REQUIRE_DB_TESTS=1 NEXT_TELEMETRY_DISABLED=1
npm run db:migrate && npm test               # unit + DB tests
npx playwright test --timeout=180000         # e2e (builds a production copy; ~10 min)
bash scripts/db/local-postgres.sh stop
```

- To play locally, create `.env.local` (git-ignored) with `DATABASE_URL`, `AUTH_MODE=dev` and a 32+ character `DEV_AUTH_SECRET`, then run `npm run dev`.
- Never run `local-postgres.sh reset` on data you want to keep.
- Leftover servers on ports 3100, 3101 or 54400 break e2e (R-54). Stop them before a run.

## 6. Still unverified: external providers (needs owner approval)

The full proposal, with costs, settings and an owner checklist, is in **`docs/cloud-plan.md`**.

- **Supabase project** (free tier), **Google OAuth client**, **email sender** and the `SUPABASE_SECRET_KEY`: DEC-013, R-47, I-17. Then repeat the `supabase-mock` journeys against the real project, and check `SET LOCAL ROLE` and `code_dungeon_app` on hosted Supabase (R-44).
- **Hosting / Vercel preview:** O-1b. Nothing is provisioned. Cost is still $0.
- Owner decisions still open: launch jurisdictions (DEC-010), confirming leaderboard opt-in (DEC-014), human content review (DEC-011), and whether to move the answer-key checklist to a private repository before any public release (R-53).

## 7. Known risks and gaps

- Leaderboard: viewer ranks below the page and `total_ranked` count the path's totals, which is O(players) per view rather than O(ledger rows). If paths reach very large player counts, consider a cached count. Owner-level ledger edits would desynchronise totals; see R-58 and the verification query in §4a.
- Fixed-window limiters (DEC-016 and DEC-021) can allow up to 2× a budget across a window boundary. This is accepted.
- Magic-link sending (`sendMagicLink`) relies on Supabase's own email limits. No Code Dungeon limit applies, because the caller has no verified identity yet.
- CI uses Node 22, Linux and UTF-8. This laptop uses Node 24, Windows and a WIN1252 cluster (R-59). CI is the reference.
- npm 11 install-script allow-list: if a fresh `npm ci` ever breaks esbuild or tsx, run `npm install-scripts approve esbuild unrs-resolver` locally, but don't commit that blindly.
- Real providers are still unverified (§6).

## 8. Push status and next task

- **Session 1:** `a431bed..1e917f1` pushed. CI run 39024106490 green.
- **Session 2:** `1e917f1..2e77d40` pushed. CI runs 39026427130 and 39026645172 green.
- **Session 3:** `2e77d40..c7574b5` pushed (fast-forward) on 18 October 2026. **CI run 39097422077 green**: checks in 1m23s, e2e in 3m58s. One docs-only commit after it records this. Nothing was merged, `main` was not touched, and no external resource was created.
- **Next task:** **blocked on the owner.** They need to review and approve `docs/cloud-plan.md` (Option A or B, region, Vercel terms) and create the provider accounts themselves. After approval, the next chat runs Phase 7 verification as set out in `docs/NEXT_CHAT_PROMPT.md`. Without approval there is no further backend task that needs no decision. The remaining items are owner or person decisions: DEC-010, DEC-011 human content review, DEC-014, R-53, and the postponed interface redesign.
