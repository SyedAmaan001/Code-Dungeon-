# Code Dungeon — Unity integration plan and first vertical slice

- **Status:** DEC-023 approved by the owner on 19 November 2026. Implementation has not started; U0 verification gates still apply.
- **Architecture:** `docs/UNITY_WORLD_ARCHITECTURE.md`. **Reuse choices:** `docs/OPEN_SOURCE_REUSE_AUDIT.md`. **Backlog:** `docs/GAMEDEV_NEXT_STEPS.md`.

## 1. Goal of the slice: prove the technology, set a visual baseline

**THE OVERGROWN GATE.** It is one small scene, playable in a desktop browser inside the signed-in Code Dungeon shell, and it ends in the real Level 1 room.

| Requirement | How it is met | Verified by |
|---|---|---|
| One navigable medieval settlement | About 120 × 120 m blockout: 4–6 ruined houses, a well, a low wall, built with ProBuilder then replaced by project-made meshes | PlayMode test: player reaches 3 waypoints; screenshot |
| A visible stone road | A spline-placed road mesh leading from spawn to the gate (Unity Splines package) | Visual review |
| Ruined architecture | Broken arches and columns from a modular kit of 6–10 project-made pieces | Visual review; triangle budget |
| A monumental entrance gate | A gate prefab with two door leaves, an arch and a sigil; states `Sealed` / `Open` / `Opened` driven by the snapshot | EditMode test: snapshot → gate state |
| A distant citadel or academy | Low-poly silhouette at 300–600 m, with fog doing the work | Visual review |
| Environmental lighting | URP, one baked directional "late afternoon" light, light probes, reflection probe, one warm brazier | Profiler: frame time on the reference laptop |
| Atmospheric fog | URP exponential fog, a height-fog layer (Shader Graph) and drifting fog-card particles | Visual review; no ray marching |
| Third-person movement | Own `ThirdPersonMotor` on `CharacterController` with the Input System (keyboard/mouse and gamepad) | PlayMode tests: walk, stop, slope, step, cannot leave the play area |
| A working camera | Cinemachine 3 orbital follow with collision deoccluder; a second "gate reveal" camera | PlayMode test: the camera never clips inside the wall colliders on a scripted path |
| Basic object interaction | `Interactable` + prompt ("E: Examine"); 3 examine points with short lore lines (original text) | PlayMode test: prompt appears within range, not outside |
| One Level 1 entrance event | Interact with the gate → cinematic blend, doors open (presentation) → bridge `RequestEnterLevel("level 1 id")` → shell navigates to `/play/level/<id>`; the server checks the lock | Vitest for the bridge schema; Playwright e2e: sign in, open `/play/world`, trigger the event via a test hook, land in the Level 1 room |

**Out of scope:**
- combat
- NPC AI
- multiplayer
- inventory or economy
- procedural generation
- any other level or zone
- a standalone desktop build
- new backend endpoints
- changes to XP, quests, achievements or curriculum

## 2. Phases (each one reversible, reviewed and committed separately)

| Phase | Output | Gate before the next phase |
|---|---|---|
| **U0 Toolchain on the laptop** | Skills, REA and Unity CLI installed; Unity 6.3 LTS + WebGL module; Editor-control checks (`docs/GAMEDEV_TOOLCHAIN.md` §4–5) | The 8 connector checks pass and are recorded |
| **U1 Empty project** | `unity/CodeDungeon/` from the URP template, `.gitignore`, pinned `manifest.json`, assembly definitions, an empty `Boot` and `OvergrownGate` scene, EditMode/PlayMode test runners | `unity` batch-mode compile and tests pass; WebGL build of the empty scene loads in Chromium |
| **U2 Movement and camera (grey box)** | Motor, input, Cinemachine rig, grey-box settlement and gate | PlayMode tests green; owner plays the grey box |
| **U3 Bridge and shell page** | `WorldBridge` (C#, jslib), `WorldSnapshot` projection (TS, whitelisted, unit-tested), `/play/world` page with react-unity-webgl, route-scoped CSP change, 2D fallback | `npm run check` green; new tests for projection, bridge schema and CSP; e2e entrance event |
| **U4 Look development** | Lighting, fog, materials, modular ruins, gate sigil, distant citadel, one reference screenshot set | **The owner reviews the visual baseline.** Nothing about the palette or style is final before this |
| **U5 Hardening** | Build size, Brotli, loading screen, reduced motion, `rea audit-release-exposure` on the WebGL build, a performance note | Report `docs/UNITY_SLICE_REPORT.md` with exact outputs |

## 3. Changes to the existing app (U3 only; listed so they can be reviewed)

| File | Change | Risk control |
|---|---|---|
| `src/app/play/world/page.tsx` (new) | Server component: `requirePlayer()`, `loadPlayerView()`, `toWorldSnapshot()` | Same guard as the other play pages |
| `src/world/snapshot.ts` (new) | Whitelist projection `PlayerGameView → WorldSnapshot` | Unit test asserts the exact key set |
| `src/ui/world/world-client.tsx` (new) | `"use client"`; react-unity-webgl; Zod-validated events; `router.push` / `router.refresh` | Tests for event validation |
| `src/csp.ts` and `src/proxy.ts` | Add `'wasm-unsafe-eval'` to `script-src` for `/play/world` only | Unit test for both routes; e2e asserts the header |
| `package.json` | Add `react-unity-webgl` pinned exactly | `npm audit --omit=dev`; recorded in the audit and `docs/ASSETS.md` |
| `docs/API_CONTRACTS.md` | New section: the world bridge (v0) | — |

No change to `src/domain`, `src/learning`, `src/services`, `db/` or `content/`.

## 4. Testing strategy

- **Unity:** EditMode tests (snapshot parsing, gate-state mapping, level-to-anchor data validity) and PlayMode tests (movement, camera clipping, interaction ranges, entrance event raises the bridge call) run through the Unity CLI in batch mode. Unity CI in GitHub Actions needs a Unity licence secret (GameCI). That is an **owner decision**, so until then tests run on the laptop and the outputs are pasted into the report.
- **Web:** the existing gates (`npm run check`) plus new Vitest and Playwright tests. In CI, e2e uses a tiny stub page or loader that emits the same bridge events, so CI does not need a Unity build. A real WebGL build is verified on the laptop.
- **Regression:** the full existing suite must stay green (the cloud baseline on 18 November 2026 was lint, typecheck and format clean; Vitest 255 passed / 67 skipped without PostgreSQL; content 0 errors).

## 5. Art and asset rules for the slice

- Use only meshes, textures and audio made for Code Dungeon, or free assets whose licence file has been read and recorded in `docs/ASSETS.md` before import.
- Nothing from the reference images, commercial games or the Asset Store is used unless its licence allows it.
- No copied characters, logos, story or lore. The gate lore lines are original and are reviewed like content.
- Palette and biome colours stay **provisional** until the owner reviews U4 (`docs/UNITY_REFERENCE_BOARD.md`).

## 6. Cost

- **$0 is expected for the slice:** Unity Personal (the owner checks eligibility and the current terms), free packages, the owner's laptop.
- **Possible future costs, each needing approval first:** Git LFS storage or bandwidth beyond the free quota, Unity CI licence or GameCI runner minutes, hosting large WebGL builds (object storage or CDN), and any paid asset.
