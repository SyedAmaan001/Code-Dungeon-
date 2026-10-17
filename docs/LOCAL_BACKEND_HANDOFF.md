# Local backend session — handoff

- **Date:** 17 October 2026. Local laptop session on Windows 11 with normal Claude Code, not Claude Cloud.
- **Repository:** https://github.com/SyedAmaan001/Code-Dungeon-.git
- **Local path:** `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1\.claude\worktrees\code-dungeon-recovery-b0a626`. This is a git worktree of the checkout at `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1`, which stays on `main`.
- **Branch:** `claude/tender-cerf-ooekni`, tracking `origin/claude/tender-cerf-ooekni`. `main` is only the three documentation commits and is an ancestor of this branch. Never treat `main` as the application.
- **Starting commit:** `a431bed`, "fix(ui): phone map status line under tagged rooms; scroll-reveal coverage", the remote tip on 17 October 2026.
- **Current commit:** the code is at `b82b2c7`, and the tip is one docs-only commit after it (`git log -3 --oneline`). Push status is in §8.

## 1. Verified Phase 1–6 status (re-run here, not copied from the reports)

| Area | State | Evidence in this session |
|---|---|---|
| Next.js 16 / TypeScript / quality tooling | Implemented and verified | lint, typecheck, format: exit 0 |
| 25-level Python Fundamentals pack, validator, 6 deterministic evaluators | Implemented and verified | `content:validate`: 0 errors, 1 warning (AI-only review). `content:verify-python`: 148/148 with CPython 3.13.6 |
| Learning and game engines (XP, mastery, unlocks, encounters, lives, checkpoints, quests, achievements, items, leaderboard ranking) | Implemented and verified | Vitest: 277 of 277 pass with PostgreSQL (273 existing plus 4 new CSP tests) |
| PostgreSQL schema (migrations 0001–0003), RLS, `SET LOCAL ROLE code_dungeon_app`, one-transaction saves, idempotent submissions, concurrency, rollback, cross-player isolation, shared rate limit, account deletion | Implemented and verified locally | `tests/db/*` against PostgreSQL 16.15. Migrations applied twice: "3 applied", then "0 applied, 3 already up to date" |
| Auth: dev sign-in (HMAC cookie), Supabase Auth code (Google OAuth with PKCE, magic link, `/auth/callback`, `/auth/confirm`, `safeNext`, HttpOnly cookies, config guards) | Implemented. Supabase is **integrated against a local mock only** | Unit tests plus the `supabase-mock` Playwright project (§4) |
| Real Google OAuth, real Supabase email, real Supabase admin deletion, `SET LOCAL ROLE` on hosted Supabase | **Not verified**, blocked on approval (no Supabase project exists, DEC-013, R-44, R-47) | None possible without a project |
| Game interface (map, rooms, journal, collection, leaderboard, profile, Onyx preview theme) | Implemented. The owner dislikes it and it **will be redesigned separately** | Not modified in this session apart from the CSP header |
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
- **Backend contracts for the redesigned interface:** **`docs/API_CONTRACTS.md`**, new in this session.
- Decisions are in `docs/decision.md` (DEC-001…019), risks in `docs/risk-register.md`, issues in `docs/issues.md`.

## 3. What this session did

| Commit | Change | Why |
|---|---|---|
| `e968f31` | Level-file references are now POSIX (`levels/L001.yaml`) on every OS. Added `.gitattributes` with `* text=auto eol=lf` | On Windows, 6 unit tests failed: backslash paths, and CRLF in the checklist freshness test. Prettier also flagged 187 files, all CRLF-only. CI on Linux never saw either problem |
| `4847e04` | `scripts/db/local-postgres.sh` supports the Windows EnterpriseDB binaries in `.local/pgsql`: TCP only, relative `pg_ctl` paths, psql options before the URL | The laptop had no PostgreSQL or Docker. `pg_ctl.exe` can't start a data directory whose path has spaces |
| `b82b2c7` | `scripts/e2e/prepare-db.ts` uses `fileURLToPath`, and the `e2e/helpers.ts` seed runs with `process.execPath`. **Nonce-based script CSP** (`src/csp.ts`, `src/proxy.ts`). The static CSP header was removed from `next.config.ts`. Added `tests/auth/csp.test.ts` and e2e assertions. Added `docs/API_CONTRACTS.md` and this handoff | The e2e DB setup broke on Windows (`C:\C:\…`). I-15 and R-52 were the only open security engineering items |

CSP details: `script-src 'self' 'nonce-<per request>' 'strict-dynamic'`, plus `'unsafe-eval'` under `next dev` only. It also keeps `object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. Every route is already dynamic (the root layout reads the theme cookie), so every page gets its nonce. Styles are not restricted, because motion and GSAP set inline styles. `form-action` is not set, so the Google OAuth redirect after a no-JS form post keeps working.

## 4. Test results in this session (Node 24.20.0, PostgreSQL 16.15, Python 3.13.6)

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

## 5. Local setup (Windows laptop): exact commands

Prerequisites already on this laptop:
- Node 24.20.0 through nvm. `.nvmrc` says 22 and the nvm shim refuses because 22 is not installed, so put 24 on the PATH (it satisfies `engines >=22.12`).
- Python 3.13.6.
- PostgreSQL 16.15 binaries in `.local/pgsql`. These are git-ignored and per worktree. They came from `https://get.enterprisedb.com/postgresql/postgresql-16.15-1-windows-x64-binaries.zip`, SHA-256 `25e6fcdfb8caec38691bf461125e7564508760666f7b8e5dc6a5f0818f58f81e`, and are not Authenticode-signed.
- Playwright Chromium build 1194.

From Git Bash in the worktree:

```bash
export PATH="/c/Users/syeda/AppData/Local/Author Software/nvm/installs/v24.20.0:$PATH"
bash scripts/db/local-postgres.sh start      # NOT `npm run db:local` — npm picks WSL bash here
export DATABASE_URL=postgresql://postgres@127.0.0.1:54329/code_dungeon_dev
export TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/postgres
export REQUIRE_DB_TESTS=1 NEXT_TELEMETRY_DISABLED=1
npm run db:migrate && npm test               # unit + DB tests
npx playwright test                          # e2e (builds a production copy; ~10 min)
bash scripts/db/local-postgres.sh stop
```

- To play locally, create `.env.local` (git-ignored) with `DATABASE_URL`, `AUTH_MODE=dev` and a 32+ character `DEV_AUTH_SECRET`, then run `npm run dev`.
- Never run `local-postgres.sh reset` on data you want to keep.
- Leftover servers on ports 3100, 3101 or 54400 break e2e (R-54). Stop them before a run.

## 6. Still unverified: external providers (needs owner approval)

- **Supabase project** (free tier), **Google OAuth client**, **email sender** and the `SUPABASE_SECRET_KEY`: DEC-013, R-47, I-17. Then repeat the `supabase-mock` journeys against the real project, and check `SET LOCAL ROLE` and `code_dungeon_app` on hosted Supabase (R-44).
- **Hosting / Vercel preview:** O-1b. Nothing is provisioned. Cost is still $0.
- Owner decisions still open: launch jurisdictions (DEC-010), confirming leaderboard opt-in (DEC-014), human content review (DEC-011), and whether to move the answer-key checklist to a private repository before any public release (R-53).

## 7. Known risks and gaps

- **Leaderboard scaling:** `leaderboard_records()` sums the whole `xp_ledger` on every leaderboard view. That's fine for a playtest. Add a per-player path total (a trigger or materialised table) before public scale.
- Profile update, onboarding and account deletion actions have **no rate limit**; only answers and hints have one. Magic-link sending relies on Supabase's own limits. Low risk, because each needs a verified session (or Supabase).
- The fixed-window shared limiter can allow up to 2× the limit across a minute boundary (DEC-016, accepted).
- CI uses Node 22 and Linux. This laptop uses Node 24 and Windows, so the Windows-only fixes are guarded by the existing tests but not by CI.
- npm 11 install-script allow-list: if a fresh `npm ci` ever breaks esbuild or tsx, run `npm install-scripts approve esbuild unrs-resolver` locally, but don't commit that blindly.

## 8. Push status and next task

- **Push:** `a431bed..b82b2c7` was pushed (fast-forward) to `origin/claude/tender-cerf-ooekni` on 17 October 2026, followed by a docs-only commit that records this. Nothing was merged and `main` was not touched. CI (GitHub Actions, Linux, Node 22) runs on that push. Its result was not checked in this session, so check the Actions tab for the run on this branch.
- **Next task:** leaderboard scaling, then rate limits for profile, onboarding and deletion actions. Exact scope is in `docs/NEXT_CHAT_PROMPT.md`.
- **After that:** Phase 7 still needs owner approval: a Supabase project, a Google OAuth client, an email sender and a Vercel preview with a cost plan (`docs/PHASE_6_REPORT.md` §8). Until it's approved, keep to non-billable backend work.
