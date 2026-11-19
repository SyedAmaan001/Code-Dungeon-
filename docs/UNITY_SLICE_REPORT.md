# Code Dungeon — Unity slice report

- **Scope so far:** T-04 / phase U1 only — the empty, tested Unity project at `unity/CodeDungeon/`. Later phases (U2–U5) append their own sections.
- **Environment for every result below:** the owner's Mac (Darwin 25.6.0 arm64, macOS 26.6), local Claude Code 2.1.311 session, Node v26.13.0, Unity CLI 1.0.1, Unity Editor 6000.3.28f1 arm64 with Web Build Support. **Nothing here ran in a cloud session or CI.**
- **Date:** 19 November 2026.

## 1. T-04 gate summary

| # | Gate | Result | Evidence (§ below) |
|---|---|---|---|
| 1 | Editor opens the correct project and reaches `ready` | **PASS** | §3.1 |
| 2 | Pipeline connection visible to `unity command` | **PASS** | §3.1 |
| 3 | `Boot` and `OvergrownGate` saved, opened by exact path, in build order Boot → OvergrownGate | **PASS** | §3.2 |
| 4 | Package resolution; no missing package, assembly or compile errors | **PASS** | §3.3 |
| 5 | Batch-mode compile | **PASS** | §3.4 |
| 6 | EditMode smoke test, results XML outside the repo | **PASS** (1/1) | §3.5 |
| 7 | PlayMode runner discovers the PlayMode assembly | **PASS (qualified)** — compiles as a test assembly; PlayMode run completes with 0 tests | §3.5 |
| 8 | Empty WebGL build to a temporary directory | **PASS** | §3.6 |
| 9 | Served over localhost and loaded in a Chromium-based browser | **PASS** (headless Google Chrome 157, software GL) | §3.7 |
| 10 | WebGL console checked; build size recorded | **PASS with notes** — 0 JS exceptions; 3 URP shader-support log lines under SwiftShader | §3.7 |

## 2. What the scaffold contains

```
unity/CodeDungeon/
  .gitignore, .gitattributes (LFS patterns only; LFS not installed)
  THIRD_PARTY_NOTICES.md
  Packages/manifest.json, packages-lock.json
  ProjectSettings/ (URP template defaults; build scene list = Boot, OvergrownGate)
  Assets/
    CodeDungeon/
      Runtime/{Bridge,Presentation,Player,Camera,Interaction,Data}/CodeDungeon.Runtime.<X>.asmdef + AssemblyInfo.cs
      Tests/EditMode/CodeDungeon.Tests.EditMode.asmdef + ScaffoldSmokeTests.cs
      Tests/PlayMode/CodeDungeon.Tests.PlayMode.asmdef + AssemblyInfo.cs (no tests yet)
      Scenes/Boot.unity, OvergrownGate.unity (empty: 0 root objects)
    Settings/ (URP template: PC/Mobile RP assets, renderers, volume profiles)
    Settings/Build Profiles/WebGL.asset (Unity 6 build profile; uses the global scene list)
    Scenes/SampleScene.unity, TutorialInfo/, Readme.asset, InputSystem_Actions.inputactions (template files, kept)
```

- **Assemblies:** all six runtime assemblies have **no references** to each other or to packages. Nothing needs one yet, so the graph is trivially acyclic and `Bridge` is independent of `Presentation`. T-05/T-06 add `Unity.InputSystem` (Player) and `Unity.Cinemachine` (Camera) when code needs them. Each runtime assembly has `autoReferenced: false`. The `AssemblyInfo.cs` files only grant `InternalsVisibleTo` to the two test assemblies, so every assembly compiles to a real DLL.
- **Test assemblies:** `UnityEngine.TestRunner` + `UnityEditor.TestRunner`, `overrideReferences` with `nunit.framework.dll`, `defineConstraints: UNITY_INCLUDE_TESTS` (excluded from player builds). EditMode is `includePlatforms: [Editor]`; PlayMode is all platforms.
- **Smoke test:** `ScaffoldSmokeTests.BootAndOvergrownGateScenesExistAndAreFirstInBuildOrder` loads both `SceneAsset`s by exact path and asserts the enabled build list equals `[Boot, OvergrownGate]`.
- **Not built (by design):** no movement, input handling, camera rig, greybox, art, fog, interaction, bridge, jslib or Next.js changes.

### Packages (pinned exactly in `Packages/manifest.json`)

| Package | Version | Unity 6.3 status (Editor `PackageInfo.versions`) | Licence (file read) |
|---|---|---|---|
| `com.unity.render-pipelines.universal` | 17.3.0 | recommended = latestCompatible = 17.3.0 (template version, unchanged) | Unity Companion License |
| `com.unity.inputsystem` | 1.20.1 | recommended = latestCompatible = 1.20.1 | Unity Companion License |
| `com.unity.cinemachine` | 3.1.7 | recommended = latestCompatible = 3.1.7 | Unity Companion License (`LICENSE.md`) / Unity Companion Cinemachine Code License 1.0 (`license.txt`) |
| `com.unity.test-framework` | 1.6.0 | recommended = latestCompatible = 1.6.0 | Unity Companion License |
| `com.unity.pipeline` | 1.0.0 | latestCompatible = 1.0.0 | **Unity Terms of Service** (not UCL) |

The other template packages and all indirect dependencies, with licences, are in `unity/CodeDungeon/THIRD_PARTY_NOTICES.md`.

## 3. Exact commands and outputs

### 3.1 Environment, project creation, Editor

```text
$ node -v                         → v26.13.0
$ claude --version                → 2.1.311 (Claude Code)
$ unity --version                 → 1.0.1
$ unity editors --installed --long
6000.3.28f1  arm64  /Applications/Unity/Hub/Editor/6000.3.28f1/Unity.app  Web Build Support
$ unity doctor --format json      → checks: binary-on-path pass, path-duplicates pass, git-credential-helper pass,
                                    credential-store pass, credential-store-orphans pass, fex-emu info (skipped)
```

The T-03 ConnectorTest Editor (PID 11542, `ready`) was the only Editor running. It was closed with `unity close ~/UnityScratch/ConnectorTest --if-saved --timeout 60` → `closed true, method graceful`. The disposable project is kept on disk.

```text
$ unity templates --editor-version 6000.3.28f1 --type core --format json
  com.unity.template.urp-blank  "Universal 3D"  17.1.0   (first entry)
$ unity projects create CodeDungeon --output-dir <repo>/unity --editor-version 6000.3.28f1 \
    --template com.unity.template.urp-blank --no-cloud --non-interactive          → exit 0
  steps: template done, pipeline done, cinemachine done, runInBackground done, urpMaterials done,
         cloudLink skipped (NO_CLOUD), playerAuth/remoteConfig/cloudSave skipped (NO_CLOUD), vcs skipped (NOT_REQUESTED)
  diagnostics.cloud.linked false
```

Result: exactly `unity/CodeDungeon/` (not nested), no `.git` inside it. Unlike T-03, the CLI's Pipeline **and** Cinemachine steps both succeeded. It added `com.unity.cinemachine` 3.1.7 and `com.unity.pipeline` 1.0.0 to the manifest.

```text
$ unity open <repo>/unity/CodeDungeon
$ unity status --until-ready --project-path <repo>/unity/CodeDungeon --format json
  port 7800, state "ready", version 6000.3.28f1, pid 13609, project <repo>/unity/CodeDungeon
$ unity command console status → cursor 0; groundTruth compilationFailed false, consoleErrors 0, consoleWarnings 0
$ unity command --project-path …   → 38 command groups listed (asset, build, console, editor, package, scene, script, test, …)
```

### 3.2 Scenes

Created with `EditorSceneManager.NewScene(NewSceneSetup.EmptyScene)` and `SaveScene` through `unity command script eval --file`; then `EditorBuildSettings.scenes` was set to Boot, OvergrownGate:

```text
saved:Assets/CodeDungeon/Scenes/Boot.unity=True; saved:Assets/CodeDungeon/Scenes/OvergrownGate.unity=True;
```

Read back by opening each exact path (`EditorSceneManager.OpenScene(path, Single)`):

```text
opened path=Assets/CodeDungeon/Scenes/Boot.unity name=Boot valid=True loaded=True roots=0 dirty=False buildIndex=0
opened path=Assets/CodeDungeon/Scenes/OvergrownGate.unity name=OvergrownGate valid=True loaded=True roots=0 dirty=False buildIndex=1
active=Assets/CodeDungeon/Scenes/OvergrownGate.unity
build: Assets/CodeDungeon/Scenes/Boot.unity, Assets/CodeDungeon/Scenes/OvergrownGate.unity
```

`ProjectSettings/EditorBuildSettings.asset` lists the same two paths, both `enabled: 1`, in that order. This resolves the T-03 unsaved-`Untitled` qualification.

### 3.3 Package resolution and Editor compile

`Packages/packages-lock.json` after resolution: cinemachine 3.1.7 (registry), inputsystem 1.20.1 (registry), pipeline 1.0.0 (registry), render-pipelines.universal 17.3.0 (builtin), splines 2.9.1 (registry, Cinemachine dependency), test-framework 1.6.0 (builtin).

`Library/ScriptAssemblies` contains `CodeDungeon.Runtime.{Bridge,Camera,Data,Interaction,Player,Presentation}.dll` and `CodeDungeon.Tests.{EditMode,PlayMode}.dll`. The console showed 0 errors and 0 warnings; `console get --since 0 --level error` returned 0 entries.

### 3.4 Batch-mode compile (Editor closed first, gracefully, scene not dirty)

```text
$ unity run <project> --timeout 600 --log-file <scratch>/batch_compile.log --no-tail -- -nographics   → exit 0
  log: CompileScripts: 2677.714ms; "Exiting batchmode successfully now!"; 0 matches for "error CS|Compilation failed"
```

(The log's single `ExitCode: 4` line comes from `bee_backend` reporting an out-of-date build graph before it regenerates it and compiles. It is not a failure.)

### 3.5 Tests (reports in the session scratchpad, outside the repository)

```text
$ unity test <project> --mode EditMode --output <scratch>/reports/editmode.xml --timeout 600   → exit 0
  <test-run testcasecount="1" result="Passed" total="1" passed="1" failed="0" …>
  test-case CodeDungeon.Tests.EditMode.ScaffoldSmokeTests.BootAndOvergrownGateScenesExistAndAreFirstInBuildOrder result="Passed"

$ unity test <project> --mode PlayMode --output <scratch>/reports/playmode.xml --timeout 600   → exit 0
  <test-run testcasecount="0" result="Passed" total="0" …>  platform PlayMode
```

PlayMode discovery qualification: NUnit omits assemblies that have no tests, so the PlayMode tree (`TestRunnerApi.RetrieveTestList(PlayMode)`) shows only the root `CodeDungeon testCount=0`. The evidence that the assembly is discoverable:

- `CodeDungeon.Tests.PlayMode.dll` compiles;
- `CompilationPipeline` lists it among Editor assemblies and excludes it from `PlayerWithoutTestAssemblies`, so Unity classifies it as a test assembly;
- the PlayMode run completes without errors.

The first PlayMode test (T-05) will show up as a child of that assembly.

### 3.6 Empty WebGL build

`unity build --target WebGL` refused with exit 2: *"Target WebGL has no built-in command-line build. Pass --execute-method, or use a Unity 6+ build profile with --profile."* So a profile was created and used:

```text
$ unity build <project> --create-profile WebGL           → Assets/Settings/Build Profiles/WebGL.asset (m_OverrideGlobalSceneList: 0)
$ unity build <project> --profile WebGL --output <scratch>/webgl --allow-dirty-build --timeout 1800
  "Build Finished, Result: Success."  provenance: outcome success, exitCode 0, 09:03:54Z → 09:16:13Z (~12.3 min, first IL2CPP build)
  0 error lines in the build log
```

`--allow-dirty-build` was needed because the scaffold was not committed yet. The provenance file records `source.dirty: true` at base revision `504b617`.

**Size (empty scaffold, default settings, Brotli):**

| File | Bytes |
|---|---|
| `Build/webgl.wasm.br` | 9,575,054 |
| `Build/webgl.data.br` | 4,600,784 |
| `Build/webgl.framework.js.br` | 76,535 |
| `Build/webgl.loader.js` | 26,983 |
| **Build/ total** | **14,279,356 (≈13.6 MiB)** |
| Whole output dir incl. `TemplateData/` | ≈15 MB (`du -sh`) |

Unity's build report: "Complete build size 13.6 mb". The biggest single entry is the built-in Unity splash-screen logo texture at 2.7 MB (19.6%). Template/URP textures are 81.3% of user-asset usage. That is inside the ≤ 30 MB compressed slice target, but leaves little headroom for an "empty" project. T-13 should look at the splash screen, stripping and the unused template packages.

The perf-testing dependency's pre-build hook wrote `Assets/Resources/PerformanceTestRun*.json` during the build; the build removed them again (the folder no longer exists).

### 3.7 Browser load (Chromium-based)

- **Browser:** Google Chrome 157.0.8103.79 was already installed; nothing was installed.
- **Launch:** headless (`--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader`) with a throwaway `--user-data-dir` in the session scratchpad.
- **Server:** a 30-line Python `http.server` on `127.0.0.1:8765`. It sends `Content-Encoding: br` for `.br` files and `application/wasm` for wasm.
- **Driver:** a Node CDP script (browser-level session, `Target.attachToTarget` with `flatten`) watched the page.
- **Readiness signal:** the template hides `#unity-loading-bar` only inside `createUnityInstance(...).then(...)`.

The first attempt used a page-level CDP socket, which closed with code 1006 on navigation, so it was replaced.

```text
ready: true; title "Unity Web Player | CodeDungeon"; canvas 960x600; exceptions: []
every request 200: index.html, loader.js, framework.js.br, wasm.br, data.br, TemplateData/*
Unity log: "Initialize engine version: 6000.3.28f1", "Creating WebGL 2.0 context.", "Input System initialize..."
```

Console notes:

- **Three Unity log lines:** `ERROR: Shader Hidden/CoreSRP/CoreCopy`, `Hidden/Universal Render Pipeline/StencilDitherMaskSeed` and `Hidden/Universal/HDRDebugView` "is not supported on this GPU". They come from SwiftShader, Chrome's software WebGL in headless mode, and these are URP internal or debug shaders. They are **not verified on real GPU hardware**. Re-check in a headed browser on the reference laptop (T-13).
- **Warnings (expected):** AudioContext autoplay blocked without a user gesture; "GPU stall due to ReadPixels"; "Additional Lights Cookie Format (GrayscaleHigh) is not supported… falling back to RGBA8".
- **Screenshot:** a dark canvas with the template footer. The scenes are empty and have no camera, so this is expected.

## 4. Limitations and follow-ups

- The browser check used **headless Chrome with software rendering**, not a headed browser with a real GPU and not the Next.js shell. The `/play/world` integration, CSP and react-unity-webgl are U3.
- `Assets/TutorialInfo/Layout.wlt` (a template file, kept unmodified) contains the template author's path `/Users/danielbrauer/...`. It is Unity's content, not ours; remove `TutorialInfo/` later if wanted.
- The unused template packages (`ai.navigation`, `visualscripting`, `multiplayer.center`, `collab-proxy`, `timeline`) were kept, as T-04 asked to preserve the template. Pruning them is a T-13 build-size item.
- Git LFS is not installed. `.gitattributes` holds patterns only, and no binary art exists.
- Unity tests run only on the owner's Mac. CI is owner decision O-G4.
- Disposable `~/UnityScratch/ConnectorTest` is still on disk; the owner may delete it.
