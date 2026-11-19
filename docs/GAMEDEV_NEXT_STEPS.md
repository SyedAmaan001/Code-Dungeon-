# Code Dungeon — game-development next steps and backlog

- **Status:** updated 19 November 2026 after DEC-023 approval and Mac U0 toolchain, project-inventory and Editor-control reports. Read with `docs/GAMEDEV_TOOLCHAIN.md`, `docs/OPEN_SOURCE_REUSE_AUDIT.md`, `docs/UNITY_WORLD_ARCHITECTURE.md` and `docs/UNITY_INTEGRATION_PLAN.md`.
- **Separate track:** the hosted-staging work (Phase 7, `docs/ANTIGRAVITY_PROMPT.md`) is a different track and is untouched by this work.

## 1. Waiting on the owner (blocking)

| # | Decision or action | Why it blocks | Recommendation |
|---|---|---|---|
| O-G1 | Approve **DEC-023** (Unity world client, WebGL inside the Next.js shell, backend authoritative) | Phases U1–U5 | **APPROVED 2026-11-19**; revisit standalone builds later |
| O-G2 | Complete Mac toolchain/editor verification (`docs/MAC_U0_RUNBOOK.md` Steps 1–3): gamedev skills without the `unity` clash, REA, Unity project inventory and Pipeline connector checks | U0 | Node 26.13.0, Unity CLI 1.0.1, Unity 6.3 LTS + Web Build Support, and Unity sign-in are already verified (19 Nov 2026) |
| O-G3 | Pick how the gamedev `unity` skills coexist with Unity's official `unity` plugin | Name clash | Standalone skills through `npx skills add` (Mac runbook Step 1) |
| O-G4 | Allow Unity tests in GitHub Actions (needs a Unity licence secret, GameCI) or keep Unity tests local | CI coverage | Local first; decide after U2 |
| O-G5 | After U4, review the visual baseline (palette, materials, lighting) | Art scaling | — |
| O-G6 | Licence file of Unity Starter Assets (if we want to adapt its controller) | Movement option B | Not required: build our own motor (default) |

## 2. Prioritised implementation backlog

| Pri | ID | Task | Phase | Depends on | Done when |
|---|---|---|---|---|---|
| P0 | T-01 | Repeat the toolchain setup on the Mac (`docs/MAC_U0_RUNBOOK.md` Step 1; **DONE 2026-11-19**, see toolchain §7); record versions in `docs/GAMEDEV_TOOLCHAIN.md` | U0 | O-G2, O-G3 | `claude plugin list` has no clash warning; `claude mcp get rea` Connected; `unity --version` |
| P0 | T-02 | Inventory Unity on the Mac (runbook Step 2; **DONE 2026-11-19**: no existing projects) (`unity editors`, Hub projects); confirm no existing project would be affected | U0 | T-01 | Documented list; owner confirms the purpose of any existing project |
| P0 | T-03 | Editor-control verification in disposable `~/UnityScratch/ConnectorTest`; 8 checks reported PASS on Mac (19 Nov 2026), with unsaved `Untitled` scene-path qualification documented in `docs/MAC_U0_RUNBOOK.md` | U0 | T-01, T-02 | 8/8 checks reported PASS; Pipeline 1.0.0 installed; Editor ready; T-04 must verify explicitly opening saved scenes |
| P0 | T-04 | In a **local Mac checkout** of the branch, create `unity/CodeDungeon/` (URP template, Unity 6.3 LTS), `.gitignore`, `.gitattributes` (LFS patterns), pinned `manifest.json`, asmdefs, test runners | U1 | DEC-023, T-03 | Batch-mode compile and EditMode test pass; empty WebGL build loads in Chromium |
| P0 | T-05 | `ThirdPersonMotor` + `PlayerInputReader` (Input System) + grey-box ground and colliders | U2 | T-04 | PlayMode tests: walk, stop, slope, step, bounds |
| P0 | T-06 | Cinemachine 3 follow rig with deoccluder; gate-reveal camera | U2 | T-05 | Clipping PlayMode test; owner plays the grey box |
| P1 | T-07 | `Interactable` + prompt; 3 examine points; gate prefab with state machine | U2 | T-05 | PlayMode interaction tests; EditMode gate-state tests |
| P1 | T-08 | `WorldSnapshot` projection (`src/world/snapshot.ts`) with a whitelist test | U3 | DEC-023 | Vitest: exact key set; no answer or explanation fields |
| P1 | T-09 | `WorldBridge` C#, jslib, v0 schema; Zod schemas in the shell | U3 | T-07, T-08 | Unit tests on both sides; unknown fields rejected |
| P1 | T-10 | `/play/world` page with react-unity-webgl (pinned), loading screen, 2D fallback, route-scoped CSP `'wasm-unsafe-eval'` | U3 | T-09 | `npm run check` green; CSP tests for both routes; `npm audit --omit=dev` |
| P1 | T-11 | E2E: sign in → `/play/world` → simulated `RequestEnterLevel(level 1)` → Level 1 room; tampered locked id refused | U3 | T-10 | Playwright green (stub loader in CI, real build on the laptop) |
| P2 | T-12 | Look development: lighting, fog layers, modular ruins, gate sigil, distant citadel | U4 | T-06 | Reference screenshots; owner review (O-G5) |
| P2 | T-13 | Web build hardening: Brotli and headers, size ≤ 30 MB compressed, reduced motion, profiler note | U5 | T-12 | Numbers in `docs/UNITY_SLICE_REPORT.md` |
| P2 | T-14 | `release:audit` script: REA (when installed) + marker search over `.next/static` and the Unity build dir | U5 | — | Fails on a planted marker in a test fixture |
| P2 | T-15 | Reverse-engineering report 002 (our WebGL build, IL2CPP metadata if present) | U5 | T-13, T-14 | Report in `docs/reverse-engineering/` |
| P3 | T-16 | Decide the dialogue tool (Yarn Spinner vs ink) when narrative work starts | later | — | DEC record |
| P3 | T-17 | Standalone-client API (`/api/world/v1`, bearer tokens) only if a desktop build is approved | later | approval | See `docs/UNITY_WORLD_ARCHITECTURE.md` §5 |

## 3. Risks (added to `docs/risk-register.md` as R-62 to R-67)

- WebGL performance and build size on typical laptops (R-62).
- CSP relaxation (`wasm-unsafe-eval`) widening the attack surface (R-63).
- Licence drift or misreading for Unity packages and assets (R-64).
- The plugin name clash hiding Unity's official skills (R-65).
- Ephemeral cloud tooling mistaken for laptop setup (R-66).
- Git LFS or build-hosting costs once art arrives (R-67).

## 4. Cost outlook

Everything planned up to U5 is **$0** on the owner's laptop. Costs that would need approval first: Git LFS beyond the free quota, a Unity CI licence or runner minutes, CDN or object storage for WebGL builds, and any paid asset or tool (for example Hopper or a commercial Unity asset).
