# Continuation prompt for the Antigravity agent

Paste everything below the line into Antigravity, opened on the folder named in §1.

---

# CODE DUNGEON: CONTINUE PHASE 7 (HOSTED STAGING), THEN THE BACKEND BACKLOG

You are the lead engineer continuing **Code Dungeon**, an existing, working project. You are not starting a new one. Earlier agent sessions (Claude Code) built Phases 1–6, then hardened the backend and prepared hosted staging. The owner has **approved** the staging plan. Your job is to carry out Phase 7 safely and verifiably, then continue with the backend backlog. Work in small, verified steps with the loops in §6, and keep the handoff files current so any agent can resume.

## 1. Where things are (verify; never assume)

| | |
|---|---|
| Repository | https://github.com/SyedAmaan001/Code-Dungeon-.git |
| Local folder (git worktree) | `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1\.claude\worktrees\code-dungeon-recovery-b0a626` |
| Main checkout | `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1`. It stays on `main`, which holds only docs. **Do not work there** |
| Branch | `claude/tender-cerf-ooekni`, tracking `origin/claude/tender-cerf-ooekni`. **Never commit to, push to or merge into `main`.** Never force-push |
| Latest known state | Code `c7574b5` (CI green), then docs commits, then the commit that adds migration 0006 and this prompt. Find the exact tip with `git log -5 --oneline` |

**Step 0 (always).** Run:

```bash
git fetch origin
git status -sb
git log -8 --oneline
gh run list --repo SyedAmaan001/Code-Dungeon- --branch claude/tender-cerf-ooekni --limit 3
```

- If the remote has moved ahead, fast-forward only (`git merge --ff-only origin/claude/tender-cerf-ooekni`). If that isn't possible, stop and report.
- If CI is red, fixing it is your first task.
- Preserve uncommitted work. Never `reset --hard`, never rewrite history.

## 2. Read before acting (in this order)

1. `CLAUDE.md`: the binding project rules; they apply to you too.
2. `docs/LOCAL_BACKEND_HANDOFF.md`: verified state, setup, results, risks (§4d is the latest).
3. `docs/cloud-plan.md`: **the approved plan you are executing** (Option A, Mumbai; DEC-022).
4. `docs/API_CONTRACTS.md`: the backend surface. Server actions only, no REST API.
5. `docs/decision.md`: DEC-009 (auth), DEC-010 (age and jurisdictions, still open), DEC-011 (human content review), DEC-013, DEC-014, DEC-015 (deletion), DEC-016, DEC-020 (leaderboard totals), DEC-021 (account limits), DEC-022 (staging approval).
6. `docs/risk-register.md` (R-44, R-47, R-51, R-58–R-61) and `docs/issues.md` (I-23–I-27).
7. `e2e/supabase-auth.spec.ts`: the journeys to repeat against real Google and Supabase.

Don't re-audit the whole repository; the handoff records what was verified. Read source files only where a task touches them.

## 3. Architecture in one screen

- **Next.js 16 + TypeScript.** Learning engine in `src/learning/`, pure game and progression rules in `src/domain/`, services in `src/services/` (PostgreSQL via postgres.js, row-level security through `scoped()`), auth in `src/auth/` (Supabase Auth: Google OAuth plus magic link; dev sign-in for local only), server actions in `src/app/actions/`, proxy and CSP in `src/proxy.ts` and `src/csp.ts`.
- **Database:** additive SQL migrations `db/migrations/0001…0006`, run with `npm run db:migrate`.
  - Every app query runs in one transaction as the role `code_dungeon_app`, with `app.player_id` set.
  - Leaderboard totals live in `player_path_xp`, maintained by a trigger; `leaderboard_page()` ranks in SQL.
  - Account writes are rate-limited (`account_rate_limit_hit()`).
  - Migration 0006 locks the Supabase Data API roles out.
- **Deployment helpers:** `npm run config:check` (production preflight; prints variable names, never values) and `npm run smoke -- <url>` (read-only, credential-free, 15 checks).

## 4. Local environment (Windows laptop, Git Bash)

```bash
export PATH="/c/Users/syeda/AppData/Local/Author Software/nvm/installs/v24.20.0:$PATH"   # Node 24; nvm has no Node 22
bash scripts/db/local-postgres.sh start > /tmp/pg.txt 2>&1   # NEVER pipe this command: it hangs and can kill PostgreSQL
export DATABASE_URL=postgresql://postgres@127.0.0.1:54329/code_dungeon_dev
export TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/postgres
export REQUIRE_DB_TESTS=1 NEXT_TELEMETRY_DISABLED=1
npm run db:migrate && npm test        # expect 34 files, 322 passed
```

- **Gates before every commit:**
  - `npm run lint`
  - `npm run format:check`
  - `npm run typecheck`
  - `npm test` with the DB
  - `npm run content:validate`
  - `npm run content:verify-python -- content tests/fixtures/packs` (set `PYTHON=python`)
  - `npm run build`
  - `npm audit --omit=dev`
- **e2e:** `npx playwright test --timeout=180000` (35 tests, about 11 minutes). Before it, stop anything on ports 3100, 3101 and 54400, and don't edit `src/` while it runs (`next dev` hot-reloads into the run).
- The local cluster is WIN1252, so keep SQL migrations **ASCII-only**. CI (Linux, Node 22, UTF-8) is the reference.
- Do not use `npm run db:local`: npm resolves `bash` to WSL here. Use `bash scripts/db/local-postgres.sh …` directly.

## 5. Non-negotiable rules

1. **Secrets:**
   - Never ask for, accept, print, log or commit any secret: database passwords, `SUPABASE_SECRET_KEY`, the Google client secret, SMTP or API keys.
   - The owner pastes secrets into provider dashboards, or into the git-ignored file `.env.staging.local`. You load that file with `set -a; . ./.env.staging.local; set +a` and never print it.
   - Check variable presence only, e.g. `[ -n "$X" ] && echo set`.
   - If a secret appears in chat or a log, tell the owner to rotate it.
2. **Accounts and spending:**
   - You never create accounts, enter passwords or accept terms. The owner does.
   - Create or configure only what `docs/cloud-plan.md` Option A lists (free tiers, Mumbai). Nothing paid.
   - Never delete an external resource or its data without explicit approval in chat.
3. **Game and content:** don't change XP, curriculum, quest, achievement, encounter, checkpoint or leaderboard semantics, or the interface (the redesign is postponed).
4. **Migrations:** additive, ASCII, tested locally first, and never `reset` or drop a database with data.
5. **No learner Python on the server.** The deterministic evaluators stay.
6. **Honesty:**
   - Never claim something works without a reproducible check, and give exact command output.
   - `supabase-mock` tests are **not** real OAuth.
   - Real-provider behaviour stays "unverified" until observed.
7. **Git:** commit only on `claude/tender-cerf-ooekni`, with clear messages. Push only after `git fetch` shows the remote hasn't moved. Wait for CI to finish before the next push (a new push cancels the running CI).

## 6. Working loops (follow these exactly)

### LOOP A: the step loop (for every task step below)

```
for each step:
  1. PLAN: one or two sentences: what will change, which files, how it will be verified.
  2. GATE: does the step need an owner action or approval? If so, give the owner exact,
     numbered click-by-click instructions, then WAIT. Do not guess or skip ahead.
  3. DO: make the smallest change that completes the step.
  4. VERIFY: run the step's check (test, script, SQL, smoke) and capture the exact output.
  5. If VERIFY fails, run LOOP B. If LOOP B ends unresolved, record the blocker and move
     to the next independent step.
  6. RECORD: append the result to docs/LOCAL_BACKEND_HANDOFF.md (what, evidence, status).
  7. If code changed: run the §4 gates, commit, then run LOOP C.
```

### LOOP B: the fix loop (at most 3 attempts per failure)

```
attempt = 1
while attempt <= 3:
  a. Read the full error and the code or config involved. Form one hypothesis.
  b. Make one change that tests that hypothesis. Re-run the failing check.
  c. If it passes: also run the related suites (regression), then exit the loop.
  d. Otherwise: write down what was learned, attempt += 1.
After 3 failed attempts: STOP changing things. Record the hypotheses, outputs and the
exact blocker in docs/issues.md, and ask the owner if their input is needed.
Never weaken, skip or delete a test to get a pass.
```

### LOOP C: the push and CI loop

```
1. git fetch origin; confirm the branch is only ahead (not behind or diverged).
2. git push origin claude/tender-cerf-ooekni   (never --force)
3. Wait for the CI run on that commit to finish (gh run watch <id> --exit-status).
4. If CI fails: run LOOP B on the CI failure before any other push.
5. Record the commit hash and CI run id in the handoff.
```

### LOOP D: the session-end loop (also when usage or time runs low)

```
When the work is done, blocked, or the usage window is nearly spent:
1. Stop starting new changes. Finish or revert the current small step so the tree is clean.
2. Update docs/LOCAL_BACKEND_HANDOFF.md: branch, exact commit, tests and results,
   what was verified, blockers, next step.
3. Rewrite docs/ANTIGRAVITY_PROMPT.md (this file) so it starts from the new state.
   Keep every loop and rule; change only facts and tasks.
4. Commit and run LOOP C.
5. Final message: a short "implemented / not implemented / blockers" report, then the
   updated prompt.
```

## 7. The task: Phase 7 hosted staging (approved Option A, Mumbai)

Already approved and recorded: DEC-022. The owner has a **Supabase organisation** and a **Vercel account (not connected to GitHub)**. Google Cloud and the email sender **don't exist yet**. Nothing has been provisioned.

Do these in order, each through LOOP A.

**7.1 Supabase project (owner action)**
- Instruct the owner to create the project `code-dungeon-staging` on the **Free** plan, region **South Asia (Mumbai) `ap-south-1`**.
- The database password goes into their password manager only.
- Then, in the dashboard: **Integrations › Data API › turn "Enable Data API" off** (`docs/cloud-plan.md` §4.2).
- The owner then creates `.env.staging.local` in the worktree root (it is git-ignored by `.env.*`; confirm with `git check-ignore -v .env.staging.local`). It holds:
  - `STAGING_SESSION_DATABASE_URL` = the **shared pooler, session mode, port 5432** URI with `?sslmode=require`
  - `STAGING_TRANSACTION_DATABASE_URL` = the **shared pooler, transaction mode, port 6543** URI with `?sslmode=require`
- Verify: both variables are present (names only).

**7.2 Migrations and the R-44 role check (you)**
- Run: `set -a; . ./.env.staging.local; set +a; DATABASE_URL="$STAGING_SESSION_DATABASE_URL" npm run db:migrate && DATABASE_URL="$STAGING_SESSION_DATABASE_URL" npm run db:status`. Expect 6 applied.
- Run the `docs/cloud-plan.md` §4.4 SQL with `psql` (the binary is at `.local/pgsql/bin/psql.exe`), passing the URL from the environment. Record `server_version`, `rolsuper` and whether `SET LOCAL ROLE code_dungeon_app` works.
- Also check that 0006 worked on the real host: `anon` must have no `EXECUTE` on `leaderboard_records(text)` and no `SELECT` on `schema_migrations`.
- **If `SET LOCAL ROLE` is refused:**
  1. Write the additive migration `0007_app_role_membership.sql`. It should grant `code_dungeon_app` to the connecting role with `SET TRUE, INHERIT FALSE` on PostgreSQL 16+, guarded by `server_version_num`.
  2. Test it locally. If possible, also test with a non-superuser `CREATEROLE` role, which is what Supabase uses.
  3. Apply it, re-check, then commit and run LOOP C.
- Then run the app's DB code against staging in transaction mode: `DATABASE_URL="$STAGING_TRANSACTION_DATABASE_URL" DATABASE_PREPARE=false npx tsx -e "<create one throwaway account via PostgresPlayerAccounts, read it, delete it>"`. Or ask the owner first and use a dedicated script under `scripts/staging/`. It must clean up after itself.

**7.3 Vercel project (owner action, you guide)**
- The owner connects Vercel to GitHub (only the repository `SyedAmaan001/Code-Dungeon-`) and imports it as `code-dungeon-staging`.
- Production branch: `claude/tender-cerf-ooekni`. Framework: Next.js. Function region: Mumbai (`bom1`). Prefer adding `vercel.json` with `{"regions": ["bom1"]}` in a commit.
- Environment variables (Production and Preview), entered by the owner in Vercel, exactly as in `docs/cloud-plan.md` §3:
  - `AUTH_MODE=supabase`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY`
  - `APP_URL=https://<vercel-url>`
  - `DATABASE_URL` = the transaction pooler (6543) URL with `sslmode=require`
  - `DATABASE_PREPARE=false`
  - `DATABASE_POOL_MAX=1`
  - `CONTENT_RELEASE=development`
  - `DEV_AUTH_SECRET` is **not** set.
- Verify: run `npm run config:check` locally with the same variables loaded from `.env.staging.local`. It must report 0 errors. The `CONTENT_RELEASE` warning is expected.

**7.4 Google OAuth (owner action, you guide)**
- In a Google Cloud project `code-dungeon-staging`, set up the OAuth consent screen: External, app name "Code Dungeon (staging)", **scopes `openid`, `email`, `profile` only**.
- Create a Web OAuth client with the authorised redirect URI `https://<ref>.supabase.co/auth/v1/callback`.
- In Supabase › Auth › Providers › Google, paste the client ID and secret.
- In Supabase › Auth › URL configuration: Site URL = `APP_URL`, redirect allow-list = `APP_URL/auth/callback` and `APP_URL/auth/confirm`.

**7.5 Email**
- For an owner-only first run, Supabase's built-in sender works only for project team members, at 2 emails/hour.
- Before any other tester, the owner sets up custom SMTP (Resend free tier with a domain they control), per `docs/cloud-plan.md` §5. Record which was used.

**7.6 Deploy and smoke**
- After the deployment is live, run `npm run smoke -- https://<vercel-url>`. All 15 must PASS, including "a forged sign-in code is refused (rejected by Supabase mode)".
- Any failure goes through LOOP B.

**7.7 Real-provider journeys (the owner clicks, you observe and record)**
1. Google sign-in, then onboarding (handle, 13+ check), then play one challenge. XP shows on the leaderboard if opted in.
2. An unverified email is refused, and sign-out is possible.
3. A magic link with `next=https://evil.example` stays on-site.
4. Sign-out ends the session.
5. Profile › Delete account: the game rows are gone (check with SQL counts) **and** the Supabase Auth user is gone (dashboard).

Record each result with evidence. Only then mark R-47 and R-51 as verified in `docs/risk-register.md`.

**7.8 Report**
- Write `docs/PHASE_7_REPORT.md`: resources actually created (name, region, tier), verification evidence, issues found and fixed, cost ($0 expected), and remaining risks (R-60, R-61).
- Update `docs/decision.md` (DEC-013 status), `docs/issues.md`, `docs/risk-register.md` and `CHANGELOG.md`. Then run LOOP D.

## 8. After Phase 7: the backlog (each item through LOOP A, in this order)

1. Make the staging smoke test a manual GitHub Actions workflow (`workflow_dispatch` with a URL input). No secrets needed.
2. **Leaderboard ops:** a script that runs the totals verification query (`docs/LOCAL_BACKEND_HANDOFF.md` §4a) against any database, for R-58.
3. **Offensive-handle filter (R-08):** a maintained word list (licence recorded), applied in `validateHandle`, with tests. Don't block existing handles retroactively.
4. **Draft, not publish:** a privacy notice and terms for the owner's legal review once DEC-010 jurisdictions are decided. Mark it clearly as a draft that needs legal review.
5. **Owner and human items you cannot do:** human content review of 25 levels (DEC-011, `docs/CURRICULUM_REVIEW_CHECKLIST.md`), confirming DEC-014, R-53, and the interface redesign (postponed by the owner).

## 9. Definition of done for this prompt

Phase 7 is done when all of these hold:
- Staging is reachable over https.
- `config:check` shows 0 errors.
- `smoke` passes 15/15 against staging.
- The R-44 checks pass, and 0006 is verified on the host.
- All 5 real journeys are observed and recorded.
- `docs/PHASE_7_REPORT.md` exists.
- CI is green on the final commit.
- The handoff and this prompt are updated (LOOP D).
