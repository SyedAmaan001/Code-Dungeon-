# Code Dungeon — game-development toolchain

- **Status:** research/tooling baseline verified in a Claude Code cloud session on 18 November 2026; owner Mac environment independently verified on 19 November 2026 (see §7). The original handoff assumed Windows; that assumption is superseded by the Mac verification.
- **Scope:** agent tooling only. No application code, migrations, game rules or curriculum were changed.
- **Rule:** nothing here is "working" without the check in the *Evidence* column.

## 1. Summary

| Tool | Version | Where verified | Status | Evidence |
|---|---|---|---|---|
| Claude Code CLI | 2.1.327 | cloud container | Present | `claude --version` |
| Node.js | 22.23.5 (container); owner Mac 26.13.0 (§7) | cloud + owner Mac | Present | `node --version` in each environment |
| gamedev-skills marketplace `awesome-gamedev-agent-skills` | git `c6ca6c41c839` (release 2.0.0, 2026-11-11) | cloud container | Installed | `claude plugin marketplace add …` succeeded |
| `router@awesome-gamedev-agent-skills` | `c6ca6c41c839` | cloud container | Installed, **routing verified** | Headless test in §2.3 |
| `disciplines@…` (15 skills) | `c6ca6c41c839` | cloud container | Installed | `claude plugin details` |
| `genres@…` (9 skills) | `c6ca6c41c839` | cloud container | Installed | `claude plugin details` |
| `workflows@…` (5 skills) | `c6ca6c41c839` | cloud container | Installed | `claude plugin details` |
| `unity@awesome-gamedev-agent-skills` (9 skills) | `c6ca6c41c839` | cloud container | Installed, **but shadows Unity's official plugin**, see §2.2 | `claude plugin list` warning |
| Unity's official plugin `unity` (Unity Technologies) | 0.1.9-beta, 33 skills | already synced from the owner's claude.ai account | Present; disabled in the container by the name clash | `claude plugin list` ("Synced from claude.ai") |
| REA (`rea-agents`) | 6.9.0 (npm latest on 2026-11-18) | cloud container | Installed, MCP **Connected**, CLI analyses verified | §3 |
| Unity Editor / Unity Hub / Unity CLI | — | cloud container | **Not present** (no Editor, no GPU; Unity is not installed in the container) | §4 |
| Unity MCP / Unity Pipeline connection | — | — | **Not configured.** Needs the laptop | §4 |

**The cloud container is ephemeral.** Plugins, the REA registration and the global npm package installed there are lost when the session is reclaimed. They prove the commands and configuration only. The owner Mac has its own verified Unity/Node/Claude installation in §7; remaining Mac setup and editor checks are tracked in `docs/MAC_U0_RUNBOOK.md`. §5 is a historical Windows checklist.

## 2. Game-development skills (gamedev-skills/awesome-gamedev-agent-skills)

### 2.1 What was installed

Repository: https://github.com/gamedev-skills/awesome-gamedev-agent-skills. Licence: **Apache-2.0**, checked from the `LICENSE` file at commit `c6ca6c4` (with a `NOTICE` file). The README is pinned to Unity 6.3 LTS, Godot 4.7.2 and Unreal 5.8, checked on 2026-11-11.

Commands run (official README procedure; the `marketplace.json` bundles were inspected first):

```bash
claude plugin marketplace add gamedev-skills/awesome-gamedev-agent-skills
claude plugin install router@awesome-gamedev-agent-skills
claude plugin install unity@awesome-gamedev-agent-skills
claude plugin install disciplines@awesome-gamedev-agent-skills
claude plugin install genres@awesome-gamedev-agent-skills
claude plugin install workflows@awesome-gamedev-agent-skills
```

Not installed, on purpose: the `gamedev` (all 79 skills), `godot`, `unreal`, `ebitengine`, `web-engines` and `other-engines` bundles. Code Dungeon targets Unity, and every skill description costs context on every turn.

Safety review before install: the bundles contain **skills only**. They have 0 hooks, 0 MCP servers, 0 agents and 0 LSP servers (`claude plugin details`). A few skills ship Python helper scripts (for example `unity-csharp-scripting/scripts/check_unity_project.py`). They run only when a skill tells the agent to run them, and they should be run with `python -I`.

Always-on context cost (from `claude plugin details`): router about 149 tokens, unity about 1,433, disciplines about 2,394, genres about 1,408 and workflows about 729, roughly **6.1k tokens per session** in total. Each bundle's cache holds a full copy of the repository (`strict: false`), which costs disk space but not context.

### 2.2 Required capabilities and the `unity` name clash

The prompt's capability list maps to skills as follows. A **G** means a gamedev-skills skill, a **U** means a skill in Unity's official plugin.

| Capability | Skill(s) |
|---|---|
| Unity C# scripting | G `unity-csharp-scripting` |
| Unity Input System | G `unity-input-system` |
| Unity physics | G `unity-physics`; U `physics-3d-collision` |
| Unity animation | G `unity-animation` |
| ScriptableObjects | G `unity-scriptableobjects` |
| Navigation | G `unity-navmesh`; U `initialize-ai-navigation` |
| Build pipeline | G `unity-build-pipeline`, `unity-build-size`; U `unity-cli`, `optimize-web` |
| Game asset creation | G `create-game-assets` |
| Lighting and shaders | G `shader-programming`; U `urp-postprocessing`, `shader-graph-create-custom-node`, `validate-urp-render-graph-renderer-feature` |
| Cinematic game feel | G `game-feel`, `camera-systems`; U `craft-game-floors` |
| Quest and dialogue | G `dialogue-systems`, `rpg` |
| Save systems | G `save-systems` (Code Dungeon progress stays server-side; only local settings would use it) |
| RPG architecture | G `rpg` |
| Editor control | U `unity-cli` (Unity CLI and `com.unity.pipeline`) |

**Clash.** Both plugins are named `unity`. After `unity@awesome-gamedev-agent-skills` was installed, Claude Code reported: *"unity@synced from claude.ai not loaded — unity@awesome-gamedev-agent-skills on this machine has the same name and takes precedence."* The two skill sets barely overlap, and **both are needed**: the official plugin is the only source of `unity-cli`, URP, Unity web optimisation and UI Toolkit skills.

An attempt to uninstall the gamedev `unity` bundle in the container was refused by the session's permission policy. The container was left as it was, which does not matter because it is discarded.

**Recommendation for the laptop (owner decides):**
- Do **not** install `unity@awesome-gamedev-agent-skills` as a plugin.
- Keep Unity's official `unity` plugin.
- Add the nine gamedev Unity skills as standalone personal skills with the repository's documented `skills` CLI. That puts them under `~/.claude/skills/`, outside the plugin namespace, so nothing clashes. See §5 step 2.

### 2.3 Router verification (reproducible)

A fake Unity project (`Assets/` plus `ProjectSettings/ProjectVersion.txt` saying `6000.3.0f1`) was created in the scratchpad. Then:

```bash
claude -p "Use the router skill. Without writing any code, state which engine you detect … 'third-person character with a follow camera and an interactable gate that triggers a quest event' …" \
  --model haiku --max-turns 6 --allowedTools "Skill,Read,Glob"
```

Observed answer: *"Detected engine: Unity (Unity 6.3 LTS, editor version 6000.3.0f1)…"*. Skills to load: `unity-csharp-scripting`, `camera-systems`, `level-design`, `rpg`.

So the router detects Unity from `Assets/` and `ProjectSettings/ProjectVersion.txt`. This repository (Next.js) is **not** detected as Unity until `unity/CodeDungeon/` exists, so open Claude Code inside that folder for Unity work.

## 3. REA (morluto/rea)

- Repository https://github.com/morluto/rea at commit `6752875`. Licence **MIT**, checked from `LICENSE` ("Copyright (c) 2026 morluto"). The repo also has `THIRD_PARTY_NOTICES.md`, a `licenses/` folder and `DISCLAIMER.md`.
- npm package `rea-agents` 6.9.0. The `engines` field requires Node `^22.23.4 || ^24.22.1 || >=26.12.1`.
  - Container: Node 22.23.5, which is OK.
  - **Owner Mac:** Node 26.13.0 was verified on 19 November 2026 and meets the package requirement. REA is not yet installed on that Mac; follow `docs/MAC_U0_RUNBOOK.md` Step 1.

Steps taken:
1. **Read-only plan first:** `npx -y rea-agents@6.9.0 setup --client claude_code --dry-run --json`.
   - Planned actions: (a) add the REA MCP registration to `~/.claude.json`, backed up to `~/.claude.json.rea.backup`; (b) install the `reverse-engineer-anything` skill into `~/.claude/skills/`.
   - No external actions, and no Hopper.
   - The plan pointed the MCP command at the **npx cache**, which can be cleaned away.
2. To get a stable path: `npm install --global rea-agents@6.9.0`, then `rea setup --client claude_code --yes --json`. Status was `ready`, and the applied actions were `configured_claude_code` and `installed_skill`.
3. Verification:
   - `claude mcp get rea` reported **Status: ✓ Connected**, Type stdio, command `node …/rea mcp`, user scope.
   - `rea doctor --client claude_code --skill --json` reported `healthy: true`. `environment_healthy: false` only because no native provider is configured (Ghidra `GHIDRA_INSTALL_DIR` unset, no IDA, JADX, Kuna or Hopper).
   - Tool discovery: `rea --help` lists the analysis commands, including `inspect-il2cpp-metadata`, `analyze-javascript-application`, `audit-release-exposure`, `compare-application-versions` and `decompile`. MCP tools registered after this session started are not loaded into the same session; they load in the next session.
   - Functional checks against **our own code** (authorised target):
     - `rea analyze-javascript-application <repo>/scripts --json` (exit 0, evidence with limitations).
     - Code Dungeon's own production client bundle (`.next/static`), with an `audit-release-exposure` result, written up in `docs/reverse-engineering/001-code-dungeon-web-bundle.md`.
- Not installed: Hopper (commercial), Ghidra, IDA, JADX and Kuna. None is needed for the planned work. IL2CPP `global-metadata.dat` decoding (versions 24, 27, 29, 31 and 39) and static JavaScript/Electron analysis are built in. Installing Ghidra (it needs a JDK) needs a separate approval.
- Secrets: REA's registration carries only `JAVA_HOME`. No tokens.

## 4. Unity environment discovery

| Check | Result |
|---|---|
| Unity Editor or Hub in the container | None (`which unity`, a filesystem search). 4 vCPU, 15 GB RAM, no GPU |
| Unity project in this repository | None. No `ProjectVersion.txt` anywhere |
| Unity projects on the Mac | `unity projects --long --all` → `total: 0` (owner Mac report, 19 Nov) |
| Unity Pipeline connection | `com.unity.pipeline` 1.0.0 installed in the disposable Mac project; Editor `ready`, 23 command groups exposed; all 8 T-03 checks reported passing (owner Mac report, 19 Nov) |

Unity Editor-control options, in order of recommendation:
1. **Unity CLI + `com.unity.pipeline` (official).** Unity's own `unity-cli` skill says: *"When you can run shell commands, use `unity command` and the rest of this CLI, not the Unity MCP server."* It needs Unity 6.0+. The package is added with `unity pipeline install`. Avoid Editors 6000.5.0–6000.5.2, where the Pipeline server cannot start (documented in the official `new-unity-project` skill). The Windows install script is `irm https://unity.com/install.ps1 | iex`. **The owner should run it**, because it is a remote script that changes the system.
2. **Unity's MCP server in `com.unity.ai.assistant`** (docs for 2.x). Unity's documentation describes a relay binary. A Unity AI subscription may be required, and third-party guides say this server is being superseded by the CLI. Not recommended unless the CLI route fails.
3. **Community MCP servers**:
   - CoplayDev `unity-mcp`: MIT (LICENSE checked), Unity 2021.3–6.x, Python 3.10+ through `uv`, **telemetry on by default** (set `DISABLE_TELEMETRY=true`).
   - IvanMurzak `Unity-MCP`: Apache-2.0 (LICENSE checked), Unity 2022.3+, OpenUPM package and `unity-mcp-cli`.
   - These are fallbacks only, with reviewed permissions.

The eight Editor connector checks were reported **PASS** by the owner's local Mac Claude session on 19 November 2026. Details and the unsaved-`Untitled` scene qualification are in `docs/MAC_U0_RUNBOOK.md` §3 results. The checks ran only in the disposable `~/UnityScratch/ConnectorTest`; no existing project or Code Dungeon app files were modified.

## 5. Original Windows owner-action checklist (historical; superseded for this owner by §7)

1. Update Node in nvm to **24.22.1 or newer** (REA's `engines` field), then run `node --version`.
2. Skills (no name clash):
   ```bash
   claude plugin marketplace add gamedev-skills/awesome-gamedev-agent-skills
   claude plugin install router@awesome-gamedev-agent-skills
   claude plugin install disciplines@awesome-gamedev-agent-skills
   claude plugin install genres@awesome-gamedev-agent-skills
   claude plugin install workflows@awesome-gamedev-agent-skills
   npx skills add gamedev-skills/awesome-gamedev-agent-skills -a claude-code -g --list
   ```
   From the `--list` output, add only `unity-csharp-scripting`, `unity-input-system`, `unity-physics`, `unity-animation`, `unity-scriptableobjects`, `unity-navmesh`, `unity-build-pipeline` and `unity-build-size` (see the repository's `docs/INSTALLATION.md` for the exact selection flag). Keep Unity's official `unity` plugin enabled; `claude plugin list` must show it as loaded with no clash warning.
3. REA:
   ```bash
   npm install --global rea-agents@6.9.0
   rea setup --client claude_code --dry-run
   ```
   Review the plan: it must contain only the MCP registration and the skill. Then run `rea setup --client claude_code`, followed by `claude mcp get rea` and `rea doctor --client claude_code --skill`.
4. Unity:
   - Install Unity Hub and **Unity 6.3 LTS (6000.3.x)** with the WebGL Build Support module. Sign in and choose the licence yourself.
   - Install the Unity CLI with the official script, then `unity --version`.
   - Tell the agent which Editors and projects exist (`unity editors`, `unity projects`), or let it run those read-only commands.
5. Restart Claude Code in `unity/CodeDungeon/` once it exists, and run task T-03 (connector verification).

## 6. Cost

$0. Every tool used here is free and open source, or Unity's free plugin. Nothing was bought, subscribed to or provisioned. The cloud session uses the owner's Claude session credits only.

## 7. Owner Mac verification — 19 November 2026

The owner confirmed these checks directly in macOS Terminal. This is separate from the ephemeral Linux cloud session in §§1–3.

| Tool / component | Verified result | Status |
|---|---|---|
| macOS | 26.6, Apple Silicon (`arm64`) | Verified |
| Node.js | 26.13.0 | Meets REA requirement `^22.23.4 || ^24.22.1 || >=26.12.1` |
| Claude Code CLI | 2.1.311 | Installed on Mac |
| Unity CLI | 1.0.1 | Installed; command available after sourcing `~/.zshrc` |
| Unity Editor | 6000.3.28f1 (Unity 6.3 LTS), arm64 | Installed at `/Applications/Unity/Hub/Editor/6000.3.28f1/Unity.app` |
| Web Build Support | Listed as `Web` by `unity editors --installed` | Installed |
| Unity authentication | `unity auth status` reports signed in | Verified |
| Unity Pipeline package | `com.unity.pipeline` 1.0.0 installed in disposable ConnectorTest project | T-03 PASS (Mac report) |
| Code Dungeon Unity project (T-04) | `unity/CodeDungeon/` created on branch `claude/tender-cerf-ooekni`: URP blank template, URP 17.3.0, Input System 1.20.1, Cinemachine 3.1.7, Test Framework 1.6.0, Pipeline 1.0.0 | **T-04 PASS** (local Mac session; see below and `docs/UNITY_SLICE_REPORT.md`) |
| Existing Unity project inventory | `unity projects --long --all` → no projects; JSON `total: 0`; no Unity Hub projects file | **Done (T-02)**. Nothing opened or changed |
| Unity Editor connector checks | 8/8 reported PASS; see `docs/MAC_U0_RUNBOOK.md` | T-03 PASS (Mac report; scene-path qualification recorded) |
| REA and gamedev skills on the Mac | See "T-01 results" below | **Done (T-01)** |

Commands reported by the owner:

```bash
node -v                       # v26.13.0
claude --version              # 2.1.311
unity --version               # 1.0.1
unity doctor
unity auth status
unity editors --installed
```

The WebGL module initially timed out while resolving/connecting to Unity's CDN, then installed successfully on retry. Do not repeat the Editor or WebGL installation unless a fresh diagnostic shows a problem.

### Repository-connected Claude workflow vs local Unity

The owner says the GitHub repository is connected to Claude, so ordinary repository edits/reviews can be performed in that connected workspace without cloning at this stage. However, the Unity Editor and CLI verified above are installed on the owner's Mac. They operate on project files accessible to that Mac; a remote GitHub-connected Claude workspace does not automatically share the Mac's filesystem.

Therefore:
- Keep remote repository edits on `claude/tender-cerf-ooekni`; do not require a clone for ordinary documentation/source work in the connected workspace.
- T-03 must use a throwaway Unity project on the Mac and the locally installed Editor.
- Before T-04 creates `unity/CodeDungeon/`, make the approved feature-branch checkout available to the Mac's filesystem (a local clone/worktree or an explicitly shared local workspace). Do not claim a local Unity build/test from a remote session that cannot access the Mac's Editor.
- Do not create the production Unity project in an unrelated scratch folder and forget to bring it into the feature branch.

The Unity Pipeline package is required to control a running Editor through `unity command`; installing the CLI alone does not prove Editor control. See the official setup flow in Unity's docs: open a project in the Editor, run `unity pipeline install`, then verify the running Editor/Pipeline connection.

### Remote session record — 19 November 2026

- Environment: GitHub-connected Claude Code cloud session, Linux x86_64. No Unity CLI and no Editor. No owner computer or folder was attached (`list_computer_folders` returned `{"folders":[],"cannot_be_used":[]}`).
- Therefore T-01 (Mac skills and REA), T-02 (Mac project inventory), T-03 (Pipeline checks) and T-04 (project creation) were **not run** and are not claimed.
- Done remotely: `docs/MAC_U0_RUNBOOK.md`, exact commands for T-01–T-03, written from Unity's official `unity-cli` skill (plugin 0.1.9-beta). Its option spellings are **unverified against Unity CLI 1.0.1**; the runbook checks `--help` before each step.
- Noted from the official skill: `unity setup claude` installs Unity's plugin as `unity@claude-plugins-official`. That is also named `unity`, so the §2.2 clash applies on the Mac too.

### T-01 and T-02 results on the owner's Mac — 19 November 2026

Source: reported by the owner's local Mac Claude Code session (transcript pasted 19 Nov 2026; not re-run from the cloud). Environment: Darwin 25.6.0 arm64 (macOS 26.6, build 25G72), Node v26.13.0, Claude Code 2.1.311, Unity CLI 1.0.1.

**T-01: skills**
- Official Unity plugin `unity@synced` 0.1.9-beta is present (manifest author Unity Technologies, repo `Unity-Technologies/unity-agent-plugin`).
- The gamedev marketplace was not configured, so it was added at user scope.
- `router`, `disciplines`, `genres` and `workflows` from `awesome-gamedev-agent-skills` are installed at `c6ca6c41c839` and enabled. **`unity@awesome-gamedev-agent-skills` was not installed.**
- Standalone skills were added with `skills` CLI 1.9.0, selection flag `-s, --skill`, into `~/.claude/skills/`. The eight are `unity-csharp-scripting`, `unity-input-system`, `unity-physics`, `unity-animation`, `unity-scriptableobjects`, `unity-navmesh`, `unity-build-pipeline` and `unity-build-size`. `unity-tilemap-2d` was not installed. The CLI's scan rated all eight Safe / 0 alerts.
- `claude plugin list` shows no clash warning. The official `unity:*` skills load alongside the standalone ones, so **R-65 is resolved on the Mac.**

**T-01: REA**
- `npm install --global rea-agents@6.9.0` → `rea --version` 6.9.0 at `/opt/homebrew/bin/rea`.
- The `--dry-run` plan had two local actions:
  1. Update `~/.claude.json` with an MCP server running `/opt/homebrew/bin/node /opt/homebrew/bin/rea mcp`, backed up to `~/.claude.json.rea.backup`.
  2. Install the skill at `~/.claude/skills/reverse-engineer-anything`.
- No provider or Hopper action was planned.
- **The owner approved the plan**, and it was applied.
- Result: the `rea` MCP is registered at user scope and `rea doctor --client claude_code --skill` reports `healthy: true` (skill aligned, version 62, 255 tools). The remaining warnings are only the providers deliberately not installed (Ghidra, IDA, JADX, Kuna, Hopper).
- Claude Code must be restarted to load the MCP tools.

**T-02: inventory (read-only)**
- `unity editors --installed --long`: 6000.3.28f1 (arm64) at `/Applications/Unity/Hub/Editor/6000.3.28f1/Unity.app`, module Web Build Support.
- `unity projects --long --all`: **no projects**. The JSON listing gives `total: 0`, and there is no Unity Hub projects file. The T-03 throwaway project will be the first.

**Differences between CLI 1.0.1 and the runbook:**
- `unity projects` has no `list` subcommand; the plain command lists projects.
- It pages 10 at a time unless `--all` is given.
- `--long` adds the version, modified, cloud, pipeline and VCS columns.
- `editors --installed` shows modules only with `--long`.
- The `skills` CLI selection flag is `-s/--skill`.

**Open items (owner decisions, not blocking T-03):**
1. npm **blocked the install script of `frida@17.23.2`**, an REA dependency that downloads a native binary. It was left blocked, so REA's live-instrumentation (Frida) features may not work; static analysis is unaffected. Only allow it if needed: `npm install -g --allow-scripts=frida rea-agents@6.9.0`.
2. Antigravity has an **older REA registration** in `~/.gemini/config/mcp_config.json` (`npx -y rea-agents@6.8.0 mcp`), which doctor flags as stale. It is outside T-01 and untouched; update or remove it later in Antigravity.
3. npm printed a deprecation warning for `prebuild-install@7.1.3` (harmless).

**Before T-03:** the owner checks the Unity licence in Unity Hub (Settings → Licenses). See the runbook's licence preflight.

### T-04 results on the owner's Mac — 19 November 2026

Source: a local Claude Code session on the owner's Mac, run directly in the repository checkout `~/Projects/Code-Dungeon` on `claude/tender-cerf-ooekni`. Full commands and outputs are in `docs/UNITY_SLICE_REPORT.md` §3.

- **Baseline re-checked:**
  - Node v26.13.0, Claude Code 2.1.311, Unity CLI 1.0.1.
  - Editor 6000.3.28f1 arm64 + Web Build Support.
  - `unity doctor` checks pass.
- **ConnectorTest:** the T-03 ConnectorTest Editor was closed gracefully with `unity close --if-saved`. The project is kept on disk.
- **Project creation:** `unity projects create CodeDungeon --output-dir <repo>/unity --editor-version 6000.3.28f1 --template com.unity.template.urp-blank --no-cloud --non-interactive` exited 0.
  - **The Pipeline and Cinemachine setup steps both succeeded this time.** In T-03 the Pipeline step needed a retry and Cinemachine failed.
  - Cloud linking and VCS were skipped.
- **Ten gates:**
  - Editor `ready`.
  - Pipeline commands visible.
  - Saved scenes opened by exact path, in build order Boot → OvergrownGate.
  - Packages resolved; 0 console errors.
  - Batch compile exit 0.
  - EditMode 1/1 passed.
  - PlayMode run completed (0 tests, assembly compiled as a test assembly).
  - WebGL build succeeded (≈13.6 MiB Brotli `Build/`).
  - Loaded in headless Google Chrome 157 with 0 JS exceptions.

**CLI 1.0.1 findings (new):**
- `unity build --target WebGL` has no built-in command-line build (exit 2). Use `unity build --create-profile WebGL`, then `unity build --profile WebGL`. The profile is `Assets/Settings/Build Profiles/WebGL.asset`.
- According to its `--help`, `unity build` has an uncommitted-changes guard, so `--allow-dirty-build` was passed (not observed failing). It writes `unity-build.provenance.json` beside the output.
- Per the official skill docs, `unity test` refuses a project that is open in an Editor, so the Editor was closed gracefully before the batch runs (not observed failing).
- `unity command script eval --code '<C#>'` rejected one longer lambda-heavy snippet with "Give either code or file, not both". `--file <path.cs>` worked.
- A first IL2CPP WebGL build of the empty project took about 12 minutes on the Mac.

