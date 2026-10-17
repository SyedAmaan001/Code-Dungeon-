# Code Dungeon — backend contracts for the interface

- **Status:** describes the code at `claude/tender-cerf-ooekni` as of 17 October 2026 (written during the local backend session, `docs/LOCAL_BACKEND_HANDOFF.md`). Every shape below is quoted from source; if they disagree, the source wins and this file is stale.
- **Purpose:** the interface is going to be redesigned separately. This is what any new interface can rely on, independent of the current pages and art direction.

## 1. Transport: server actions and server components, no REST API

There are **no JSON/REST endpoints**. The only route handlers are the Supabase auth return URLs (§8). Everything else goes through:

- **Server components (reads).** Pages under `src/app/play/**` call `requirePlayer()` and then the services through `getRuntime()` (`src/services/runtime.ts`). A redesigned interface should keep doing this. To serve a separate client (mobile, 3D client) later, add thin route handlers that call the **same** service methods with the **same** session check. Don't add a second code path.
- **Server actions (writes).** These are in `src/app/actions/*.ts`. Each action resolves the player from the verified session itself. The browser never sends a player id, XP, score, unlocks or awards.

Shared rules:

| Rule | Where |
|---|---|
| Identity always comes from the session: `requirePlayer()` for pages, which redirects; `playerForAction()` for actions, which returns `null` and becomes `signed_out` | `src/auth/server.ts` |
| Every player-data query runs inside `scoped()`: `SET LOCAL ROLE code_dungeon_app` and `app.player_id`, with row-level security on all player tables | `src/services/postgres-player-store.ts` |
| A request body is `unknown` until a strict Zod schema accepts it. Unknown keys are rejected | `src/services/learning-service.ts`, `src/learning/evaluation/evaluators.ts` |
| Answer keys never leave the server. Pages receive `PublicLevel` (projection) and `explanation` only after a correct answer | `src/learning/projection.ts`, `LevelResult` |
| Answers and hints are rate-limited at 60 per minute per process, then 40 per minute per player, shared through PostgreSQL | `src/services/runtime.ts`, `src/services/postgres-rate-limit.ts` |
| Account writes (onboarding, profile, deletion) are rate-limited at 20 per 10 minutes per process, then 10 per 10 minutes per action, shared through PostgreSQL (migration 0005, DEC-021) | `src/app/actions/account.ts`, `src/services/postgres-rate-limit.ts` |

## 2. Session and player profile

| Call | Kind | Returns |
|---|---|---|
| `getSession()` | server, memoised per request | `signed_out` / `email_unverified` / `needs_onboarding {provider, subject}` / `player {player: AccountProfile}` |
| `requirePlayer()` | page guard | `AccountProfile`, or redirects to `/sign-in`, `/sign-in?error=unverified` or `/onboarding` |
| `AccountProfile` | type | `{ playerId, handle, visible }` (`visible` = shown on the leaderboard) (`src/services/postgres-player-store.ts`) |

**Actions** (`src/app/actions/account.ts`, all `useActionState` form actions):

| Action | Input (FormData) | Result |
|---|---|---|
| `completeOnboarding` | `handle`, `birthYear`, `birthMonth`, `visible=on` (optional) | Redirects to `/play`, or `{status:"error",message}` / `{status:"too_young"}`. Stores no age data, only `{policy, at}` of the check. Sets an `cd_age_gate` cookie for 24 hours after an under-13 answer |
| `updateProfile` | `handle`, `visible=on` (optional) | `{status:"saved"}` / `{status:"error",message}` |
| `deleteAccount` | `confirmHandle` (must equal the handle), `acknowledge=on` | Redirects to `/account-deleted`, or `{status:"error",message}`. One transaction deletes the player (cascading to every player table) and the Supabase user. If the provider refuses, nothing is deleted |

**Rate limits on these three actions (DEC-021):**
- The budget is 10 attempts per 10 minutes per action. The bucket is the session's player (`player:<id>:profile` / `player:<id>:delete`), or for onboarding the verified sign-in identity, hashed (`identity:<sha256>:onboarding`). Form fields never choose the bucket.
- Every attempt counts, including a mistyped deletion confirmation. Ten attempts leave room to correct typos.
- Over the limit, the result is `{status:"error", message:"Too many attempts in a short time. Nothing was changed; wait a few minutes."}` and nothing is written.
- If the limit can't be checked (for example, the database is unreachable), the result is `{status:"error", message:"That could not be done just now. Nothing was changed; try again later."}`. The action fails closed.
- A signed-out caller is redirected to `/sign-in` before any budget is charged.
| `setTheme` (`appearance.ts`) | `theme` | Display cookie only, with no database write |

## 3. Learning path and levels (reads)

| Service call | Returns |
|---|---|
| `game.getView(playerId)` (cached per request as `loadPlayerView`, `src/app/play/data.ts`) | `PlayerGameView`: `totalXp`, `maxXp` (2,455), `resumeLevelId`, `zones[]`, `levels[]` (each `LevelView` + `number,title,zone,kind,review`), `quests[]`, `achievements[]`, `encounters[]`, `checkpoints[]`, `lastCheckpoint`, `items[]`, `persistent` |
| `game.levelRoom(playerId, levelId)` | `LevelRoomResult`: `{status:"ok", level: PublicLevel, view: LevelView, xp:{earned,available}, challenges:{[id]:{attempts,correct,hints[],explanation?}}, encounter?: EncounterRoom}` or a `Rejection` (`unknown_level`, `level_locked`) |
| `learning.getPath(playerId)` | `PathView` (the learning-only subset of the above) |

`LevelView.status` is one of `locked | available | in_progress | completed`, plus `mastered: boolean`. Unlocks and mastery come from the domain (`src/domain/progression.ts`), never the interface.

## 4. Challenge submission (write)

`submitAnswer(input: unknown): Promise<SubmitView>` (`src/app/actions/game.ts`)

```ts
// input (strict):
{ submissionId: string /* 8–100 chars [A-Za-z0-9_-], client-generated idempotency key */,
  levelId: string, challengeId: string,
  answer: /* per format, strict: */
    | { selected: string[] }                 // multiple_choice
    | { output: string }                     // predict_output (≤ 2,000 chars)
    | { blanks: Record<string,string> }      // fill_blank
    | { values: Record<string,string> }      // trace
    | { order: string[] }                    // order_lines
    | { line: number; fix: string }          // find_fix_bug
}
// result:
| { status: "evaluated"; correct; duplicate; feedback: Feedback; xpAwarded; totalXp;
    levelStatus; mastered; notices: Notice[] }
| { status: "not_counted"; feedback }        // unreadable answer or engine error; no attempt counted
| { status: "rejected"; code: RejectionCode; message }
| { status: "signed_out" } | { status: "rate_limited" } | { status: "error" }
```

- **Idempotency:** resending a `submissionId` for the same challenge returns the original stored result with `duplicate: true` and no new XP, attempts or game events. The answer in the resend is not re-judged. Reusing an id for a *different* level or challenge gives `rejected / submission_id_reused`. Ids are scoped per player. Concurrent copies are processed exactly once (`tests/db/persistence.test.ts`). **The client must generate one id per answer and reuse it on retry.** The current interface does this on its Retry button.
- **Atomicity:** learning progress, the XP ledger and game state (encounters, quests, achievements, items) are saved in one transaction. `game.status === "conflict"` (a concurrent write) still returns the evaluated answer, with a `sync` notice.
- **`RejectionCode`:** `bad_request | unknown_level | unknown_challenge | level_locked | replay_disabled | no_more_hints | submission_id_reused | conflict`.
- **`Feedback`:** `{ tone: "correct"|"incorrect"|"invalid"|"error"; message; detail?; explanation? (correct only); counted }`.
- **`Notice`:** `{ kind, text, href? }`. `kind` is one of `xp, level_completed, level_mastered, level_unlocked, encounter_started, life_lost, encounter_defeated, encounter_won, checkpoint, quest_activated, objective_met, quest_completed, achievement, item, sync`. These are display strings derived from domain events (`src/services/presenter.ts`). A new interface may render its own text from `kind`, but must not invent events.

## 5. Hints (write)

`revealHint(input: unknown): Promise<HintView>`. The input is strict: `{ levelId, challengeId }`.

Result: `{status:"ok", revealed: string[], remaining: number, notices}`, `rejected` (`no_more_hints`, `level_locked`, …), `signed_out`, `rate_limited` or `error`. Hints are tiered and revealed in order. Each reveal is recorded. Under the domain policy (`src/domain/policy.ts`), a hint removes the first-try bonus and can stop that answer counting as mastery evidence. Hint requests are rate-limited but have no idempotency key: a resend reveals the next tier.

## 6. XP, mastery, encounters, checkpoints, quests, achievements, collection

All of these are read through `getView` / `levelRoom` and change only as a side effect of `submitAnswer` or `revealHint`. There are no direct write actions, by design.

| Concept | Read shape | Rules live in |
|---|---|---|
| XP | `totalXp`, per-level `xp.earned/available`; ledger rows in `xp_ledger` | `src/domain/policy.ts`, `src/domain/progression.ts` |
| Encounters (checkpoint / major / boss) | `encounters[]` and `EncounterRoom` (`status, runs, defeats, run, livesRemaining, maxLives, solvedThisRun, flawless`) | `src/domain/game/` (DEC-005/012: 3 lives for major and boss, checkpoints can't be lost, encounters don't gate unlocks) |
| Checkpoints | `checkpoints: string[]`, `lastCheckpoint` | `src/domain/game/` |
| Quests | `quests[]: {id, title, description, state: locked/active/completed, objectives[{id,title,optional,met,progress}], rewardItem?}` | content `quests` and `src/domain/game/` |
| Achievements | `achievements[]: {id, title, description, unlocked, unlockedAt?, progress, rewardItem?}` | content `achievements` |
| Collection | `items: string[]`; names and art via `itemInfo()` in `src/world/catalog.ts` | cosmetic only, no XP (DEC-012) |

## 7. Leaderboard

`game.leaderboard(viewerId, { limit })` returns `{ metric: "lifetime_xp", entries: [{rank, handle, xp, isViewer}], viewer: {ranked:true, rank, xp} | {ranked:false, reason: "hidden"|"no_xp"|"unknown"}, persistent }`.

- Only players who opted in (`leaderboard_visible`, off by default, DEC-014 proposed) and have XP ≥ `minXp` are ranked. Only the handle is exposed, never ids or emails.
- Ties share a rank when XP and the time it was reached are equal.
- Order: XP highest first, then the earliest time that total was reached, then handle (case-insensitive). Ranks are competition ranks ("1224") on (XP, reach time). `totalRanked` counts every ranked player.
- **Pagination:** top-N only. `limit` is clamped by the policy (default 10, maximum 100), and the page uses 50. There is no cursor or offset. When the viewer is ranked below the page, `viewer` still carries their exact rank.
- **Storage (migration 0004, DEC-020):** totals are kept in `player_path_xp`, maintained by a trigger in the same transaction as every XP award. `leaderboard_page(path, limit, minXp)` ranks in SQL and returns at most `limit` + 1 rows: the page plus the viewer. The viewer is taken from the session (`app.player_id`), never from a parameter, and no player ids are returned. `rankLeaderboard()` in `src/domain/game/leaderboard.ts` is still the reference implementation, and `tests/db/leaderboard.test.ts` keeps the two equal.

## 8. Authentication routes and actions

| Path / action | Mode | Behaviour |
|---|---|---|
| `signInWithGoogle` | supabase | OAuth with PKCE. `redirectTo` = `APP_URL/auth/callback?next=<sanitised>` |
| `sendMagicLink` | supabase | Email OTP link. The same answer is given whether or not the account exists |
| `devSignIn` | dev | Signed HMAC cookie. Refused in production builds |
| `signOut` | both | Supabase sign-out, clears the dev cookie, redirects to `/` |
| `GET /auth/callback?code&next` | supabase | `exchangeCodeForSession`, then redirects to `next` on `APP_URL`, or to `/sign-in?error=link` |
| `GET /auth/confirm?token_hash&type&next` | supabase | `verifyOtp` for `email`, `magiclink` and `signup` only |

`next` always passes through `safeNext()` (`src/auth/redirect.ts`): same-site paths only, no `//`, backslashes or control characters, at most 200 characters. Protected paths are `/play`, `/play/*` and `/onboarding`. The proxy redirects early, but the server-side guard is the real check.

## 9. Errors and status conventions

- Actions never throw to the browser. Unexpected failures are logged server-side (message only) and return `{status:"error"}`.
- Pages throw to `src/app/play/error.tsx`.
- `signed_out` from an action means the session expired: send the player to `/sign-in?next=<current path>`.
- `rate_limited` (answers and hints) means wait. Those limits are per minute. Account actions report their limit as an `error` message instead (§2).
