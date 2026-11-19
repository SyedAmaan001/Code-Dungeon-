# Code Dungeon — Mac runbook for U0 (T-01 to T-03)

- **Run where:** the owner's Mac (macOS 26.6 arm64, Unity CLI 1.0.1, Unity 6000.3.28f1; see `docs/GAMEDEV_TOOLCHAIN.md` §7), in Terminal or in a **local** Claude Code session on the Mac.
- **Not runnable** from the GitHub-connected cloud session. That session is a Linux container with no Unity and no access to the Mac's filesystem (`list_computer_folders` returned no shared folder on 19 November 2026).
- **Written:** 19 November 2026, from Unity's official `unity-cli` skill (plugin 0.1.9-beta). **The CLI on the Mac is 1.0.1 and may spell options differently.** Run the `--help` check shown before each step and follow the CLI over this file. Record any difference in §5.
- **Safety:** Steps 1–2 are read-only, except the reviewed tool installs in step 1. License preflight only inspects Unity Hub. Step 3 creates one throwaway project **outside the repository** with no Unity Cloud link. `script eval` executes arbitrary C# in the running Editor with your user permissions, so run only the listed snippets against this disposable project. Nothing here touches an existing Unity project or the Code Dungeon repository.

## Step 1: T-01 skills and REA (local Claude Code tooling)

```bash
node -v                      # expect v26.13.0 (REA needs ^22.23.4 || ^24.22.1 || >=26.12.1)
claude --version
claude plugin list           # note whether Unity's official `unity` plugin is present (synced or installed)
```

Install the gamedev bundles **without** the clashing `unity` bundle:

```bash
claude plugin marketplace add gamedev-skills/awesome-gamedev-agent-skills
claude plugin install router@awesome-gamedev-agent-skills
claude plugin install disciplines@awesome-gamedev-agent-skills
claude plugin install genres@awesome-gamedev-agent-skills
claude plugin install workflows@awesome-gamedev-agent-skills
```

For the gamedev Unity skills, preview first, then add only the Unity ones as standalone personal skills:

```bash
npx skills add gamedev-skills/awesome-gamedev-agent-skills --help
npx skills add gamedev-skills/awesome-gamedev-agent-skills -a claude-code -g --list
```

Select `unity-csharp-scripting`, `unity-input-system`, `unity-physics`, `unity-animation`, `unity-scriptableobjects`, `unity-navmesh`, `unity-build-pipeline` and `unity-build-size` (not `unity-tilemap-2d`; the slice is 3D) using the selection flag the `--help` output names. Then check:

```bash
claude plugin list           # expect: no "not loaded … same name" warning for `unity`
ls ~/.claude/skills          # expect the unity-* skill folders
```

> Unity's own CLI can install its official plugin with `unity setup claude`. It installs as `unity@claude-plugins-official`, which is also named `unity`. Run it only if the official plugin is missing, and never alongside `unity@awesome-gamedev-agent-skills`.

REA, with the plan reviewed before it is applied:

```bash
npm install --global rea-agents@6.9.0
rea --version                                   # 6.9.0
rea setup --client claude_code --dry-run        # review: only the MCP registration in ~/.claude.json and the skill
rea setup --client claude_code                  # apply after review; do NOT accept the optional Hopper install
claude mcp get rea                              # expect: Status ✓ Connected
rea doctor --client claude_code --skill
```

Paste the outputs into `docs/GAMEDEV_TOOLCHAIN.md` §7.

## Step 2: T-02 inventory (read-only)

```bash
unity --version                              # 1.0.1
unity editors --installed                    # 6000.3.28f1 arm64 + Web
unity projects --help                        # confirm the list command and its flags in 1.0.1
unity projects                               # list known projects; do not open or change any
```

For each project listed, note its path and Editor version. **Do not open, upgrade or install packages into any of them.** The owner states the purpose of each one.

## License preflight (before T-03 project creation)

`unity auth status` proves account sign-in; it does **not** prove that a Unity Editor license is activated. Unity's `projects create` prerequisite includes an active license.

1. Open Unity Hub.
2. Open **Settings/Preferences → Licenses**.
3. Confirm an active eligible license is listed for this Mac. If you are using Unity Personal, Unity says signing in to Unity Hub activates it; verify that the license appears in the Licenses view.
4. Do not start a paid trial or select a paid subscription to get past this check. If no eligible license is shown, stop and resolve licensing in Unity Hub before creating the throwaway project.

## Step 3: T-03 Editor-control (Pipeline) verification in a throwaway project

```bash
unity projects create --help                 # confirm --path, --editor-version, --template, --no-cloud in 1.0.1
unity templates --editor-version 6000.3.28f1 --type core --format json    # confirm the URP template id
mkdir -p ~/UnityScratch
unity projects create "ConnectorTest" --path ~/UnityScratch \
  --editor-version 6000.3.28f1 --template com.unity.template.urp-blank --no-cloud
unity pipeline install --project-path ~/UnityScratch/ConnectorTest    # newer CLIs may report it is already present
cd ~/UnityScratch/ConnectorTest
unity open .
unity status --until-ready --project-path ~/UnityScratch/ConnectorTest --format json
unity command --project-path ~/UnityScratch/ConnectorTest    # list the Editor's Pipeline commands (save this output)
```

Then the eight checks. Each `script eval` snippet uses fully qualified names, and each command is pinned to the throwaway project with `--project-path`. The current Unity Technologies CLI skill documents the C# snippet as a positional argument followed by `--project-path`; some Unity Learn examples use `--code` instead. Run `unity command script eval --help` first on CLI 1.0.1 and follow its exact form. Do not combine the two forms.

```bash
P=~/UnityScratch/ConnectorTest

# 1. Scene names (open scenes + Build Profile scene list)
unity command script eval 'return string.Join(", ", System.Linq.Enumerable.Select(System.Linq.Enumerable.Range(0, UnityEngine.SceneManagement.SceneManager.sceneCount), i => UnityEngine.SceneManagement.SceneManager.GetSceneAt(i).path)) + " | build: " + string.Join(", ", System.Linq.Enumerable.Select(UnityEditor.EditorBuildSettings.scenes, s => s.path));' --project-path "$P"

# 2. Hierarchy (root objects of the active scene)
unity command script eval 'return string.Join(", ", System.Linq.Enumerable.Select(UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects(), g => g.name));' --project-path "$P"

# 3. Components on the main camera
unity command script eval 'var c = UnityEngine.Camera.main; return c == null ? "no main camera" : string.Join(", ", System.Linq.Enumerable.Select(c.GetComponents<UnityEngine.Component>(), x => x.GetType().FullName));' --project-path "$P"

# 4. Project settings
unity command script eval 'return "product=" + UnityEditor.PlayerSettings.productName + " colorSpace=" + UnityEditor.PlayerSettings.colorSpace + " target=" + UnityEditor.EditorUserBuildSettings.activeBuildTarget + " rp=" + (UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline == null ? "builtin" : UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline.name);' --project-path "$P"

# 5. Console errors
unity command console status --project-path "$P"       # expect groundTruth.consoleErrors = 0
unity logs --console --level error --project-path "$P"    # should show no errors

# 6. Create the test object
unity command script eval 'var g = new UnityEngine.GameObject("CD_ConnectorTest"); return g.GetInstanceID().ToString();' --project-path "$P"

# 7. Delete it
unity command script eval 'var g = UnityEngine.GameObject.Find("CD_ConnectorTest"); if (g == null) return "not found"; UnityEngine.Object.DestroyImmediate(g); return "deleted";' --project-path "$P"

# 8. Read back that it is gone
unity command script eval 'return UnityEngine.GameObject.Find("CD_ConnectorTest") == null ? "absent" : "STILL PRESENT";' --project-path "$P"
```

**Pass** means every command exits 0, steps 1–4 return real values, step 6 returns an id, step 7 returns `deleted`, and step 8 returns `absent`. **Do not save the scene.** The test project is disposable; the owner may delete `~/UnityScratch/ConnectorTest` afterwards.

If `script eval` is rejected, inspect `unity command script eval --help`. Use either the positional C# argument or `--code` exactly as that installed CLI reports; do not guess a third `-- --code` form. If the Editor never reaches `ready` and `unity status` reports Safe Mode, follow the official recovery: fix compile errors, don't fall back to editing files by hand. **Use a fallback MCP server (CoplayDev or IvanMurzak) only after the owner approves it.**

## Step 4: what T-04 needs (not part of this runbook)

T-04 creates `unity/CodeDungeon/` **inside a local checkout of `claude/tender-cerf-ooekni` on the Mac**, so that Unity, git and the feature branch see the same files:

```bash
git clone --branch claude/tender-cerf-ooekni https://github.com/SyedAmaan001/Code-Dungeon-.git ~/Projects/Code-Dungeon
```

Then follow `docs/NEXT_GAMEDEV_SESSION_PROMPT.md` Step 4 in a **local** Claude Code session opened at that folder.

## 5. Results log (fill in on the Mac)

| Step | Command | Exit | Output (short) | CLI-1.0.1 spelling differences |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3.1–3.8 | | | | |
