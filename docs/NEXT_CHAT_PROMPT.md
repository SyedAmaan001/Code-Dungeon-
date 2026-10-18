# Prompt for the next Claude Code chat

Copy everything below the line into a new local Claude Code conversation opened in the worktree folder. **Use it only after the owner has reviewed and approved `docs/cloud-plan.md`.** Until then there is no unblocked backend task: the work is waiting on the owner.

---

CODE DUNGEON: PHASE 7, HOSTED STAGING VERIFICATION (ONLY WITH THE OWNER'S APPROVAL)

**BLOCKER CHECK FIRST.** This task uses external services. Proceed only if the owner's message in this chat says which option of `docs/cloud-plan.md` they approve (A free-tier or B paid), the region, and that they have created the provider accounts themselves. If any of that is missing, do not create, configure or sign in to anything external. Ask for it, and stop.

You are the lead engineer continuing Code Dungeon on the owner's Windows laptop with normal local Claude Code, not Claude Cloud. Do not start a new project, repeat finished work or redesign the interface (the redesign and 3D work are postponed).

**Where the code is**

| | |
|---|---|
| Repository | https://github.com/SyedAmaan001/Code-Dungeon-.git |
| Local worktree | `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1\.claude\worktrees\code-dungeon-recovery-b0a626` |
| Main checkout | `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1`. It stays on `main` (docs only). Don't work there |
| Branch | `claude/tender-cerf-ooekni`, tracking origin |
| History | Sessions 1–2 ended at `2e77d40`. Session 3 pushed `c7574b5` (cloud plan, `config:check`, `smoke`, `DATABASE_PREPARE`; CI run 39097422077 green), then one docs-only commit recording that |

**First, verify:**
1. Run `git fetch && git status -sb && git log -5 --oneline`.
2. Check CI with `gh run list --repo SyedAmaan001/Code-Dungeon- --branch claude/tender-cerf-ooekni --limit 3`. Red CI comes first.
3. Preserve uncommitted work. Never reset, rewrite history, force-push or touch `main`.

**Read:**
- `CLAUDE.md`
- `docs/cloud-plan.md`, the plan you are executing; follow its §3–§6 exactly
- `docs/LOCAL_BACKEND_HANDOFF.md`
- `docs/API_CONTRACTS.md`
- `docs/auth-design.md`
- `docs/decision.md` (DEC-009, DEC-010, DEC-011, DEC-013, DEC-014, DEC-015, DEC-020, DEC-021)
- `docs/risk-register.md` (R-44, R-47, R-51, R-58, R-60, R-61)
- `e2e/supabase-auth.spec.ts`, the journeys to repeat for real

**Local environment.** Use Git Bash. Never pipe the database start command.

```bash
export PATH="/c/Users/syeda/AppData/Local/Author Software/nvm/installs/v24.20.0:$PATH"
bash scripts/db/local-postgres.sh start > /tmp/pg.txt 2>&1
export TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/postgres REQUIRE_DB_TESTS=1 NEXT_TELEMETRY_DISABLED=1
npm test                                   # expect 33 files, 318 passed
```

**Already done. Don't repeat it.**
- Phases 1–6.
- Windows fixes.
- Nonce CSP.
- API contracts.
- Leaderboard totals (0004).
- Account-write limits (0005).
- `docs/cloud-plan.md`.
- `npm run config:check`.
- `npm run smoke -- <url>`, which passed 15/15 against the local production build with the Supabase mock.
- `DATABASE_PREPARE=false` for transaction poolers.

**Task (in order, only as approved)**

1. **The owner creates and configures; you guide.** Following `docs/cloud-plan.md` §3–§5, walk the owner through creating the Supabase project, Vercel project, Google OAuth client and SMTP sender.
   - The owner pastes every secret (database password, `SUPABASE_SECRET_KEY`, Google client secret, SMTP key) into the provider dashboards. Never into chat, the repository or logs.
   - Inspect variable names and presence only.
2. **R-44 first.** Apply migrations 0001–0005 over the session pooler (`npm run db:migrate`, then `npm run db:status`), using a URL the owner sets in your shell environment without showing it. Run the §4.3 queries.
   - If `SET LOCAL ROLE code_dungeon_app` is refused, write an **additive, ASCII-only** migration `0006` granting membership with `SET` to the connecting role.
   - Test it locally against PostgreSQL of the same major version as the project, then apply it.
3. **Deploy and preflight.**
   - `npm run config:check` with the deployment's variables must show no errors.
   - Deploy the branch to the approved Vercel project.
   - Run `npm run smoke -- https://<staging-url>`: 15/15 required.
4. **Real-provider journeys.** These are manual, done by the owner, with you observing results:
   - Google sign-in and onboarding.
   - Unverified email refused.
   - Magic link with a hostile `next` staying on-site.
   - Sign-out.
   - Account deletion removing both the game rows and the Supabase user.

   Record exactly what was observed. Only then may R-47 and R-51 be closed.
5. **Write `docs/PHASE_7_REPORT.md`**, and update `docs/LOCAL_BACKEND_HANDOFF.md`, `docs/issues.md`, `docs/risk-register.md`, `docs/decision.md` (DEC-013 status), `CHANGELOG.md` and this file. Record the resources actually created, their region and cost tier.

**Rules**
- No resource beyond the approved plan. No paid tier unless Option B was approved. Keep spend caps as in the plan.
- Never print, commit or ask for secret values in chat.
- Don't change XP, curriculum, quest, achievement, encounter, checkpoint or leaderboard semantics, or the interface. Migrations stay additive and ASCII.
- Don't run learner Python on the server.
- Never delete an external resource or its data without explicit approval.
- Before each commit, run lint, format:check, typecheck, `npm test` with the DB, content:validate and the build. Run e2e if the proxy, auth or pages change. Run `npm audit --omit=dev` and review the diff for secrets.
- Commit only on `claude/tender-cerf-ooekni`. Push after `git fetch` shows the remote hasn't moved. Never force-push or merge into `main`. A preview deployment is not a public release.
- Before you stop: update `docs/LOCAL_BACKEND_HANDOFF.md` and this file, then reply with only the updated continuation prompt.
