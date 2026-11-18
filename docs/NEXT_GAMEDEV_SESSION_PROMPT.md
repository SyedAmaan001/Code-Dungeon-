# Prompt for the next game-development Claude Code session

Paste everything below the line into **local Claude Code on the owner's Windows laptop**. Run it after the owner has done the actions marked *owner* in step 0.

---

# CODE DUNGEON: GAME-DEV PHASE U0–U2 (TOOLCHAIN ON THE LAPTOP, THEN THE OVERGROWN GATE GREY BOX)

You are the Unity technical director and engineer for **Code Dungeon**, an existing, working learning game (Next.js 16 + TypeScript + PostgreSQL + Supabase Auth; 25 Python Fundamentals levels; XP, quests, achievements, leaderboard). **Do not start a new app, rebuild the backend, or redo the research.** The research and tooling work was done on 18 November 2026 in a cloud session. Its results are in the repository.

## 1. Where things are

| | |
|---|---|
| Repository | https://github.com/SyedAmaan001/Code-Dungeon-.git |
| Branch | `claude/tender-cerf-ooekni`. Never commit to or merge into `main`; never force-push |
| Laptop worktree | `C:\Users\syeda\Desktop\PROJECTS\CODE DUNGEON V1\.claude\worktrees\code-dungeon-recovery-b0a626` (verify it exists; `git fetch && git status -sb && git log -5 --oneline`) |
| Unity project (to create) | `unity/CodeDungeon/` inside the repository. Nothing exists yet |

## 2. Read first

1. `CLAUDE.md`: binding rules.
2. `docs/GAMEDEV_TOOLCHAIN.md`: what was installed and verified, and how. **§2.2 (the `unity` plugin name clash) and §5 (laptop steps)** matter most.
3. `docs/UNITY_WORLD_ARCHITECTURE.md`: the backend stays authoritative; Unity is presentation only; the JS bridge v0; the CSP constraint.
4. `docs/UNITY_INTEGRATION_PLAN.md`: the Overgrown Gate slice, phases U0–U5.
5. `docs/OPEN_SOURCE_REUSE_AUDIT.md`: licences (Cinemachine, URP and Input System are UCL; LitMotion, Yarn Spinner, ink and UniTask are MIT; react-unity-webgl is Apache-2.0; PrimeTween and NavMeshComponents are rejected; Chop Chop is study-only).
6. `docs/GAMEDEV_NEXT_STEPS.md`: the backlog T-01…T-17 and the owner decisions O-G1…O-G6.
7. `docs/decision.md` DEC-023 (PENDING unless the owner approved it in chat) and `docs/risk-register.md` R-62–R-67.

## 3. State at handoff (18 November 2026)

- **Skills (cloud container only, ephemeral):** gamedev-skills `router`, `disciplines`, `genres`, `workflows` and `unity` installed at commit `c6ca6c41c839` (release 2.0.0, Apache-2.0). The router was verified: it detected Unity 6.3 in a fake project and picked `unity-csharp-scripting`, `camera-systems`, `level-design` and `rpg`.
  - **Clash:** the gamedev `unity` plugin shadows Unity's official `unity` plugin (0.1.9-beta, synced from claude.ai, 33 skills including `unity-cli`).
  - On the laptop, install the gamedev Unity skills as standalone skills, not as the `unity` plugin.
- **REA:** `rea-agents` 6.9.0 (MIT) was set up in the cloud with `rea setup --client claude_code` after a reviewed `--dry-run`. MCP showed Connected and doctor was healthy. No native providers (no Hopper/Ghidra/IDA). Investigation 001 (our own `.next/static`) found no answer keys or secrets. **On the laptop REA needs Node ≥ 24.22.1**, but nvm had 24.20.0.
- **Unity:** not installed in the cloud. The laptop's Unity state and any Unity MCP connection are **unknown and unverified**. Recommended: **Unity 6.3 LTS (6000.3.x)**, URP, WebGL module, Editor control through the **Unity CLI + `com.unity.pipeline`** (Unity's own skill prefers this to MCP). Avoid 6000.5.0–6000.5.2. Fallback MCPs: CoplayDev unity-mcp (MIT; set `DISABLE_TELEMETRY=true`) or IvanMurzak Unity-MCP (Apache-2.0).
- **Backend baseline (cloud, no PostgreSQL):** lint, typecheck and format clean; Vitest 25 files passed / 9 skipped, 255 tests passed / 67 skipped; content 0 errors (1 existing warning); `next build` OK. On the laptop with the DB, expect 34 files / 322 tests (`docs/ANTIGRAVITY_PROMPT.md` §4).

## 4. Your task, in order (stop at each gate)

**Step 0: owner actions (check them, don't do them for the owner).**
- Node ≥ 24.22.1.
- Unity Hub + Unity 6.3 LTS with WebGL Build Support, with the owner signed in and the licence chosen.
- Unity CLI installed by the owner (`irm https://unity.com/install.ps1 | iex`).
- DEC-023 approved in chat.

If anything is missing, give exact click-by-click instructions and wait.

**Step 1 (T-01).** Install the skills without the clash and set up REA, exactly as in `docs/GAMEDEV_TOOLCHAIN.md` §5. Review `rea setup --dry-run` before applying it. Record versions.

**Step 2 (T-02).** Run `unity --version`, `unity editors` and `unity projects` (read-only). List any existing Unity projects and **do not modify any**. Ask the owner about their purpose.

**Step 3 (T-03).** Create a throwaway project **outside the repository** (for example `%USERPROFILE%\UnityScratch\ConnectorTest`), install the Pipeline package, open it, and verify through `unity command`:
1. scene names
2. hierarchy
3. GameObject components
4. project settings
5. Console errors
6. create `CD_ConnectorTest`
7. delete it
8. read back that it is gone

Paste the outputs into `docs/GAMEDEV_TOOLCHAIN.md` §4. If the CLI route fails, try a fallback MCP only after the owner approves it.

**Step 4: first implementation task (T-04), only if DEC-023 is approved.** Create `unity/CodeDungeon/`:
- from Unity 6.3 LTS with the URP template, through the official `new-unity-project` / `unity-cli` skills
- Unity `.gitignore` (Library, Temp, Logs, UserSettings, Build*)
- `.gitattributes` with LFS patterns (do not commit binaries yet)
- pinned `Packages/manifest.json`: URP, Input System, Cinemachine 3, Test Framework
- asmdefs `CodeDungeon.Runtime.{Bridge,Presentation,Player,Camera,Interaction,Data}` plus EditMode and PlayMode test assemblies
- scenes `Boot` and `OvergrownGate` (empty)
- one EditMode smoke test
- `THIRD_PARTY_NOTICES.md`

Verify a batch-mode compile and test run, and that an empty WebGL build loads in Chromium. Do not commit build output.

**Then T-05/T-06** (movement and camera grey box) per `docs/UNITY_INTEGRATION_PLAN.md`, with PlayMode tests.

## 5. Rules

- Backend, database, curriculum, XP, quests, achievements, encounters and the leaderboard are **unchanged**. Unity never writes progress and holds **no secrets or tokens**.
- No new HTTP endpoints for the slice; the bridge is the JS route in the architecture doc.
- No purchases, paid assets, commercial tools (Hopper), new accounts, deployments or cloud resources without explicit approval.
- Only original or licence-recorded assets. Record each one in `docs/ASSETS.md`. Never copy art, story or characters from references.
- REA only on owned, OSS or written-permission targets (`docs/REVERSE_ENGINEERING_METHOD.md`).
- Before each commit, run the existing web gates if web files changed (`npm run lint`, `format:check`, `typecheck`, `npm test` with the DB, `content:validate`, `build`), plus Unity batch tests if Unity files changed. Review the diff for secrets.
- Report exact command output. Never claim that a connector, build or test works without running it.
- Before stopping, update `docs/GAMEDEV_TOOLCHAIN.md`, `docs/GAMEDEV_NEXT_STEPS.md` and this file.
