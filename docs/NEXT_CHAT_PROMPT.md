# Prompt for the next Claude Code chat

Copy everything below the line into a new local Claude Code conversation opened in the worktree folder.

---

CODE DUNGEON: CONTINUE LOCAL BACKEND WORK

You are the lead engineer continuing Code Dungeon on the owner's Windows laptop with normal local Claude Code. Do not use Claude Cloud. Do not start a new project, rebuild completed work or redesign the frontend. The interface will be redesigned separately once the backend is stable.

**Where the code is**

| | |
|---|---|
| Repository | https://github.com/SyedAmaan001/Code-Dungeon-.git |
| Local worktree | `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1\.claude\worktrees\code-dungeon-recovery-b0a626` |
| Main checkout | `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1`. It stays on `main`, which is only the docs. Don't work there |
| Branch | `claude/tender-cerf-ooekni`, tracking `origin/claude/tender-cerf-ooekni`. The previous session started from `a431bed`. Its last commit is the tip of this branch; check it with `git log -3 --oneline` and compare with `git status -sb` / `git fetch` before working |

**Read first:**
- `CLAUDE.md`
- `docs/LOCAL_BACKEND_HANDOFF.md`, the full state, setup and test results
- `docs/API_CONTRACTS.md`, the backend surface
- `docs/issues.md`, `docs/risk-register.md` and `docs/decision.md` (DEC-001…019)
- `docs/PHASE_6_REPORT.md`

Then open the source files the next task touches. Don't re-audit the whole repository: the handoff records what was verified on 17 October 2026.

**Local environment.** Use Git Bash. Don't print secret values.

```bash
export PATH="/c/Users/syeda/AppData/Local/Author Software/nvm/installs/v24.20.0:$PATH"
bash scripts/db/local-postgres.sh start      # not `npm run db:local` (that picks WSL bash)
export DATABASE_URL=postgresql://postgres@127.0.0.1:54329/code_dungeon_dev
export TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/postgres
export REQUIRE_DB_TESTS=1 NEXT_TELEMETRY_DISABLED=1
npm run db:migrate && npm test
```

- Node 24 is used because nvm has no Node 22. It satisfies `engines`.
- PostgreSQL 16.15 binaries are in the git-ignored `.local/pgsql` of this worktree.
- Browser tests use `npx playwright test` (35 tests, about 10 to 15 minutes on this laptop). Stop leftover servers on ports 3100, 3101 and 54400 first. Don't edit `src/` while e2e is running: `next dev` hot-reloads the changes into the run.

**Already done. Don't repeat it.**
- Phases 1–6.
- Windows portability fixes: POSIX content paths, `.gitattributes` LF, the Windows path in `local-postgres.sh`, the e2e DB setup path.
- Nonce-based script CSP from the proxy (`src/csp.ts`, `src/proxy.ts`), fixing R-52 and I-15.
- `docs/API_CONTRACTS.md`.

**Next task (in order)**

1. **Leaderboard scaling.** `leaderboard_records()` (`db/migrations/0001_initial.sql`) sums the whole `xp_ledger` on every view.
   - Add an **additive** migration `0004` that keeps a per-player, per-path XP total and the time it was reached, maintained in the same transaction as `xp_ledger` inserts. A trigger or explicit service write both work; prefer whichever matches `postgres-player-store.ts`.
   - Backfill it from the ledger.
   - Rewrite `leaderboard_records()` to read the total, ordering and limiting in SQL so only top-N plus the viewer come back.
   - Keep the ranking semantics in `src/domain/game/leaderboard.ts` identical, including ties on equal XP and reach time, opt-in visibility and `minXp`.
   - Prove equivalence with DB tests: old aggregation vs new totals after random submissions, concurrency, account-deletion cascade and RLS (the table must be in the cross-account attack tests).
2. **Rate-limit the remaining authenticated writes**: `updateProfile`, `completeOnboarding` and `deleteAccount` in `src/app/actions/account.ts`. Reuse the existing layered limiter pattern with a separate, low per-player budget. Add tests. Don't change answer and hint limits.
3. Update `docs/API_CONTRACTS.md`, `docs/LOCAL_BACKEND_HANDOFF.md`, `docs/issues.md`, `docs/risk-register.md` and `CHANGELOG.md`. Then rewrite this file with the next task.

**Rules**
- Don't change XP rules, curriculum, quest, achievement, encounter or checkpoint semantics, or the interface.
- Migrations must be additive. Never reset or drop a database with data in it; tests use throwaway databases.
- Don't create Supabase, Google OAuth, email, Vercel or any paid resource without explicit owner approval. Real-provider behaviour is still **unverified** (R-44, R-47); the `supabase-mock` tests are not real OAuth.
- Don't run learner Python on the server.
- Before each commit, run lint, format:check, typecheck, `npm test` with the DB, content:validate and the build. Run e2e when the proxy, auth or pages change.
- Review the diff for secrets. Commit on `claude/tender-cerf-ooekni` only. Never push to or merge into `main`, and never force-push.
- Push only if `git fetch` shows the remote branch hasn't moved.
- Before you stop: update `docs/LOCAL_BACKEND_HANDOFF.md` and this file, then reply with only the updated continuation prompt.
