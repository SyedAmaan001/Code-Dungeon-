# Code Dungeon — hosted staging plan (for owner approval)

- **Status:** PROPOSAL. **Nothing in this document has been created.** No account, project, key or paid resource exists. Each resource below needs the owner's explicit approval, and most need the owner to create the account themselves.
- **Purpose:** this is Phase 7 of `docs/PHASE_6_REPORT.md` §8: a private hosted staging environment. It is the first time real Google sign-in, real Supabase email and real account deletion can be verified (R-47, R-51), and the first check of the database roles on a managed host (R-44).
- **Pricing date:** 18 October 2026, read from the official pages listed in §9. Prices and limits change, so re-check them on the day you approve.
- **Rules this follows:** `CLAUDE.md` § Security and spending; `docs/EXECUTION.md` (cloud-plan requirement); DEC-009 (Supabase Auth: Google plus magic link); DEC-013 (Supabase and Vercel intended, nothing provisioned); DEC-015 (account deletion needs a server-only key).

## 1. What would exist

| # | Resource | Provider | Name (proposed) | Region (proposed) | Used for |
|---|---|---|---|---|---|
| 1 | Supabase organisation and project | Supabase | `code-dungeon-staging` | `ap-south-1` (Mumbai) | Auth (Google OAuth, magic link) and PostgreSQL 15+ for game data |
| 2 | Vercel project | Vercel | `code-dungeon-staging` | functions in `bom1` (Mumbai), next to the database | Hosts the Next.js app from branch `claude/tender-cerf-ooekni` |
| 3 | Google Cloud project and OAuth client (web) | Google | `code-dungeon-staging` | global | "Sign in with Google" through Supabase |
| 4 | Transactional email sender | Resend (alternatives: AWS SES, Postmark, Brevo) | API key `code-dungeon-staging-smtp` plus a sending domain the owner controls | n/a | Magic-link and confirmation emails through Supabase custom SMTP |

**Region assumption:** Mumbai is suggested because the laptop's locale suggests India. The launch jurisdictions are still undecided (DEC-010, R-49). If learners will mostly be elsewhere, or a jurisdiction needs data kept in a particular place, choose the region before creating anything. Changing a Supabase project's region later means creating a new project and moving the data.

## 2. Two options and the recommendation

| | **A. Free-tier private staging (recommended now)** | **B. Paid tiers (before any public use)** |
|---|---|---|
| Supabase | Free: 500 MB database, 50,000 monthly active users, 5 GB egress, 2 active projects. **Paused after 1 week of inactivity. No automatic backups.** | Pro: from **$25/month**, with $10 compute credit covering one Micro instance. Daily backups kept 7 days. Never paused. Spend cap on by default |
| Vercel | Hobby: **$0**, but **"for personal, non-commercial use"**. 1M function invocations, 100 GB data transfer, 4 h active CPU per month. Can't buy more usage. No password protection for previews | Pro: **$20 per developer seat per month**, including $20 usage credit and 1 TB data transfer. Password protection is $20/project/month extra. Default on-demand budget $200, which can be lowered, with optional auto-pause at 100% |
| Email | Resend Free: 3,000/month, **100/day**, 3 domains | Resend Pro: $20/month for 50,000 emails |
| Google OAuth | Free. With only `openid email profile` scopes, the 100-test-user cap and unverified-app warning don't apply | Same |
| **Monthly estimate** | **$0** | **Low: $45** (Supabase Pro plus 1 Vercel seat, Resend Free). **Moderate: $65** (plus Resend Pro). Optional point-in-time recovery adds $100/month per 7 days of retention |

**Recommendation:** use Option A for a private staging run of a few weeks with the owner and a handful of invited testers, then decide on B before any public launch.

Two caveats the owner must accept or reject:
1. **Vercel Hobby's non-commercial terms.** A private, unpaid playtest is arguably non-commercial, but if Code Dungeon is a commercial venture, use Vercel Pro ($20/month) from the start. This is the owner's call; the plan doesn't assume it.
2. **Supabase Free has no backups and pauses after a week of inactivity.** That's acceptable for staging data that can be lost, and not acceptable for real learners' progress.

**What is variable:**
- Supabase Pro bills compute hourly, plus overage above the included quota (MAU beyond 100,000 at $0.00325 each, disk beyond 8 GB at $0.125/GB, egress beyond 250 GB at $0.09/GB). Staging stays far below all of these.
- Vercel Pro charges usage beyond the $20 credit.

**Alerts vs hard caps:**
- Supabase's Pro spend cap is a hard cap on overage while it stays on. Keep it on.
- Vercel's on-demand budget sends alerts by default and becomes a hard stop only if "pause projects" is enabled. Set the budget to $10 and enable the pause.
- The Free and Hobby tiers can't incur charges.

## 3. Secrets and configuration

Set every value in the Vercel project's environment settings (Production and Preview), **never in the repository, chat or logs**. The names come from `.env.example`.

| Variable | Value source | Secret? | Notes |
|---|---|---|---|
| `AUTH_MODE` | `supabase` | no | |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project settings › API | no (public) | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase › API keys › publishable | no (public by design) | Starts `sb_publishable_` |
| `SUPABASE_SECRET_KEY` | Supabase › API keys › secret | **yes, server only** | Used only for account deletion (DEC-015). Never use a `NEXT_PUBLIC_` name for it: the app refuses to start. Owner holds it. Rotate it if exposed |
| `APP_URL` | the Vercel staging URL | no | Must be https (`config:check` enforces this) |
| `DATABASE_URL` | Supabase › Connect › **shared pooler, transaction mode** (port 6543) | **yes** | Must include `?sslmode=require`. Its password is the database password |
| `DATABASE_PREPARE` | `false` | no | Required behind the transaction pooler, which doesn't support prepared statements |
| `DATABASE_POOL_MAX` | `1` | no | One connection per serverless instance (Supabase's guidance for serverless) |
| `CONTENT_RELEASE` | `development` for private staging; `public` for any public release | no | 0 of 25 levels are human-reviewed (DEC-011), so `public` would serve no levels yet |
| `DEV_AUTH_SECRET` | **not set** | — | The development sign-in is refused in production builds |

Before every deployment, run `npm run config:check` with the deployment's variables. It reports problems by name only, never values, and exits 1 on any error.

## 4. Database setup

1. **Connections:**
   - Vercel functions use IPv4, and Supabase's direct connection is IPv6-only unless you buy the IPv4 add-on. So the app uses the **shared pooler in transaction mode (port 6543)**.
   - Every query the app runs is inside a transaction (`scoped()` in `src/services/postgres-player-store.ts`). So `SET LOCAL ROLE` and `set_config(..., true)`, which only last for one transaction, behave correctly through that pooler.
   - The DB test suite passes with `DATABASE_PREPARE=false` locally (63/63). That proves the driver setting, not the pooler itself.
2. **Migrations (0001–0005):**
   - Run them from the laptop over the **shared pooler in session mode (port 5432)**, as the project's `postgres` user: `DATABASE_URL=<session-pooler URL>?sslmode=require npm run db:migrate`, then `npm run db:status`.
   - Migrations run once each, in their own transaction, behind an advisory lock. Re-running is a no-op.
3. **R-44 check: must pass before the app is pointed at the project.** Supabase's `postgres` role is not a superuser. Run these as that role and record the results:

   ```sql
   SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('postgres', 'code_dungeon_app');
   BEGIN; SET LOCAL ROLE code_dungeon_app; SELECT current_user; ROLLBACK;  -- must print code_dungeon_app
   SELECT has_function_privilege('code_dungeon_app', 'leaderboard_page(text, integer, integer)', 'EXECUTE');
   ```

   - If `SET LOCAL ROLE` is refused, the connecting role is missing membership of `code_dungeon_app`. PostgreSQL 16+ doesn't give a role's creator the right to `SET` to it unless that is granted explicitly. The fix is an additive migration granting membership with `SET` to the connecting role. Write and test it then, against the real version, rather than guessing now.
   - Also run `tests/db` locally against PostgreSQL of the **same major version** as the Supabase project.
4. **Backups:** Free has none, and Pro keeps daily backups for 7 days. Before moving staging data anywhere important, take a `pg_dump` over the session pooler.

## 5. Sign-in configuration

| Where | Setting |
|---|---|
| Google Cloud › OAuth consent screen | External. App name "Code Dungeon (staging)". Scopes `openid`, `email` and `profile` only. Support email: the owner's |
| Google Cloud › Credentials › OAuth client (Web) | **Authorised redirect URI:** `https://<ref>.supabase.co/auth/v1/callback`. Google returns to Supabase, not to the app |
| Supabase › Auth › Providers › Google | The client ID and client secret from Google. The client secret is a secret; the owner pastes it here only |
| Supabase › Auth › URL configuration | Site URL = `APP_URL`. Redirect allow-list = `APP_URL/auth/callback` (and `APP_URL/auth/confirm` if a template links there) |
| Supabase › Auth › Email | Custom SMTP (Resend). The built-in sender allows **2 emails/hour, only to project team members**, and is not for production. Custom SMTP starts at 30/hour in Supabase; raise it on the Rate Limits page if needed |
| Supabase › Auth › Email templates (magic link) | Either keep the default `{{ .ConfirmationURL }}` (PKCE flow, lands on `/auth/callback`) or link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/play`. Both routes exist and are tested against the mock |
| Supabase › Auth | Require confirmed email (Code Dungeon already refuses unverified users) |

## 6. Verification after setup (records go in a new report)

1. Run `npm run config:check` with the deployment variables: no errors.
2. Run `npm run smoke -- https://<staging-url>`. It is read-only and needs no credentials, and must pass all 15 checks. Against the local production build in Supabase mode it passed 15/15 on 18 October 2026.
3. Do the real-provider journeys by hand: the same ones as `e2e/supabase-auth.spec.ts`.
   - Google sign-in and onboarding.
   - An unverified email is refused.
   - Magic link with a hostile `next`.
   - Sign-out.
   - Account deletion, which removes both the game rows and the Supabase user.

   Record the results. Until then, R-47 and R-51 stay open.
4. Run the R-44 queries (§4.3).

## 7. Data and privacy

- **Code Dungeon tables store:**
  - handle, leaderboard visibility, auth provider and subject
  - the age-check policy id and time (no birth date)
  - learning progress, XP ledger and totals
  - submissions (answers and feedback)
  - game state
  - rate-limit counters (identity buckets hold only a hash)
- **No email address** is stored in Code Dungeon's tables. Supabase Auth keeps the email in its own `auth.users`.
- **Deletion:** players delete their own accounts in Profile. One transaction removes all game rows and the Supabase user (DEC-015). Rate-limit rows age out within a day.
- **Open before public use:** launch jurisdictions and the age and consent rules (DEC-010, R-49); a privacy notice and terms; and whether the answer-key checklist moves to a private repository (R-53).

## 8. Rollback and cleanup

| Resource | How to remove | What is lost or costs |
|---|---|---|
| Vercel project | Project › Settings › Delete | The deployments; no data. $0 on Hobby; a Pro seat is billed until removed |
| Supabase project | Project settings › Delete project (irreversible) | **All staging data and auth users.** Pause instead to keep the data (Free only) |
| Google OAuth client | Google Cloud › Credentials › delete client (or delete the project) | Google sign-in stops |
| Resend | Revoke the API key; remove the domain | Emails stop |
| App rollback | Vercel › Deployments › promote the previous deployment | Migrations are additive, so an older build runs on a newer schema |

Deleting anything that holds data needs the owner's explicit approval (`CLAUDE.md`).

## 9. Sources (read 18 October 2026)

- Supabase pricing: https://supabase.com/pricing
- Supabase connecting to Postgres (poolers, IPv4, prepared statements, serverless): https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase custom SMTP and built-in sender limits: https://supabase.com/docs/guides/auth/auth-smtp
- Vercel pricing (Hobby terms, Pro, spend management): https://vercel.com/pricing
- Resend pricing: https://resend.com/pricing
- Google OAuth testing status, user cap and basic-scope exception: https://support.google.com/cloud/answer/15549945

## 10. Owner checklist

1. Choose **Option A** (free, private staging) or **B** (paid), and confirm the Vercel Hobby non-commercial point.
2. Confirm the **region**, or name the launch jurisdictions first (DEC-010).
3. **Create the accounts yourself:** Supabase organisation, Vercel account, Google Cloud project, Resend account and a sending domain you control. Claude must not create accounts or handle passwords.
4. Paste the secrets (`SUPABASE_SECRET_KEY`, `DATABASE_URL`, Google client secret, SMTP key) **only into the provider dashboards**, never into chat or the repository.
5. On paid plans, set spending limits: Supabase spend cap on; Vercel budget $10 with pause.
6. Approve the staging verification run (§6), and say who the testers are (at most a few people while content is unreviewed).
7. Still pending, separately: human content review (DEC-011) and DEC-014 (leaderboard opt-in).
