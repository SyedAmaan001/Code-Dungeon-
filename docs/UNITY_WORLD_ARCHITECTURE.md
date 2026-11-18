# Code Dungeon — Unity world client architecture (proposal)

- **Status:** PROPOSED, 18 November 2026. Not approved and not built. It records the target architecture so the first vertical slice (`docs/UNITY_INTEGRATION_PLAN.md`) can be reviewed against it.
- **Inputs:** `docs/API_CONTRACTS.md` (server actions, no REST API), `src/csp.ts`, `src/app/play/data.ts`, `docs/decision.md`, CLAUDE.md, and the research in `docs/OPEN_SOURCE_REUSE_AUDIT.md`.
- **Unchanged:** the backend, the database, game rules, curriculum and the current pages.

## 1. One rule

**The Next.js backend stays the only authority.** Unity is a *presentation client* of state it receives. It never decides or writes:

- XP
- unlocks
- mastery
- quest or achievement state
- encounter outcomes
- leaderboard data
- player identity

It holds no credentials of any kind: no Supabase keys, no database URL, no service-role key, no access token.

## 2. Responsibilities

| Backend (existing, authoritative) | Unity world client (new) | Next.js shell (existing, extended) |
|---|---|---|
| Auth (Supabase), player identity | 3D world: terrain, architecture, props | Authenticated page that hosts the Unity canvas |
| Curriculum, challenges, answer evaluation | Third-person movement, collision | Projects the server-side `PlayerGameView` into a minimal, answer-free `WorldSnapshot` |
| XP, mastery, progression, unlocks | Cinemachine cameras and cinematic blends | Bridges Unity events to existing navigation and server actions |
| Quests, achievements, encounters, checkpoints | Lighting, fog, materials, VFX, audio | Shows the learning surfaces (challenge UI) as DOM, as today |
| Leaderboard | Spatial presentation of level status (sealed or open gates, lit braziers) | Loading, fallback and accessibility (2D map stays available) |
| Persistence (PostgreSQL, RLS, `scoped()`) | Local-only settings (camera sensitivity, audio volume) | CSP and security headers |

## 3. Data flow

```
Browser
 └─ Next.js page /play/world  (server component: requirePlayer() → loadPlayerView())
     │   projects PlayerGameView → WorldSnapshot (ids, statuses, zone keys only)
     ▼
   <WorldClient> (client component, react-unity-webgl)
     │  sendMessage("WorldBridge", "ApplySnapshot", json)        ──►  Unity (WebGL)
     │  ◄── dispatchReactUnityEvent("RequestEnterLevel", levelId)      presentation only
     ▼
   router.push(`/play/level/${levelId}`)  ── existing server-side lock check (game.levelRoom)
     │
   existing server actions: submitAnswer / revealHint  (unchanged, session-derived player)
     ▼
   existing learning/game services → PostgreSQL
```

- **Reads:** the server component already loads `PlayerGameView` per request (`src/app/play/data.ts`). The shell sends Unity a *projection*: level ids, numbers, zone keys, `status` (`locked | available | in_progress | completed`), `mastered`, `resumeLevelId` and `lastCheckpoint`.
  - **No answer keys, explanations, hints or other players' data ever go to Unity.** The projection is a whitelist function with tests, like `src/learning/projection.ts`.
- **Writes:** Unity only *requests* things. In the slice the only request is "the player activated the gate for level X". The shell turns that into ordinary navigation, and the server still checks the lock (`level_locked` rejection). If Unity were tampered with to request a locked level, the server refuses it exactly as it does for a hand-typed URL.
- **After progress changes** (the player answers in the DOM challenge UI), the shell re-renders with `router.refresh()` and sends Unity a fresh snapshot. Unity re-presents it and never computes it.

**Why no new HTTP API for the slice:** in the browser, the Unity WebGL build runs inside our own page, on our own origin and with our own session cookie. A JavaScript bridge (§4) is enough, and it reuses the existing session checks, rate limits and Zod validation without a second code path (`docs/API_CONTRACTS.md` §1).

## 4. The bridge contract (draft v0)

**Unity → shell events** (jslib → `dispatchReactUnityEvent`), validated with a strict Zod schema in the shell like any other untrusted input:

| Event | Payload | Shell behaviour |
|---|---|---|
| `WorldReady` | `{ bridgeVersion: 0 }` | Send the first snapshot; refuse a mismatched version |
| `RequestEnterLevel` | `{ levelId: string }` | If the snapshot says `locked`, show a message in the DOM; otherwise navigate. The server enforces the rule |
| `InteractionShown` | `{ id: string }` | Optional, cosmetic; for analytics later (none now) |
| `WorldError` | `{ code: string }` | Show the fallback: the existing 2D map |

**Shell → Unity messages** (`sendMessage("WorldBridge", method, json)`):

| Method | Payload |
|---|---|
| `ApplySnapshot` | `WorldSnapshot v0`: `{ bridgeVersion, resumeLevelId, lastCheckpoint, levels: [{ id, number, zoneKey, status, mastered }] }` |
| `SetReducedMotion` | `{ reduced: boolean }` (from `prefers-reduced-motion` and the user setting) |

Both sides treat unknown fields as errors, and versions are explicit. The C# side deserialises with `JsonUtility` into fixed classes. No reflection-based deserialisation of shell input.

## 5. Later: non-browser clients (deferred)

A standalone Windows build, or a Unity client outside our origin, cannot use the cookie session or the JS bridge. If that is approved later:

- Add **thin route handlers** under `src/app/api/world/v1/…` that call the **same** services (`getRuntime().game.getView`, `levelRoom`, `learning` submission) with the same Zod schemas.
- Authenticate with a short-lived Supabase access token sent as `Authorization: Bearer`, verified server-side (`supabase.auth.getUser(token)`). The client gets it through Supabase's PKCE flow in the system browser. Never a service key.
- Apply the same rate limits (`src/services/postgres-rate-limit.ts`) and the same `submissionId` idempotency.
- Add tests for cross-user isolation on every handler.

This is **not** part of the slice. `docs/API_CONTRACTS.md` must be updated when it is built.

## 6. Unity project structure (proposed)

```
unity/CodeDungeon/                 Unity 6.3 LTS, URP; its own .gitignore (Library/, Temp/, Logs/, UserSettings/, Build*/)
  Assets/CodeDungeon/
    Runtime/
      Bridge/       WorldBridge.cs, WorldSnapshot.cs, WebBridge.jslib  (the only code that talks to the host)
      Presentation/ GateView.cs, LevelMarkerView.cs  (read snapshot → visual state)
      Player/       ThirdPersonMotor.cs, PlayerInputReader.cs
      Camera/       Cinemachine rigs, CinematicDirector.cs
      Interaction/  Interactable.cs, InteractionPrompt.cs
      Data/         ScriptableObjects mapping levelId → scene anchors (presentation data only)
    Scenes/         OvergrownGate.unity, Boot.unity
    Art/            project-made or licence-recorded assets only (see docs/ASSETS.md)
    Tests/          EditMode (snapshot parsing, view-state mapping), PlayMode (movement, interaction)
  Packages/manifest.json           pinned: URP, Input System, Cinemachine 3, (LitMotion via git tag)
  THIRD_PARTY_NOTICES.md
```

- Assembly definitions keep `Bridge` independent of `Presentation`, so presentation can be tested without a browser.
- Mapping from level ids to places in the world is **presentation data** (ScriptableObjects). It is not curriculum and holds no rules.
- **Build output** (`Build/*.wasm`, `*.data`, `*.framework.js`, `*.loader.js`) is **not committed** to git. It goes to `public/unity/<slice>/` at deploy time, or to object storage later (a cost decision, see `docs/GAMEDEV_NEXT_STEPS.md`).
- Large binary art uses **Git LFS** once it exists. GitHub's free LFS quota is limited; check usage before adding large assets.

## 7. Web platform constraints (must hold for the design)

| Constraint | Consequence |
|---|---|
| CSP: `script-src 'self' 'nonce-…' 'strict-dynamic'`, no `wasm-unsafe-eval` (`src/csp.ts`) | The `/play/world` route needs `'wasm-unsafe-eval'` added to its CSP **only for that route**. It is a reviewed security change with a test in `tests/` and `e2e/`. The Unity loader script is inserted by a nonce-trusted script, so `'strict-dynamic'` admits it |
| Build size and load time | Target ≤ 30 MB compressed for the slice; Brotli build with correct `Content-Encoding` headers; a loading screen in DOM; the 2D map stays the fallback |
| Browser GPU budget | URP with baked lighting, height fog, light probes and limited real-time shadows. No HDRP, no volumetric ray marching in the slice |
| Mobile browsers | Not a target for the 3D world in the slice. Detect it and default to the 2D map |
| Accessibility | All learning content and challenges stay DOM (screen reader, keyboard). Unity is optional scenery: a "skip the world" route always works |
| Reduced motion | No camera shake or fast cuts when reduced motion is set |

## 8. Security checklist for any Unity change

- [ ] No secret, key, token or connection string in Unity code, ScriptableObjects or the build. `rea audit-release-exposure` on every build (`docs/REVERSE_ENGINEERING_METHOD.md`).
- [ ] The snapshot projection is a whitelist with a unit test that fails if a new `PlayerGameView` field leaks.
- [ ] Bridge input is validated in the shell with strict Zod schemas.
- [ ] Server lock checks are untouched; a tampered `RequestEnterLevel` is refused (e2e test).
- [ ] The CSP change applies only to `/play/world`, with a test.
- [ ] Third-party packages are pinned and recorded in `docs/OPEN_SOURCE_REUSE_AUDIT.md` and `THIRD_PARTY_NOTICES.md`.
