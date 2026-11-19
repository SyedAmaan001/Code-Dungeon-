# Code Dungeon — T-04 local Unity project scaffold prompt

**Run this prompt in local Claude Code on the owner's Mac**, with access to the local filesystem and Unity CLI. Do not run it in the GitHub-connected cloud workspace.

DEC-023 was approved on 19 November 2026. T-01 and T-02 are reported complete, and T-03's eight Editor checks were reported passing by the local Mac Claude session. The full evidence and the unsaved-`Untitled` scene qualification are in `docs/MAC_U0_RUNBOOK.md`.

---

## Mission

Complete **T-04 only**: create the empty, tested Unity 6.3 LTS URP project at:

`unity/CodeDungeon/`

inside the existing Code Dungeon feature branch. Do not start T-05/T-06 (movement/camera), look-development, or Next.js integration.

## 1. Repository and branch safety

Repository: `https://github.com/SyedAmaan001/Code-Dungeon-.git`

Required branch: `claude/tender-cerf-ooekni`. Never work on, commit to, or merge into `main`. Never force-push.

1. Run `pwd`, inspect the current directory, and identify whether it is already the root of a local checkout of this repository.
2. If it is the correct checkout, run:
   ```bash
   git status --short --branch
   git remote -v
   git fetch origin
   git branch --show-current
   git log -5 --oneline
   ```
3. If no checkout exists, create one at `~/Projects/Code-Dungeon`:
   ```bash
   mkdir -p ~/Projects
   git clone --branch claude/tender-cerf-ooekni https://github.com/SyedAmaan001/Code-Dungeon-.git ~/Projects/Code-Dungeon
   ```
   Then verify the branch and remote tip. If the current Claude session cannot access that new directory through its permitted file tools, stop and ask the owner to reopen Claude Code from `~/Projects/Code-Dungeon`; do not create files outside the session's approved workspace.
4. If the checkout has uncommitted changes, inspect and preserve them. Do not reset, clean, stash, overwrite or discard them. If the branch is not `claude/tender-cerf-ooekni`, stop and explain; do not switch branches silently.
5. Confirm `unity/CodeDungeon/` does not already exist. If it exists, inspect it and stop before overwriting anything.

Read these files before implementation:
- `CLAUDE.md`
- `docs/decision.md` (DEC-023)
- `docs/UNITY_WORLD_ARCHITECTURE.md`
- `docs/UNITY_INTEGRATION_PLAN.md`
- `docs/OPEN_SOURCE_REUSE_AUDIT.md`
- `docs/ASSETS.md`
- `docs/GAMEDEV_TOOLCHAIN.md` §7 and remote-session record
- `docs/MAC_U0_RUNBOOK.md` T-03 results

## 2. Verify the local Unity environment

Run and record:

```bash
node -v
claude --version
unity --version
unity editors --installed --long
unity doctor
```

Expected owner-Mac baseline: macOS 26.6 arm64, Node 26.13.0, Claude Code 2.1.311, Unity CLI 1.0.1, Editor 6000.3.28f1 arm64, Web Build Support installed.

T-03 created a disposable project at `~/UnityScratch/ConnectorTest`. Its Editor may still be running. Before creating the real project:
- Check which Editor/project is currently open.
- If it is still ConnectorTest, close it normally. If Unity asks to save its unsaved `Untitled` scene, choose **Don't Save** (the report says `isDirty=False`).
- Do not terminate unknown processes or close any unrelated project.
- Keep the disposable project as evidence until the real project is scaffolded; cleanup can be offered afterwards, not done automatically.

The T-03 report says the Pipeline package install succeeded on retry and `com.unity.pipeline` 1.0.0 is in the disposable project's manifest. The optional Cinemachine setup step failed; Cinemachine was not installed there. Do not treat that as a T-03 failure.

## 3. Create the Unity project

Use Unity's official `unity-cli` / `new-unity-project` skills if available. Check the actual CLI 1.0.1 command syntax with `--help` before running it.

Target:
- Project name: `CodeDungeon`
- Project path: `<repo-root>/unity/CodeDungeon`
- Editor: `6000.3.28f1`
- Template: URP blank, expected id `com.unity.template.urp-blank`
- No Unity Cloud project or organization link.

The T-03 run found that CLI 1.0.1 uses `--output-dir` (not `--path`) for `unity projects create`. Confirm with help, then create in the repository's `unity` directory. Ensure the resulting directory is exactly `unity/CodeDungeon` and not a nested `unity/CodeDungeon/CodeDungeon`.

If the CLI's automatic Pipeline install step fails, retry `unity pipeline install --project-path <project>` once and inspect logs. Require `com.unity.pipeline` to be in the project's manifest and Editor command group to be available before declaring success.

## 4. Project structure and pinned packages

Preserve the URP template files and its required render-pipeline configuration.

Create:
- A nested Unity `.gitignore` excluding `Library/`, `Temp/`, `Logs/`, `UserSettings/`, `Build/`, `Builds/`, `obj/`, `MemoryCaptures/`, crash reports and generated IDE files. Do not overwrite the repository root `.gitignore`.
- A nested `.gitattributes` containing Git LFS patterns for likely future large binary source assets (for example PSD, FBX, BLEND, WAV, MP4 and high-resolution texture sources). Do not LFS-track Unity YAML scenes, prefabs, C# scripts, JSON, asmdefs or metadata. Do not add binary assets now. Git LFS is not installed on the Mac according to `unity doctor`; do not install it or attempt `git lfs track` without owner approval.
- `Packages/manifest.json` with exact, pinned compatible versions for:
  - URP (retain the exact version generated by the Unity 6.3.28f1 URP template; T-03 reported URP 17.3.0),
  - Input System,
  - Cinemachine 3.x,
  - Unity Test Framework,
  - Unity Pipeline package 1.0.0.
- Do not guess package versions. Inspect the template manifest, package metadata/cache, Unity 6.3 compatibility and official package documentation. Pin exact versions, not `*`, ranges or `latest`. Preserve required template dependencies. Record each package's version and licence in `THIRD_PARTY_NOTICES.md` and reconcile the licence audit with `docs/OPEN_SOURCE_REUSE_AUDIT.md`.
- Cinemachine setup failed only in the earlier disposable project's optional CLI step. Add Cinemachine through Package Manager/manifest using a verified compatible 3.x release; if resolution fails, diagnose it and stop rather than silently omitting it or substituting Cinemachine 2.

Create this assembly layout under `Assets/CodeDungeon/Runtime/`:
- `Bridge/CodeDungeon.Runtime.Bridge.asmdef`
- `Presentation/CodeDungeon.Runtime.Presentation.asmdef`
- `Player/CodeDungeon.Runtime.Player.asmdef`
- `Camera/CodeDungeon.Runtime.Camera.asmdef`
- `Interaction/CodeDungeon.Runtime.Interaction.asmdef`
- `Data/CodeDungeon.Runtime.Data.asmdef`

Keep the Bridge assembly independent of Presentation and world/gameplay assemblies. Keep dependencies acyclic and minimal. Add explicit package assembly references only where required, based on the installed packages' actual asmdefs.

Create test assemblies:
- `Assets/CodeDungeon/Tests/EditMode/CodeDungeon.Tests.EditMode.asmdef`
- `Assets/CodeDungeon/Tests/PlayMode/CodeDungeon.Tests.PlayMode.asmdef`

Add exactly one small EditMode smoke test for the scaffold (for example, assert that both scene assets exist and are loadable). PlayMode test assembly may initially contain no tests, but it must compile and be discoverable. Use the Test Framework's correct Editor references and platform settings.

Create and save two actual Unity scenes through Editor APIs or the official Unity skill:
- `Assets/CodeDungeon/Scenes/Boot.unity`
- `Assets/CodeDungeon/Scenes/OvergrownGate.unity`

They should be empty scenes at this milestone; do not add player movement, camera rigs, architecture, fog, art, interactions or gameplay. Add the scenes to the active build scene list in Boot-then-OvergrownGate order. Explicitly open/read back both saved scene paths; do not repeat T-03's unsaved-`Untitled` ambiguity.

Add `THIRD_PARTY_NOTICES.md` in the Unity project. Read the actual package licence/notice files; do not label Unity Companion License packages as MIT/open source.

## 5. Verification gates

Run on the owner's Mac and report the exact commands and results:

1. Unity Editor opens the correct project and reaches `ready`.
2. `unity pipeline` / `unity command` can see the project's Pipeline connection.
3. Both saved scenes exist and can be opened by their exact asset paths; confirm they appear in the build scene list in the intended order.
4. Package resolution succeeds; no missing package, assembly or compile errors.
5. Unity batch-mode project compile succeeds.
6. EditMode smoke test passes; test results XML is saved outside tracked source or under an ignored test-results directory.
7. PlayMode test runner discovers the PlayMode assembly (no gameplay tests required at T-04).
8. Build an empty WebGL player using the installed Web Build Support. Use a temporary/ignored output directory, not a committed build directory.
9. Check whether a Chromium-based browser is already installed. Serve the build over localhost and verify it loads in Chromium if available. Do not install browsers, use paid services, deploy, or upload build artifacts without approval. If Chromium is unavailable, report that specific gate as not verified; do not claim a browser load test.
10. Check WebGL console/log output for errors and record build size for the empty scaffold.

Do not commit:
- `Library/`, `Temp/`, `Logs/`, `UserSettings/`, build output, test output, caches, editor user settings, machine-specific paths or secrets.
- No answer keys, credentials, tokens or database values belong in Unity.

## 6. Scope guardrails

This is T-04 (U1) only.

Do NOT:
- Implement T-05/T-06 character movement, input behaviour, Cinemachine camera rig or greybox settlement.
- Implement the JS bridge, `/play/world`, React wrapper or CSP changes (U3).
- Modify Next.js source, server actions, database migrations, curriculum, XP, quests, achievements, encounters or leaderboard.
- Add external services, Unity Cloud projects, CI licence secrets or paid assets.
- Import art, audio, characters or protected content from references.
- Change branches, touch `main`, force-push or rewrite history.

## 7. Review, commit and report

Before any commit:
- Inspect `git status` and the full diff.
- Confirm all changed paths are limited to `unity/CodeDungeon/` and the explicitly updated game-dev docs.
- Check for secrets, machine-specific absolute paths and generated binaries.
- Run Unity compile and EditMode tests again after the final edits.
- Do not commit unless all applicable checks pass. If tests fail, keep the work uncommitted and report the failure.
- Commit only on `claude/tender-cerf-ooekni`; push only that branch. Never merge to `main`.

Update:
- `docs/GAMEDEV_TOOLCHAIN.md` with actual T-04 Mac results.
- `docs/GAMEDEV_NEXT_STEPS.md` marking T-04 only when gates pass.
- `docs/UNITY_SLICE_REPORT.md` with scaffold contents, package versions/licences, compile/test/build/browser results, limitations and exact command outputs.

Final report must clearly separate PASS / FAIL / NOT RUN for every gate. State which environment ran each command. Do not claim remote CI or cloud-session results as local Mac results.

**Stop after T-04. Wait for the owner to inspect/approve the empty project before starting T-05/T-06.**
