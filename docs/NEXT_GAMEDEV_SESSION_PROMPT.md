# Prompt for the next game-development Claude Code session

Use this in the **Claude Code session connected to the GitHub repository**. Repository edits can be made in that connected workspace; do not ask the owner to clone merely for documentation/source edits. The owner's Unity Editor and Unity CLI are installed locally on macOS, so any Unity Editor/Pipeline checks must run in a local Mac environment that can access the project files. A remote GitHub-connected session must not claim to have run those local checks.

---

# CODE DUNGEON: GAME-DEV PHASE U0–U2 (MAC TOOLCHAIN, THEN THE OVERGROWN GATE GREY BOX)

You are the Unity technical director and engineer for **Code Dungeon**, an existing, working learning game (Next.js 16 + TypeScript + PostgreSQL + Supabase Auth; 25 Python Fundamentals levels; XP, quests, achievements, leaderboard). **Do not start a new app, rebuild the backend, or redo the research.** The research and tooling work was done on 18 November 2026 in a cloud session. Its results are in the repository.

## 1. Where things are

| | |
|---|---|
| Repository | https://github.com/SyedAmaan001/Code-Dungeon-.git |
| Branch | `claude/tender-cerf-ooekni`. Never commit to or merge into `main`; never force-push |
| Local Mac checkout | **Not currently present.** The repo is connected to Claude remotely. No clone is needed for remote docs/source edits; a local feature-branch checkout will be needed before Unity Editor work can be written/tested in the repository. |
| Unity project (to create) | `unity/CodeDungeon/` inside the repository. Nothing exists yet |

## 2. Read first

1. `CLAUDE.md`: binding rules.
2. `docs/GAMEDEV_TOOLCHAIN.md`: what was installed and verified, and how. **§2.2 (the `unity` plugin name clash) and §5 (laptop steps)** matter most.
3. `docs/UNITY_WORLD_ARCHITECTURE.md`: the backend stays authoritative; Unity is presentation only; the JS bridge v0; the CSP constraint.
4. `docs/UNITY_INTEGRATION_PLAN.md`: the Overgrown Gate slice, phases U0–U5.
5. `docs/OPEN_SOURCE_REUSE_AUDIT.md`: licences (Cinemachine, URP and Input System are UCL; LitMotion, Yarn Spinner, ink and UniTask are MIT; react-unity-webgl is Apache-2.0; PrimeTween and NavMeshComponents are rejected; Chop Chop is study-only).
6. `docs/GAMEDEV_NEXT_STEPS.md`: the backlog T-01…T-17 and the owner decisions O-G1…O-G6.
7. `docs/decision.md` DEC-023 (approved by the owner on 19 November 2026) and `docs/risk-register.md` R-62–R-67.

## 3. State at handoff (updated 19 November 2026)

- **Skills (cloud container only, ephemeral):** gamedev-skills `router`, `disciplines`, `genres`, `workflows` and `unity` installed at commit `c6ca6c41c839` (release 2.0.0, Apache-2.0). The router was verified: it detected Unity 6.3 in a fake project and picked `unity-csharp-scripting`, `camera-systems`, `level-design` and `rpg`.
  - **Clash:** the gamedev `unity` plugin shadows Unity's official `unity` plugin (0.1.9-beta, synced from claude.ai, 33 skills including `unity-cli`).
  - On the laptop, install the gamedev Unity skills as standalone skills, not as the `unity` plugin.
- **REA:** `rea-agents` 6.9.0 (MIT) was set up in the cloud with `rea setup --client claude_code` after a reviewed `--dry-run`. MCP showed Connected and doctor was healthy. No native providers (no Hopper/Ghidra/IDA). Investigation 001 (our own `.next/static`) found no answer keys or secrets. **On the laptop REA needs Node ≥ 24.22.1**, but nvm had 24.20.0.
- **Owner's Mac Unity environment (verified 19 Nov):** macOS 26.6 arm64; Unity CLI 1.0.1; Unity 6.3 LTS Editor 6000.3.28f1 arm64; Web Build Support installed; Unity account signed in. `unity doctor`, `unity auth status`, and `unity editors --installed` were run by the owner. **Unity Pipeline is not yet verified in a project.** The cloud-connected Claude workspace has not been shown to have access to this Mac Editor/filesystem.
- **Backend baseline (cloud, no PostgreSQL):** lint, typecheck and format clean; Vitest 25 files passed / 9 skipped, 255 tests passed / 67 skipped; content 0 errors (1 existing warning); `next build` OK. On the laptop with the DB, expect 34 files / 322 tests (`docs/ANTIGRAVITY_PROMPT.md` §4).

## 4. Your task, in order (stop at each gate)

**Step 0: owner actions (check them, don't do them for the owner).**
- Node 26.13.0 is already installed (meets REA requirement).
- Unity CLI 1.0.1 is already installed and on PATH.
- Unity 6.3 LTS Editor 6000.3.28f1 (arm64) and Web Build Support are installed.
- Owner is signed in to Unity.
- DEC-023 was explicitly approved in chat on 19 November 2026.
- Still pending on the Mac: REA setup, gamedev skill setup/verification, existing Unity project inventory (T-02), and Pipeline/editor-control checks (T-03).

If anything is missing, give exact click-by-click instructions and wait.

**Step 1 (T-01).** Install the skills without the clash and set up REA, exactly as in `docs/GAMEDEV_TOOLCHAIN.md` §5. Review `rea setup --dry-run` before applying it. Record versions.

**Step 2 (T-02).** On the owner's Mac, run `unity --version`, `unity editors --installed`, and inspect `unity projects --help` before using the read-only project-list command supported by CLI 1.0.1. List existing Unity projects and **do not modify any**. Do not infer that the remote Claude workspace can see the Mac's registered projects.

**Step 3 (T-03).** On the Mac, create a throwaway project **outside the repository** (for example `~/UnityScratch/ConnectorTest`; use `unity projects create --help` to verify CLI 1.0.1 syntax and use `--no-cloud` so no Unity Cloud project is created), open it in Unity 6.3, install the Pipeline package with `unity pipeline install`, and verify through `unity command`:
1. scene names
2. hierarchy
3. GameObject components
4. project settings
5. Console errors
6. create `CD_ConnectorTest`
7. delete it
8. read back that it is gone

Paste the outputs into `docs/GAMEDEV_TOOLCHAIN.md` §4. If the CLI route fails, try a fallback MCP only after the owner approves it.

**Step 4: first implementation task (T-04), DEC-023 is approved.** Before creating `unity/CodeDungeon/`, ensure the approved feature branch is checked out in a local Mac directory accessible to Unity. If this session is the remote GitHub-connected workspace and cannot access the Mac filesystem, stop and report that boundary; do not claim the local project/build exists. Once the local branch checkout is available, create `unity/CodeDungeon/`:
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
- Before stopping, update `docs/GAMEDEV_TOOLCHAIN.md`, `docs/GAMEDEV_NEXT_STEPS.md` and this file. Keep remote repository checks distinct from owner-Mac Editor checks, and report the exact environment used for every command.
