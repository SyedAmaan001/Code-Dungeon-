# Phase 5 report — Decision lock and first playable slice

- **Status:** PASS locally and in CI. The full 25-level Python path is playable in the browser with saved progress. All checks are green, including 242 Vitest tests against PostgreSQL and 13 Playwright browser tests. CI run #5 passed both jobs on GitHub.
- **Not verified:** sign-in against a real Supabase project. The project and its credentials need owner approval (DEC-013), and this environment has no Docker for Supabase's local stack. Supabase mode is implemented and unit-tested with stubs; play and browser tests use the development-only sign-in.
- **Date:** 15 October 2026
- **Branch:** `claude/tender-cerf-ooekni` (not merged to `main`, nothing deployed)
- **Commits:**
  - `bebf252` — decisions and release gate
  - `32a0827` — authentication, onboarding, migration `0002`
  - `e305a98` — interface
  - `5270236` — browser tests and CI
  - plus this documentation commit
- **Starting point:** `f24be04` (Phase 4, CI run #4 green)

## 1. Decisions recorded (`docs/decision.md`)

| ID | Decision | Status |
|---|---|---|
| DEC-009 | Supabase Auth with Google OAuth and email magic link. Verified email is required, there are no passwords, and authorization happens on the server. Credentials go in environment variables only, and none are configured without approval. A development-only sign-in exists for local work | CONFIRMED (supersedes DEC-008) |
| DEC-010 | The audience is 13+. A neutral age screen stores the outcome only. Personal data is minimised. Open legal questions are documented: COPPA, GDPR Art. 8 (13–16), the UK Age Appropriate Design Code (AADC), India's Digital Personal Data Protection Act (DPDP) | CONFIRMED; launch jurisdictions PENDING |
| DEC-011 | AI review and human review are distinct statuses; `review.kind` is required. All 25 levels are playable in development. Human review is required for public release, enforced by a release mode and a release check | CONFIRMED |
| DEC-012 | Game rules are locked: 3 lives per major or boss run, no XP from quests or achievements, boss victory doesn't gate the next level, 2,455 XP maximum | CONFIRMED (confirms DEC-002, DEC-005, DEC-006) |
| DEC-013 | Development is local first. Supabase (auth and PostgreSQL) is intended; Vercel is proposed. Nothing is provisioned without approval | CONFIRMED direction |
| DEC-014 | Leaderboard visibility is opt-in at onboarding (high-privacy default) | **PROPOSED** — differs from the earlier O-9 recommendation; please confirm |

## 2. What was built

**Authentication and authorization (`src/auth/`, `src/proxy.ts`, `src/app/actions/`, `src/app/auth/`)**

- `AUTH_MODE` selects the sign-in mode:
  - `supabase`: needs the URL, the *publishable* key and `APP_URL`. A key starting with `sb_secret_` is refused.
  - `dev`: needs a secret of 32+ characters. It is **refused when `NODE_ENV=production`**.
  - unset: sign-in is disabled with an explanation.
- Supabase sessions are verified with `auth.getUser()`. A user without a confirmed email is rejected, and any error counts as signed out. The identity is `supabase:<user id>`; email addresses are never copied into the game database.
- The proxy refreshes Supabase cookies and sends signed-out visitors to `/sign-in?next=…`. The actual check is `requirePlayer()` in every page and layout, and `playerForAction()` in every server action.
- Request bodies go to the services unchanged. Their strict schemas reject any extra field such as `playerId` or `xp`.
- Redirect targets come from `APP_URL` plus a sanitised `next` path, never from request headers.
- Magic-link requests answer identically whether or not an account exists.
- A process-local rate limit allows 40 answers or hints per player per minute.

**Onboarding (DEC-010)**
- The player chooses a handle and gives a birth month and year. The server decides conservatively, assuming the latest possible birthday in that month.
- Under-13 answers create nothing, and a 24-hour cookie discourages immediately re-entering a different year.
- Migration `0002_age_check` adds `age_check_policy` and `age_checked_at` only. A `CHECK` requires every identity-linked player to have passed; it is `NOT VALID`, so older local rows still load.

**Content release (DEC-011)**
- `src/learning/release.ts` provides `reviewStatus()` and `applyReleasePolicy()`. In `public` mode, levels without human review are marked `review`, so anything that depends on them stays locked.
- `npm run content:release-check` exits 1 today: all 25 levels are AI-reviewed only.

**Interface (`src/app/`, `src/ui/`, `src/world/`)**

| Screen | What it does |
|---|---|
| Landing | Atmospheric hero; figures come from content (25 levels, 5 zones, 6 formats, 6 quests and 11 achievements); a notice about AI review |
| Sign-in | Supabase mode shows Google and magic-link options; dev mode shows a labelled development form; disabled mode explains why. Errors are shown for unverified email and expired links |
| Onboarding | Handle, neutral age screen, leaderboard opt-in |
| Home | Continue/enter the next level; a ledger of XP (of 2,455), levels, mastery, quests, achievements and last checkpoint; active quests; recent finds; a review-status notice; an "Expedition complete" state |
| Dungeon map | Five zones with original scene banners. Rooms show locked, open, in-progress, complete or mastered with icons and text, plus checkpoint, major and boss markers and "continue here". It is data-driven, laid out as a zig-zag row on desktop and a vertical trail on phones |
| Level room | Zone header, review badge, lesson (objectives, explanation, verified examples, mix-ups, practical context) and a challenge panel. All six formats have their own accessible controls: options, output box, inline blanks, move-up/down ordering, trace fields, and line-plus-fix pickers. There is server feedback with targeted explanations, progressive hints, and notices for XP, unlocks, quests, items and lives. The encounter panel shows lives, the run, defeat and victory. Also: completion banner with next level, sealed-room page with prerequisites, not-found |
| Quest journal | Active, completed and locked quests, with objectives, progress counts and rewards |
| Collection | Keepsakes (unearned ones as silhouettes) and achievements (dates or progress) |
| Leaderboard | Top 50 by the DEC-006 rules; the viewer's rank or the reason they are unranked; empty state |
| Profile | Handle and visibility settings, a data statement, sign-out |
| States | Loading skeletons, empty states, an error boundary ("your saved progress is safe"), "rate limited", "signed out" and "not counted" feedback |

- The design system and contrast measurements are in `docs/DESIGN_SYSTEM.md`.
- All art is original inline SVG, and the fonts are self-hosted OFL packages (`docs/ASSETS.md`).
- The UI has no scoring, unlock or reward logic. It renders service read models and calls server actions, and encounter and XP state are refreshed from the server after every answer.

**Service additions (additive)**
- `GameService.levelRoom()` returns a level plus the active encounter run (lives, solved this run).
- `getView()` gains zones, `maxXp` and quest objective titles.
- `LearningService.getLevel()` returns a challenge's explanation only once the player has solved it.
- New pieces: `Presenter` (display-ready results with no keys or ids), `RateLimiter`, `runtime.ts` (wiring and pool).

## 3. Checks and results

Run from a clean `rm -rf node_modules .next && npm ci`, with local PostgreSQL 16.15 and Python 3.13.16:

| Check | Result |
|---|---|
| Migrations | `0002_age_check` applied to the existing dev database ("1 applied, 1 already up to date"); a clean database applies both. The test runs them twice |
| `npm run lint` | exit 0 |
| `npm run format:check` | all files formatted |
| `npm run typecheck` | exit 0 |
| `npm test`, with database and `REQUIRE_DB_TESTS=1` | **22 files, 242 passed** |
| `npm test`, without database | 212 passed, 30 skipped |
| `npm run test:e2e` | **13 passed** locally; also 13 passed in CI on GitHub |
| `npm run content:validate` | 0 errors, 1 warning (AI review only) |
| `npm run content:verify-python` | 140/140 curriculum snippets and 8/8 fixtures |
| `npm run content:release-check` | exit 1 as intended: 25 levels blocked for public release |
| `npm run build` | compiled. `/` is static; the game routes are dynamic; the proxy is active |
| Production refuses the dev sign-in | `next start` with `AUTH_MODE=dev` set shows "The development sign-in cannot be used in a production build.", no dev form, and `/play` redirects (307) to sign-in |
| Browser bundle scan (`.next/static`) | No `DATABASE_URL`, `DEV_AUTH_SECRET`, role or function names, connection strings, `sb_secret`/service-role, answer-key fields or `createHmac` |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| Full `npm audit` | 5 high: the same lint-tooling chain as Phase 1 (R-31); nothing new |
| Secrets | `.env.local` is git-ignored; `.env.example` holds names only. The e2e HMAC key is a fixed, labelled test value, not a credential |
| `git diff f24be04` for `src/domain`, `src/learning/evaluation`, `src/learning/projection.ts`, `content/` | empty |

**Browser tests (`e2e/game.spec.ts`; real dev server, fresh `code_dungeon_e2e` database):**
1. Every game route redirects signed-out visitors to sign-in.
2. A forged session cookie is refused.
3. An under-13 answer is refused, the database confirms no player row, and a retry with another year is refused.
4. A new player plays level 1 through the UI: a wrong answer, a hint, then correct answers. The XP is exact (`10×difficulty`, first-try bonuses, plus 25 for completion). A fresh browser session shows the same XP, level 2 open and the quest journal.
5. A second account has no shared progress, is shown a sealed room for level 2, and is hidden from the leaderboard by default.
6. The level HTML holds no hints, explanations or correct-answer feedback for unsolved challenges.
7. Major encounter: lives go from 3 to 2, 1 and 0, the run is defeated, XP is unchanged, and the second run is won flawlessly.
8. All six challenge formats are answered wrong and then right with their own controls; a full path ends at **2,455 XP** with "Expedition complete".
9. The journal shows "Repair the Gate" complete; the collection shows Gate Key and Copper Ring; the home ledger shows checkpoint level 5.
10. Toggling profile visibility hides and then restores the player on the leaderboard.
11. At 390px there is no horizontal scrolling on six screens, and the bottom nav is shown instead of the top nav.
12. axe (WCAG 2.1 A/AA) finds no serious or critical violations on landing, sign-in and eight game screens.
13. Reduced motion stops decorative animation.

**Other new unit tests:** auth config, dev tokens, Supabase identity (verified, unverified and error cases), the age rule, redirect safety, the action boundary (signed-out callers, forged `playerId`/`xp`, server-judged answers, rate limit, hidden errors), presenter and level room, the release policy, and the account age-check constraint in the database.

## 4. Files

- **Created:**
  - `src/auth/*`, `src/proxy.ts`
  - `src/app/actions/{auth,account,game}.ts`, `src/app/auth/{callback,confirm}/route.ts`
  - `src/app/{sign-in,onboarding,play/**}`, `src/app/{error,not-found}.tsx`
  - `src/ui/**`, `src/world/catalog.ts`
  - `src/services/{presenter,rate-limit,runtime}.ts`, `src/learning/release.ts`
  - `db/migrations/0002_age_check.sql`
  - `scripts/content-release-check.ts`, `scripts/e2e/*`, `playwright.config.ts`, `e2e/*`
  - `tests/auth/*`, `tests/learning/release.test.ts`, `tests/services/presenter.test.ts`
  - `docs/{PHASE_5_REPORT,DESIGN_SYSTEM,ASSETS}.md`
- **Changed:**
  - Services (additive), the content schema (`review.kind` required) and fixtures, accounts (age check)
  - Root layout, landing page, `globals.css`, `next.config.ts` (`agentRules: false`)
  - `package.json`/lock, `.env.example`, `.gitignore`, CI
  - README, CHANGELOG, `decision.md`, EXECUTION, WORKFLOW, risk register, next-steps, `auth-design.md`

## 5. Unresolved issues and limitations

- **Supabase is not connected (R-47).** To finish it: create the project, set the Site URL and the redirect allow-list for `/auth/callback`, configure the email template and the Google OAuth client, then run an end-to-end check. All of this needs approval (DEC-013).
- **Account deletion (R-46).** Game data can be deleted in code, but there is no self-service UI. Deleting the Supabase user needs an admin credential, which is not approved.
- **Legal (R-49).** Launch jurisdictions, privacy notice, terms and retention are open (DEC-010, P-007).
- **Content.** All 25 levels are AI-reviewed only. A public build would currently have no playable levels, by design (DEC-011).
- **Rate limiting is process-local (R-48).** Hosted multi-instance deployment needs a shared limiter.
- **Browser tests run on `next dev` (R-50),** because the dev sign-in is refused in production by design. The production build is still built in CI, and its refusal of the dev sign-in was checked by hand.
- **Quests without an activation condition** appear once the player's first answer is processed (existing engine behaviour), so a brand-new player sees "No active quests yet".
- **Art is a first pass.** The SVG scenes are deliberately lightweight. Owner review of this slice comes before any larger art investment (P-006).
- **Leaderboard default (DEC-014)** needs your confirmation.

## 6. Cost and external services

- No external service, account, project or paid resource was created or activated. Infrastructure cost is **$0**.
- GitHub Actions now runs two jobs per push. The second job, about 1 minute, downloads Chromium.
- New runtime dependencies are the Supabase client libraries (MIT) and three OFL font packages. Package versions were chosen to be at least about three weeks old.

## 7. Next recommended steps

1. **Owner approvals:**
   - Create the Supabase project (free tier) and configure Google OAuth and the email template.
   - Confirm DEC-014.
   - Name the launch jurisdictions.
2. **Phase 6 — Content review and hosted staging:**
   - Human review of the levels, zone by zone (`review.kind: human`).
   - Verify Supabase end to end, including the `SET LOCAL ROLE` compatibility in R-44.
   - Account deletion and a shared rate limit.
   - A private Vercel preview once the cost is approved.
3. **Art and feel:** owner review of this slice, then decide the art source (O-11) and any richer zone illustrations.
