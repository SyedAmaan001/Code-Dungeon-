# Code Dungeon — open-source reuse audit (Unity world client and game-dev tooling)

- **Status:** research only, 18 November 2026. **Nothing listed here is integrated** into the Code Dungeon application or a Unity project. A Unity project does not exist yet.
- **Method:**
  - Each licence was read from the repository's own `LICENSE`/`LICENCE` file in a shallow clone at the commit shown, or from the package metadata where stated. Aggregator pages were not trusted.
  - Activity is the date of the latest commit on the default branch at clone time.
  - Unity compatibility comes from `ProjectVersion.txt` or `package.json` in the repo, or from its README. **None of it was tested in a Unity Editor** (no Editor was available, see `docs/GAMEDEV_TOOLCHAIN.md` §4).
- **Licence key:**
  - **MIT / Apache-2.0 / BSD:** permissive. Commercial use is fine with attribution, and Apache-2.0 also requires keeping its `NOTICE`.
  - **UCL:** the *Unity Companion License*. Use and modification are allowed **only in projects that depend on Unity**; it is not OSI open source. Fine for the Unity client, not reusable outside Unity.
  - **Reference-Only:** read, never copy.
- **Reuse classes:** **A** reuse directly · **B** adapt selected parts · **C** study patterns only · **D** reject.
- **Decision states:** *Integrated* · *Approved* · *Proposed* (recommended, awaiting owner approval) · *Researched* · *Rejected*. Today every entry is *Proposed*, *Researched* or *Rejected*, except tooling installed in the cloud session, which is marked *Installed (tooling)*.

## 1. Register

| # | Project | URL | Category | Licence (verified) | Unity compatibility | Maintenance (evidence) | Dependencies | Class | Integration path | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | awesome-gamedev-agent-skills | https://github.com/gamedev-skills/awesome-gamedev-agent-skills | Agent skills | Apache-2.0 + NOTICE (`LICENSE`, `c6ca6c4`) | Written for Unity 6.3 LTS (README) | Active: 2026-11-12; release 2.0.0 on 2026-11-11 | None (Markdown; optional Python helper scripts) | A (tooling) | Claude Code plugins / personal skills, not shipped in the product | Installed (tooling, cloud session); laptop pending |
| 2 | Unity agent plugin (official) | https://github.com/Unity-Technologies/unity-agent-plugin | Agent skills, Unity CLI | UCL (`LICENSE.md`) | Unity 6.x | Active: 2026-11-17; plugin 0.1.9-beta | Unity CLI for the `unity-cli` skill | A (tooling) | Already synced from the owner's claude.ai account | Installed (tooling) |
| 3 | REA | https://github.com/morluto/rea | Reverse-engineering MCP/CLI | MIT (`LICENSE`, `6752875`) + `THIRD_PARTY_NOTICES.md` | Unity: IL2CPP `global-metadata.dat` v24/27/29/31/39 inventory only | Active: 2026-11-18; npm 6.9.0 | Node ≥22.23.4/24.22.1; optional Ghidra, IDA, Hopper, JADX | A (tooling) | Local agent tool, never shipped | Installed (tooling, cloud session) |
| 4 | Cinemachine | https://github.com/Unity-Technologies/com.unity.cinemachine | Camera | UCL (`com.unity.cinemachine/LICENSE.md`) | `package.json` 3.1.8-pre.2 on main, `unity: 2022.3`; use the **released** 3.x from the Unity registry | Active: 2026-11-17 | Unity packages only | **A** | Unity Package Manager (`com.unity.cinemachine`), never vendored | Proposed |
| 5 | Character Controller Samples | https://github.com/Unity-Technologies/CharacterControllerSamples | Movement (DOTS/ECS) | UCL (`LICENSE.md`) | Unity 6000.3.22f1; `com.unity.charactercontroller` 1.4.5, Entities | Active: 2026-08-24 | Entities, Entities Graphics, Input System 1.20.0 | **C** | Study only. ECS adds complexity the slice doesn't need (see §2) | Researched |
| 6 | NavMeshComponents | https://github.com/Unity-Technologies/NavMeshComponents | Navigation | MIT (`LICENSE`) | Legacy; the README says development moved to the **AI Navigation** package | Inactive: 2021-07-27 | — | **D** | Use `com.unity.ai.navigation` from the registry when NPC pathing is needed (not in the slice) | Rejected |
| 7 | Unity Graphics (URP/HDRP/Shader Graph source) | https://github.com/Unity-Technologies/Graphics | Rendering | UCL (`LICENSE.md`) | Tracks Unity versions | Active: 2026-10-26 | — | **A** via packages / **C** for source | Use `com.unity.render-pipelines.universal` from the registry; read the source to understand renderer features. Never fork | Proposed (as a package) |
| 8 | Unity Open Project 1 "Chop Chop" | https://github.com/UnityTechnologies/open-project-1 | Whole small RPG/adventure: scene loading, SO event channels, save, quests, dialogue, interaction, inventory, cutscenes | Apache-2.0 top-level `LICENSE`. **Bundles DOTween with its own licence** (`Assets/Addons/DOTween/License.txt`); art and audio provenance not checked per file | Unity 2020.3.17f1 (old, needs an upgrade) | **Archived/inactive:** 2022-06-26 | DOTween, Cinemachine 2, old Input System | **C** (code patterns); **B** for small code pieces only after per-file review | Study `Assets/Scripts/{SceneManagement,Events,Interaction,Quests,Dialogues,SaveSystem}` for structure; rewrite for Unity 6 in our own code. **Copy no art or audio** | Proposed (study) |
| 9 | Boss Room | https://github.com/Unity-Technologies/com.unity.multiplayer.samples.coop | Full sample game (co-op) | UCL (`LICENSE.md`) | Unity 6 era | 2025-10-23 | Netcode for GameObjects | **C** | Architecture reading only (game-state machine, action system). Multiplayer is out of scope | Researched |
| 10 | UnityCsReference | https://github.com/Unity-Technologies/UnityCsReference | Engine C# reference | **Unity Reference-Only Licence** (`LICENSE.md`) | All | 2026-11-05 | — | **C** (read only) | Debugging reference; never copy code | Researched |
| 11 | react-unity-webgl | https://github.com/jeffreylanters/react-unity-webgl | Web embedding (React ↔ Unity bridge) | Apache-2.0 (`LICENSE.md`) | npm 10.2.0; v9+ supports Unity 2020+ builds; **Unity 6 build loading must be tested** at integration | 2026-05-08 | Peer `react >=16.8.0` (npm metadata), compatible with our React 19.3.1 | **A** | npm dependency in the Next.js shell (`/play/world` client component) | Proposed |
| 12 | Yarn Spinner for Unity | https://github.com/YarnSpinnerTool/YarnSpinner-Unity | Dialogue | MIT (`LICENSE.md`) | Unity 2022.3+/6 per project docs (check on import) | Active: 2026-11-17 | Yarn Spinner core (MIT) | **A** (if dialogue is needed) | UPM git or OpenUPM package; dialogue *text* as content data | Researched (not needed for the slice) |
| 13 | ink + ink-unity-integration | https://github.com/inkle/ink, https://github.com/inkle/ink-unity-integration | Narrative scripting | MIT (`LICENSE.txt`; integration `LICENCE.md`) | Unity package `com.inkle.ink-unity-integration` | Active: 2026-11-16 / 2026-07-08 | — | **A** (alternative to #12) | Same as #12; choose one later | Researched |
| 14 | Edgar for Unity | https://github.com/OndrejNepozitek/Edgar-Unity | Graph-based procedural level layout | MIT (`LICENSE`) | Unity 2018.4+ per README; recheck for Unity 6 | Active: 2026-07-30 | — | **C** | Not for the slice; possible later for optional review dungeons | Researched |
| 15 | LitMotion | https://github.com/annulusgames/LitMotion | Tweening / game feel | MIT (`LICENSE`) | Unity 2021.3+ (README); test on 6.3 | Active: 2026-11-12 | Unity Collections, Burst (package deps) | **A** | UPM git URL pinned to a tag | Proposed |
| 16 | PrimeTween | https://github.com/KyryloKuzyk/PrimeTween | Tweening | **Custom licence** (`LICENSE`: free commercial use in binary form; redistribution of source restricted). Not OSI | Unity 2018.4+ | Active: 2026-11-17 | — | **D** for now | Prefer #15 (MIT) | Rejected (licence) |
| 17 | UniTask | https://github.com/Cysharp/UniTask | Async/await for Unity (HTTP and scene loading later) | MIT (`LICENSE`) | Unity 2018.4+ | Active: 2026-10-06 | — | **A** (when needed) | UPM git URL pinned to a tag. Not needed for the slice | Researched |
| 18 | CoplayDev unity-mcp | https://github.com/CoplayDev/unity-mcp | Editor control (MCP) | MIT (`LICENSE`) | Unity 2021.3 → 6.x (README) | Active: 2026-11-17, tag v10.3.0 | Python 3.10+, `uv`; **telemetry on by default** | **A (tooling, fallback)** | Only if the Unity CLI route fails; set `DISABLE_TELEMETRY=true`; local transport only | Researched |
| 19 | IvanMurzak Unity-MCP | https://github.com/IvanMurzak/Unity-MCP | Editor control (MCP) | Apache-2.0 (`LICENSE`) | Unity 2022.3+; CI on 2022.3, 6000.0, 6000.3, 6000.6 (README) | Active: 2026-11-17 | OpenUPM package, `unity-mcp-cli`; cloud sign-in optional | **A (tooling, fallback)** | Second fallback; prefer stdio/local mode with no cloud sign-in | Researched |
| 20 | Unity Starter Assets – Third Person | Unity Asset Store item 196526 | Third-person controller | **Unclear:** store pages say UCL in one listing and a "non-standard EULA" in another. The licence file in the downloaded package must be read | Unity 2022.3 LTS / Unity 6 LTS (store) | Unity-maintained | Input System, Cinemachine | **B** (if its licence file allows) | The owner downloads it with their Unity account; we adapt the controller script and **replace the art**. Otherwise write our own (§2) | Proposed, pending licence check |
| 21 | Unity Input System | Unity registry `com.unity.inputsystem` | Input | Unity package licence (UCL-family; read `LICENSE.md` on import) | Unity 6 | Unity-maintained | — | **A** | Package Manager | Proposed |
| 22 | URP (Universal Render Pipeline) | Unity registry | Rendering, fog, post-processing | as #7 | Unity 6 | Unity-maintained | — | **A** | Package Manager; URP template project | Proposed |
| 23 | AI Navigation | Unity registry `com.unity.ai.navigation` | Navigation | Unity package licence (check on import) | Unity 6 | Unity-maintained | — | **A** (later) | Not in the slice (no NPC AI) | Researched |

**Searched for and not found** (no qualifying, actively maintained, permissively licensed Unity project): a general quest framework worth reusing (the backend already owns quests, so none is needed), a URP volumetric-fog package with a verified permissive licence (use URP's built-in fog, height-fog Shader Graph and particles first; re-evaluate before buying anything), and a loading-screen library (Unity's `SceneManager.LoadSceneAsync` / Addressables is enough).

## 2. Decisions and reasoning

- **Movement: write our own, based on Unity's `CharacterController` component.** Two pieces, about 200 lines in total:
  - a `ThirdPersonMotor` with the Input System and slope and step handling;
  - Cinemachine 3 `CinemachineCamera` with Orbital Follow plus Rotation Composer.

  The DOTS Character Controller (#5) is excellent but brings Entities, Burst and baking: too much for a one-scene slice and for WebGL. Starter Assets (#20) may be adapted only after its licence file is read.
- **Camera: Cinemachine 3 (A).** It is the standard, it is maintained, and it gives cinematic blends for the gate event.
- **Rendering: URP (A).** URP is the pipeline that targets WebGL/WebGPU. HDRP does not run on the web.
- **Dialogue: none in the slice.** Yarn Spinner and ink are both MIT and both suitable later. Choose one when narrative work starts. Any text stays in content data, reviewed like curriculum.
- **Tweens: LitMotion (MIT)** over DOTween (proprietary licence, and Chop Chop bundles it) and PrimeTween (custom licence).
- **Editor control (tooling): Unity CLI + Pipeline first.** The MCP servers are fallbacks (`docs/GAMEDEV_TOOLCHAIN.md` §4).
- **Never vendor or submodule** any of these. Unity packages come through the Package Manager, pinned in `Packages/manifest.json`, and GitHub-only packages through pinned git tags.

## 3. Licence obligations, if the Proposed items are approved

| Item | Obligation |
|---|---|
| Apache-2.0 (react-unity-webgl, gamedev-skills) | Keep licence and NOTICE text in third-party notices if shipped (react-unity-webgl is shipped in the JS bundle) |
| MIT (LitMotion, Yarn Spinner/ink, UniTask) | Include the copyright and licence in third-party notices in the Unity build |
| UCL (Cinemachine, URP, Input System) | Only usable in Unity-dependent projects; nothing to show in the credits beyond Unity's own |
| Starter Assets | Read the licence file in the package before use; record it in `docs/ASSETS.md` |

Every adopted item must be added to `docs/ASSETS.md` (asset provenance) or a new `THIRD_PARTY_NOTICES` file in `unity/CodeDungeon/` when it is integrated.
