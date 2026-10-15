# Phase 6 report — Security, account lifecycle, polish and QA

- **Status:** PASS locally and in CI. Every check passed on a clean install: 270 Vitest tests with a database (224 without), 26 Playwright tests, build, lint, format, typecheck, content validation, Python verification, runtime audit. CI runs #9 and #10 passed both jobs; the final documentation commit is reported in the hand-off.
- **Not verified:** real Google OAuth, real Supabase email and real Supabase admin deletion. No Supabase project exists, because creating one needs approval. Those code paths ran against a **local mock** of Supabase Auth (DEC-017), which proves Code Dungeon's code, not Google's or Supabase's behaviour.
- **Date:** 15 October 2026
- **Branch:** `claude/tender-cerf-ooekni` (not merged, nothing deployed). Baseline `e8c6498` (CI run #7 green).
- **Commits:**

| Commit | What |
|---|---|
| `081def6` | Account deletion, shared rate limit (migration 0003), security headers, phone overflow fix |
| `76190c1` | Mocked-Supabase browser tests on a production build; HttpOnly session cookies |
| `b5931e1` | Formatting fix for `76190c1` (I let a check's exit code be hidden by a pipe; fixed before CI ran on it) |
| `725b8db` | Map and room polish, progress strip, offline and retry states |
| `2219738` | QA journeys and the console/network guard |
| `10d26b9` | Curriculum review checklist and the AI-reviewer guard |
| final | Documentation |

## 1. Audit and baseline (Workstream 1)

Run at `e8c6498` before any change:

| Check | Result |
|---|---|
| Lint, format, typecheck, build | pass |
| Vitest with database | 245 passed |
| Content validation | 0 errors, 1 warning |
| Python verification | 148/148 |
| Playwright | 14/14 |
| Runtime audit | 0 vulnerabilities |
| Release check | exit 1, by design |

- The first Playwright attempt failed only because a dev server I had left running from Phase 5 blocked the test server. It passed after I stopped it. That is environmental, not a regression.
- No check was failing before Phase 6, so every defect below was found by review and is new in this report.
- Interface review was done at 1360, 1024, 820 and 390px with a seeded player.
- All findings and their status are in **`docs/issues.md`** (I-01 to I-17).

Main defects found:
- **I-01:** level rooms 5 and 10 were 97px wider than a phone. Screen-reader text in scrolled-off tabs escaped the tab strip's scroll container.
- **I-02:** the sticky challenge column could hide its own submit button on laptops.
- **I-03:** at 1024px the room stacked into one column with long lines.
- **I-04:** map states weren't distinct enough.
- **I-08:** Supabase cookies weren't HttpOnly, which is the library default.
- **I-09:** no anti-framing headers.

## 2. Security and account lifecycle (Workstream 2)

**Account deletion (DEC-015)**
- Profile › Delete account requires typing the exact handle and ticking an acknowledgement. The button stays disabled until both are done, and the server re-checks both.
- One database transaction deletes the player row, which cascades to all 11 player tables. Inside that same transaction, the Supabase user is deleted with the server-only `SUPABASE_SECRET_KEY` through `src/auth/supabase-admin.ts` (marked `server-only`).
- If Supabase refuses, nothing is deleted. In Supabase mode without the key, the action refuses up front. The identity deleted must be the session's own.
- Afterwards the session is signed out and the player sees `/account-deleted`.

**Isolation and authorization review**
- Every page and action still authorizes through `requirePlayer()`/`playerForAction()`. The new table `action_rate_limits` has row-level security and is included in every cross-account attack test.
- A resent submission id is processed once.
- Submission ids are scoped per player, so one player's id can't affect another's.

**Auth flows**

| Area | Finding and change |
|---|---|
| Callbacks | `/auth/callback` and `/auth/confirm` reject forged or reused codes and unknown OTP types |
| Redirects | `next` is sanitised; a hostile `next=https://evil…` stays on-site (end-to-end test) |
| Email verification | Unverified users are refused, and can now sign out from the sign-in page |
| Session expiry | Expired dev tokens are refused; Supabase sessions refresh in the proxy |
| Sign-out | Clears cookies and calls Supabase logout |
| Cookies | HttpOnly, SameSite=Lax, Secure in production |
| Headers | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, nosniff, referrer and permissions policies, COOP, HSTS in production. A script CSP is still open (R-52) |
| Configuration guards | Sign-in is disabled if a secret appears under a `NEXT_PUBLIC_` name; https is required in production except on loopback |

**Rate limiting (DEC-016)**
- Shared per-player limit in PostgreSQL: 40 answers or hints per minute, an atomic upsert, and RLS. A process-local guard (60 per minute) runs first.
- PostgreSQL is the approved store, so this adds no service or cost.
- Known limitation: a fixed window can allow up to 2× the limit across a minute boundary.
- **Migration risk:** `0003` only adds a table, grants and a policy. No existing rows or columns change, and it applies cleanly to the existing dev database ("1 applied, 2 already up to date"). Rolling back means dropping the table.

## 3. Interface (Workstream 3)

The existing identity is kept: no redesign, no new dependencies.

**Map**
- Encounter rooms get distinct seals: a double moss ring for checkpoints, an ember ring for major encounters, and a large ember-and-gold ring for the boss.
- Mastered rooms get a halo and a gold star. A won encounter gets a gold badge.
- Each room shows one status word.
- Zones have progress meters, and a collapsible legend explains every state.

**Level room**
- A progress strip shows required challenges solved, XP earned out of the level's maximum (computed by the domain's own `maxPathXp`) and mastery.
- Two columns from 900px, with lesson prose kept to a 72-character measure.
- The challenge column is sticky only on tall viewports, and never taller than the screen.
- A room-shaped loading skeleton.

**States**
- An offline notice appears when the connection drops.
- Error feedback has a Retry button that reuses the same submission id.
- Success and confirmation pages for deletion; the existing empty, loading and error states are kept.

**Review checklist:** `docs/VISUAL_REVIEW.md`, with the automated items marked. The design-system document is updated.

## 4. Quality assurance (Workstream 4)

**Playwright: 26 tests in two projects.** A shared fixture fails any test on a browser console error, a page error, a 5xx response or a real network failure.

`dev-signin` (19 tests, `next dev`):
- Signed-out redirects; a forged cookie; an **expired session**; **sign-out**.
- Under-13 refusal with nothing stored.
- A level-1 playthrough with exact XP, persisting across sessions.
- Two-account isolation; no answer leakage in the page HTML.
- **Encounter lives and defeat**, then a flawless win.
- All six challenge formats; the full path at 2,455 XP.
- Exact display of lesson code; journal and collection; profile visibility.
- **All 25 rooms at 390px** and three rooms at 820 and 1024px.
- An **offline answer retried and counted once**.
- **Leaderboard order matching the database ledger.**
- **Dev account deletion** and reuse of the freed name.
- axe accessibility scan of 11 views; reduced motion.

`supabase-mock` (7 tests, production build plus a local mock of Supabase Auth):
- Security headers.
- **Google sign-in through a mocked consent page**: PKCE challenge present, HttpOnly cookies, identity linked by provider id, no email stored.
- **Unverified Google email refused**, followed by sign-out.
- **Magic link through a mocked mailbox**, with a hostile `next` kept on-site.
- Forged codes rejected.
- Sign-out.
- **Account deletion removing both the database rows and the mock's Supabase user**, then signing up again from scratch.

**New Vitest tests:**
- Deletion at the store and action levels: rollback, missing key, Supabase refusal, identity mismatch, confirmation.
- The shared limiter: concurrency, windows, RLS, layering.
- Configuration guards; duplicate and cross-player submission ids.
- Per-level XP; checklist freshness; the AI-reviewer guard.

**Console and network:** the review captures at four widths found no console errors, failed requests or overflow after the fixes, and every browser test now enforces this.

## 5. Curriculum review (Workstream 5)

- **`docs/CURRICULUM_REVIEW_CHECKLIST.md`** is generated from the content by `npm run content:review-checklist`. A test fails if it drifts from the content.
- For each of the 25 levels it lists:
  - lesson checks: accuracy, **indentation rendering**, examples, misconceptions, practical context, sources
  - every challenge's prompt, answer key and accepted alternatives, with checks for correctness, **answer acceptance**, feedback, **hint progression** and explanations
  - a sign-off block for a named person
- **0 of 25 levels are human-reviewed.** The checklist says so, and a test asserts it.
- Validation now rejects `review.kind: human` with an AI-looking reviewer name.
- The release gate is unchanged: `content:release-check` exits 1.

## 6. Final check results (clean `npm ci`, PostgreSQL 16.15, Python 3.13.16)

| Check | Result |
|---|---|
| `npm run lint` / `format:check` / `typecheck` | exit 0 / 0 / 0 |
| `npm test`, with database (`REQUIRE_DB_TESTS=1`) | **26 files, 270 passed** |
| `npm test`, without database | 224 passed, 46 skipped |
| `npm run test:e2e` | **26 passed** (19 dev-signin + 7 supabase-mock) |
| `npm run build` | pass. Static: `/`, `/account-deleted`. Dynamic: game routes, auth routes, proxy |
| Content validation / Python verification | 0 errors, 1 warning / 148 of 148 |
| `content:release-check` | exit 1 as intended (25 blocked) |
| `content:review-checklist --check` | up to date |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| Full `npm audit` | 5 high in lint tooling only, unchanged since Phase 1 (R-31) |
| Browser bundle scan (`.next/static`) | No `DATABASE_URL`, `DEV_AUTH_SECRET`, `SUPABASE_SECRET_KEY`, `sb_secret_`, `service_role`, role, function or table names, `admin/users`, answer-key fields, `createHmac` or connection strings |
| CI | Runs #9 (`b5931e1`) and #10 (`2219738`) passed, including the new supabase-mock job. Run #8 was superseded by #9 |
| Preserved | `git diff e8c6498` is empty for `src/domain`, `src/learning/evaluation`, `src/learning/projection.ts` and `content/` |

## 7. Unresolved issues and decisions needing approval

| Item | What is needed |
|---|---|
| Supabase project (R-47, I-17, DEC-013) | Approval to create the project (free tier), Google OAuth client, email sender and `SUPABASE_SECRET_KEY`. Then repeat the supabase-mock journeys against the real project |
| Human content review (I-16, DEC-011) | A person works through `docs/CURRICULUM_REVIEW_CHECKLIST.md` |
| Launch jurisdictions (DEC-010, R-49) | Countries to launch in, plus legal review of the age and consent rules |
| DEC-014 | Confirm leaderboard visibility as opt-in |
| Script CSP (R-52, I-15) | Engineering work before public launch; no approval needed |
| Answer keys in the checklist (R-53) | Decide whether content and checklist move to a private repository before the repo is ever made public (O-10) |

**Cost:** $0. No external services or paid resources. The CI end-to-end job now also builds a production copy, adding about 1 minute of GitHub Actions time per push.

## 8. Recommended Phase 7

**Hosted staging behind approval.** Entry criteria: the owner approves the Supabase project and a Vercel preview with a cost plan.

1. Create the Supabase project.
   - Apply migrations; verify `SET LOCAL ROLE` and the `code_dungeon_app` role there (R-44).
   - Configure Google OAuth, the email template and the redirect allow-list.
   - Run the supabase-mock journeys manually against the real project and record the results (R-47, R-51).
2. Set up a private Vercel preview.
   - Use the Supabase connection pooler; set environment secrets through the platform, never in the repo.
   - Add a nonce-based CSP (R-52) and a production smoke test.
3. Human content review, zone by zone, with the checklist; set `review.kind: human` per level as a person signs off.
4. Privacy notice, terms and data retention for the agreed jurisdictions (DEC-010).
5. Then a closed playtest with real learners to tune the game balance (R-39).
