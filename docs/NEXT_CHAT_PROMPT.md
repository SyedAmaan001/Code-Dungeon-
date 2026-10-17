# Prompt for the next Claude Code chat

Copy everything below the line into a new local Claude Code conversation opened in the worktree folder.

---

CODE DUNGEON: PREPARE THE HOSTED-STAGING APPROVAL PACKAGE (NO PROVISIONING)

You are the lead engineer continuing Code Dungeon on the owner's Windows laptop with normal local Claude Code, not Claude Cloud. Do not start a new project, repeat finished work or redesign the interface. The visual redesign and 3D work are postponed.

**Where the code is**

| | |
|---|---|
| Repository | https://github.com/SyedAmaan001/Code-Dungeon-.git |
| Local worktree | `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1\.claude\worktrees\code-dungeon-recovery-b0a626` |
| Main checkout | `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1`. It stays on `main` (docs only). Don't work there |
| Branch | `claude/tender-cerf-ooekni`, tracking origin |
| History | Session 1 ended at `1e917f1` (CI green). Session 2 added leaderboard totals and account-write limits in the commit after it, plus possibly one docs-only commit recording the push |

**First, verify:**
1. Run `git fetch && git status -sb && git log -5 --oneline`.
2. Check CI for the latest push: `gh run list --repo SyedAmaan001/Code-Dungeon- --branch claude/tender-cerf-ooekni --limit 3`. If CI is red, fixing it comes first.
3. Preserve any uncommitted work. Never reset, rewrite history, force-push or touch `main`.

**Read:**
- `CLAUDE.md`
- `docs/LOCAL_BACKEND_HANDOFF.md` (state, setup, results, risks)
- `docs/API_CONTRACTS.md`
- `docs/EXECUTION.md`, especially the cloud-plan requirement
- `docs/PHASE_6_REPORT.md` §7–8 (Phase 7 entry criteria)
- `docs/decision.md` (DEC-009, DEC-010, DEC-013, DEC-014, DEC-015, DEC-020, DEC-021)
- `docs/risk-register.md` (R-44, R-47, R-51, R-52, R-58, R-59)
- `docs/auth-design.md`, `.env.example`, `next.config.ts`, `src/auth/config.ts`, `db/migrations/`

Don't re-audit the whole repository.

**Local environment.** Use Git Bash. Never pipe the database start command: it hangs and can kill PostgreSQL.

```bash
export PATH="/c/Users/syeda/AppData/Local/Author Software/nvm/installs/v24.20.0:$PATH"
bash scripts/db/local-postgres.sh start > /tmp/pg.txt 2>&1
export DATABASE_URL=postgresql://postgres@127.0.0.1:54329/code_dungeon_dev
export TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/postgres
export REQUIRE_DB_TESTS=1 NEXT_TELEMETRY_DISABLED=1
npm run db:migrate && npm test          # expect 31 files, 303 passed
```

- e2e runs with `npx playwright test --timeout=180000` (35 tests, about 10–15 minutes). Stop leftover servers on ports 3100, 3101 and 54400 first, and don't edit `src/` while it runs.
- The local cluster is WIN1252, so keep migrations ASCII-only.

**Already done. Don't repeat it.**
- Phases 1–6.
- Windows portability fixes.
- Nonce-based script CSP.
- `docs/API_CONTRACTS.md`.
- Maintained leaderboard totals: migration 0004, `leaderboard_page()`, proven equal to `rankLeaderboard()`.
- Shared rate limits on onboarding, profile update and account deletion: migration 0005.

**Why this is the next task.** Phase 7 (hosted staging: Supabase project, Google OAuth client, email sender, Vercel preview) is blocked on owner approval. `docs/EXECUTION.md` requires `docs/cloud-plan.md` before any resource is created, and that file doesn't exist yet. Everything below is non-billable and creates nothing external.

**Next task (in order)**

1. **Write `docs/cloud-plan.md` for the owner to approve.** It must contain:
   - **Providers, project names and region** for Supabase (Auth plus Postgres) and Vercel (preview), and an email sender (Supabase's built-in sender vs a custom SMTP).
   - **Pricing:**
     - Look up current pricing and free-tier limits on the official pricing pages with web search. Record the pricing date and source URLs. Don't rely on memory.
     - Low and moderate monthly cost estimates.
     - What is variable.
     - Alert vs hard cap.
     - Free-tier pausing and inactivity rules.
   - **Secrets:** each env var name from `.env.example`, where it lives (Vercel env, never the repo), and who holds `SUPABASE_SECRET_KEY`.
   - **Database:**
     - Migrations 0001–0005 run with `npm run db:migrate` against the Supabase connection.
     - How to verify `SET LOCAL ROLE code_dungeon_app`, the `SECURITY DEFINER` functions and triggers under Supabase's managed roles (R-44).
     - Pooler mode: transaction vs session. Note that `SET LOCAL` and `set_config(..., true)` are transaction-scoped.
     - Backups and point-in-time recovery on the chosen tier.
   - **Auth configuration:** the Google OAuth client with exact redirect URIs (`/auth/callback`), Supabase redirect allow-list, email template linking to `/auth/confirm`, `APP_URL`.
   - **Data and privacy:** what is stored, retention and deletion (DEC-015), and the open jurisdiction question (DEC-010).
   - **Rollback and cleanup:** how to delete each resource, and what deleting it costs or loses.
   - **Owner checklist:** a plain list of what the owner must approve or create themselves.
2. **Add a deployment smoke test that needs no credentials**, e.g. `scripts/smoke.ts` plus an npm script, runnable against any base URL. It should check:
   - The security headers and a per-response CSP nonce.
   - Signed-out redirects for `/play`.
   - That `/sign-in` renders.
   - That `/auth/callback` with a forged code goes to `/sign-in?error=link`.
   - That no secrets or answer keys appear in the HTML.

   Test it against the local production build (`next build && next start`). It must not sign in or write data.
3. **Add a configuration preflight** (for example `npm run config:check`). Reuse `src/auth/config.ts` and `readAdminConfig`; don't duplicate them. It should report missing or misplaced env vars by name only (never values) for a production deployment, including the existing `NEXT_PUBLIC_` secret guard and the `APP_URL` https rule. Add unit tests.
4. Update `docs/LOCAL_BACKEND_HANDOFF.md`, `docs/issues.md`, `docs/risk-register.md`, `CHANGELOG.md` and the decision log (only if a decision changes). Then rewrite this file with the next task: most likely "wait for owner approval of `docs/cloud-plan.md`, then Phase 7 provisioning", unless repository evidence shows other unblocked backend work.

**Rules**
- Do not create Supabase, Google OAuth, email, Vercel or any paid or external resource. Only document them for approval.
- Real Google, Supabase and email behaviour remains **unverified**; the `supabase-mock` tests are not real OAuth.
- Don't change XP, curriculum, quest, achievement, encounter, checkpoint or leaderboard semantics, or the interface. Migrations stay additive and ASCII.
- Never print secret values or put them in the repo.
- Don't run learner Python on the server.
- Before each commit, run lint, format:check, typecheck, `npm test` with the DB, content:validate and the build. Run e2e if the proxy, auth or pages change. Run `npm audit --omit=dev` and review the diff for secrets.
- Commit only on `claude/tender-cerf-ooekni`. Push only after `git fetch` shows the remote hasn't moved. Never force-push or merge into `main`.
- Before you stop: update `docs/LOCAL_BACKEND_HANDOFF.md` and this file, then reply with only the updated continuation prompt.
