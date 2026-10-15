# Authentication integration design

- **Status:** DESIGN ONLY (Phase 4). No identity provider is configured, no credentials exist, nothing external has been created. Choosing and configuring a provider needs owner approval (open items O-5, O-8, and the provider itself; decision DEC-008).
- **Date:** 15 October 2026

## 1. What already exists (and is tested)

| Piece | Where | What it guarantees |
|---|---|---|
| Player records with an identity link | `players.auth_provider`, `players.auth_subject` (unique pair) | One player per provider identity; a sign-in can never be linked to two players |
| Identity → player lookup | `player_id_for_identity(provider, subject)` (`SECURITY DEFINER`, returns only the id) and `PostgresPlayerAccounts.playerIdForIdentity` | The server can resolve a verified identity without being able to list players |
| Per-player isolation | Row-level security on every player table; each transaction runs as `code_dungeon_app` with `app.player_id` | A request can only read or change the rows of the player id the server set |
| Server-side player id | `LearningService`, `GameService`, `PostgresPlayerStore` take the player id as a function argument, never from a request body | A client cannot choose whose data it touches |

**The one missing piece is the session:** something must turn an incoming HTTP request into a verified player id. Until a provider is approved, no HTTP route exposes the services (risk R-36).

## 2. Target request flow

```text
browser ── HTTPS + session cookie (HttpOnly, Secure, SameSite=Lax) ──► Next.js route / server action
   │
   ▼
SessionResolver.resolve(request)          ← provider SDK verifies the session/JWT server-side
   │  { provider, subject } or null (→ 401)
   ▼
accounts.playerIdForIdentity(provider, subject)
   │  playerId, or none → onboarding (choose a handle → accounts.create({ handle, identity }))
   ▼
GameService.submit(playerId, body)        ← body is validated strictly; it never carries the id
   │
   ▼
PostgresPlayerStore: BEGIN; SET LOCAL ROLE code_dungeon_app; set_config('app.player_id', playerId)
```

Interface to implement once a provider is approved (not yet in code, to avoid an unused placeholder):

```ts
interface VerifiedIdentity { provider: string; subject: string; emailVerified?: boolean }
interface SessionResolver {
  /** Verify the request's session with the provider; never trust unverified claims. */
  resolve(request: Request): Promise<VerifiedIdentity | null>;
}
```

## 3. Provider options (for the owner's decision)

| Option | How it fits | Trade-offs |
|---|---|---|
| **Supabase Auth** (managed; architecture default R-002) | Email/password, magic link and OAuth. Its user id becomes `auth_subject`; the database can stay ours or move to Supabase Postgres | Vendor dependency; free tier pauses inactive projects (R-19); production email needs a custom SMTP sender |
| **Auth.js / Better Auth** (open-source library on our own Postgres) | Sessions and accounts in our database, OAuth providers configurable | More code we own (session tables, CSRF, rotation); still managed password hashing; no extra vendor |
| **Clerk / Auth0 / similar** (managed identity) | Hosted UI, MFA, user management | Paid tiers at scale; second vendor alongside the database host |

**Recommendation:** Supabase Auth with **GitHub/Google OAuth plus email magic link**, no passwords at launch (less credential risk, no password-reset flow). The final choice is the owner's (O-5), as are the minimum learner age and consent requirements (O-8), which may rule some sign-in methods in or out.

## 4. Security requirements for the integration

- Verify sessions server-side on every request (provider SDK or JWT signature + issuer + audience + expiry). Never read a user id from a cookie or body without verification.
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, short-lived access token with rotation; CSRF protection for state-changing requests that rely on cookies.
- The database connection string stays server-only. Only a provider's publishable key may reach the browser.
- Rate-limit sign-in and submission endpoints (provider limits plus a per-player limit).
- Handles come from the player during onboarding and are validated (`validateHandle`); email addresses are never used as handles or shown on the leaderboard.
- Account deletion uses `PostgresPlayerAccounts.delete` (cascades to all game and learning data) and must also delete the identity at the provider.
- Tests to add with the integration: signed-out requests get 401; a forged or expired session is rejected; two signed-in accounts cannot reach each other's data through the routes (in addition to the existing database-level isolation tests).

## 5. What needs approval before implementation

1. The provider (and its cost plan if not free) — then credentials are added through the environment's secret settings, never committed.
2. Sign-in methods (O-5) and minimum learner age / consent rules (O-8).
3. A transactional email sender, if email sign-in is chosen.
4. The hosting target for the app and database (P-002), which determines where secrets live.
