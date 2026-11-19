# Code Dungeon Unity client — third-party notices

- **Scope:** the Unity project at `unity/CodeDungeon/` only. The Next.js app's notices are in `docs/ASSETS.md`.
- **Recorded:** 19 November 2026, T-04 scaffold, on the owner's Mac (Unity 6000.3.28f1).
- **Method:** every licence below was read from the `LICENSE.md` / `license.txt` / `Third Party Notices.md` file inside the resolved package in `Library/PackageCache/<package>@<hash>/`, not from a website or aggregator. Versions come from `Packages/packages-lock.json` after resolution.
- **No third-party art, audio, fonts, models or code** are in `Assets/` at T-04. The only non-project assets are the files the Unity URP template generated (`Assets/Settings/*`, `Assets/Scenes/SampleScene.unity`, `Assets/InputSystem_Actions.inputactions`; the template's `Assets/TutorialInfo/` and `Assets/Readme.asset` were removed on 19 November 2026), which come from the Unity template package `com.unity.template.urp-blank` 17.1.0 and are used under Unity's terms in a Unity project.

## Licence key

| Licence | What it means for Code Dungeon |
|---|---|
| **Unity Companion License (UCL)** | Use and modification allowed **only in Unity-dependent projects**. Not OSI open source; must not be reused outside Unity. |
| **Unity Companion Cinemachine Code License 1.0** | Cinemachine's own variant of the UCL (`license.txt`): same Unity-only restriction; derivative works of the package itself are assigned to Unity; keep the copyright notice with substantial portions. |
| **Unity Companion Package License v1.0** | UCL-family licence used by `com.unity.searcher`; Unity-only use. |
| **Unity Package Distribution License (UPDL)** | Unity's proprietary package licence (terms at the URL in each package's `LICENSE.md`; the full terms were not reviewed for T-04). Not open source; treat as Unity-only. |
| **Unity Terms of Service** | Governed by Unity's general terms; proprietary, not open source. Editor-only tooling here. |
| **MIT** | Permissive; keep the copyright and licence text. |

## Direct dependencies (pinned in `Packages/manifest.json`)

| Package | Version | Required by T-04? | Licence (file read) | Ships in the WebGL player? |
|---|---|---|---|---|
| `com.unity.render-pipelines.universal` (URP) | 17.3.0 | Yes (template) | UCL (`LICENSE.md`); bundled components in `Third Party Notices.md` (e.g. FXAA3_11.h under its own licence) | Yes |
| `com.unity.inputsystem` | 1.20.1 | Yes | UCL (`LICENSE.md`) | Yes |
| `com.unity.cinemachine` | 3.1.7 | Yes | `LICENSE.md` says UCL; `license.txt` is the **Unity Companion Cinemachine Code License 1.0**. Bundles Clipper (Angus Johnson, Boost Software License 1.0; see the package's `Third Party Notices.md`) | Yes, once used (T-06) |
| `com.unity.test-framework` | 1.6.0 | Yes | UCL (`LICENSE.md`) | No (tests excluded by `UNITY_INCLUDE_TESTS`) |
| `com.unity.pipeline` | 1.0.0 | Yes (agent/Editor control) | **Unity Terms of Service** (`LICENSE.md`) — *not* UCL. `Third Party Notices.md` lists MIT components: Roslyn (Microsoft.CodeAnalysis.Common / .CSharp 3.11.0), System.Collections.Immutable 10.0.1, System.Reflection.Metadata 10.0.1, System.Runtime.CompilerServices.Unsafe 6.1.2 (© .NET Foundation and Contributors) | No (Editor tooling) |
| `com.unity.ai.navigation` | 2.0.16 | Template default | UCL | Only if used (not in the slice) |
| `com.unity.timeline` | 1.8.13 | Template default | UCL | If used |
| `com.unity.ugui` | 2.0.0 | Template default | UCL | If used |
| `com.unity.visualscripting` | 1.9.12 | Template default | UPDL | If used |
| `com.unity.collab-proxy` (Unity Version Control) | 2.14.0 | Template default | UPDL | No (Editor) |
| `com.unity.multiplayer.center` | 1.0.1 | Template default | UPDL | No (Editor) |
| `com.unity.ide.rider` | 3.1.0 | Template default | MIT (© 2019 Unity Technologies, © 2019 JetBrains s.r.o.) | No (Editor) |
| `com.unity.ide.visualstudio` | 2.0.26 | Template default | MIT (© 2019 Unity Technologies, © 2019 Microsoft Corporation) | No (Editor) |
| `com.unity.modules.*` | 1.0.0 | Template default | Built-in Unity engine modules (Unity Editor licence) | As used |

## Indirect dependencies (resolved, not pinned by us)

| Package | Version | Licence (file read) |
|---|---|---|
| `com.unity.render-pipelines.core` | 17.3.0 | UCL; `THIRD PARTY NOTICES.md` in package |
| `com.unity.render-pipelines.universal-config` | 17.0.3 | UCL |
| `com.unity.shadergraph` | 17.3.0 | UCL |
| `com.unity.splines` | 2.9.1 | UCL (Cinemachine dependency) |
| `com.unity.settings-manager` | 2.1.1 | UCL |
| `com.unity.burst` | 1.8.31 | UCL; `Third Party Notices.md`: LLVM (Apache-2.0 with LLVM Exceptions; NCSA), Mono.Cecil (MIT), Smash (BSD-2-Clause) |
| `com.unity.collections` | 2.7.1 | UCL |
| `com.unity.mathematics` | 1.3.3 | UCL |
| `com.unity.nuget.mono-cecil` | 1.11.6 | UCL; `Third Party Notices.md` (Mono.Cecil, MIT) |
| `com.unity.nuget.newtonsoft-json` | 3.2.2 | UCL; `Third Party Notices.md`: Newtonsoft.Json and Unity forks (MIT) |
| `com.unity.ext.nunit` | 2.0.5 | UPDL; `Third Party Notices.md` lists NUnit 3.5 (MIT) |
| `com.unity.test-framework.performance` | 3.5.0 | UCL; `Third Party Notices.md`: Perfolizer (MIT) |
| `com.unity.searcher` | 4.9.5 | Unity Companion Package License v1.0 |

## Not present

No Asset Store items, git-URL packages, OpenUPM packages, LitMotion, react-unity-webgl or other proposed items from `docs/OPEN_SOURCE_REUSE_AUDIT.md` are installed. Add a row here (and update that audit) when one is integrated.
