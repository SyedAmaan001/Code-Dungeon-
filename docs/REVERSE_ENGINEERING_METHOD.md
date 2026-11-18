# Code Dungeon — reverse-engineering method (REA)

- **Status:** adopted for research, 18 November 2026. The tool is REA 6.9.0 (`docs/GAMEDEV_TOOLCHAIN.md` §3).
- **Purpose:** understand *how* a feature works (architecture, data flow, behaviour), so we can build our **own** implementation from our own code and data models. It is never used to obtain or reproduce someone else's code, assets or story.
- **Reports:** `docs/reverse-engineering/NNN-<target>.md`, with a template in §5.

## 1. Allowed targets (in order of preference)

1. **Code Dungeon's own builds:** the Next.js client bundle and future Unity WebGL/IL2CPP builds. This is the main recurring use: a *release-exposure audit* to show no secrets, answer keys or debug material ship.
2. Open-source Unity games, demos and samples under MIT, BSD or Apache-2.0, where the source is available anyway. REA is then used for **built** behaviour (what a build exposes), not to recover source we can already read.
3. Unity-licensed samples (Unity Companion Licence), only to study patterns inside Unity-dependent work.
4. Applications whose owner has given **written** permission for inspection, with the permission recorded in the report.

**Not allowed:**
- arbitrary commercial game executables
- anything behind DRM, anti-cheat or licence checks
- online services
- extracting proprietary art, audio, story or code
- presenting decompiled pseudocode as source code

These rules also follow REA's own `DISCLAIMER.md`.

## 2. Protocol for each investigation

1. **Authorisation:** record who owns the target and why we may inspect it (owned / OSS licence / written permission). Stop if it is unclear.
2. **Licence:** read the target's `LICENSE` file and note any per-folder licences (for example, DOTween inside Chop Chop).
3. **Feature:** name one feature or question. One report per question.
4. **Tool fit:** `rea capabilities` / `rea guidance` → choose the analyser:
   - JavaScript bundles: `analyze-javascript-application`
   - shipped artefacts: `audit-release-exposure`
   - Unity IL2CPP: `inspect-il2cpp-metadata`
   - Unity asset bundles: `unityfs` (see REA `docs/unityfs.md`)
   - native code: `function` / `decompile`, which need Ghidra (needs approval to install) or another provider
5. **Evidence:** save REA's JSON evidence (`evidence_id`, input SHA-256) **outside the repository** (scratchpad or a local folder). Put only the IDs, hashes and conclusions in the report.
6. **Trace:** describe components, data flow and behaviour, with a diagram (Mermaid or ASCII).
7. **Findings and unknowns:** quote REA's `limitations`. "Not observed" is not "absent".
8. **Reuse:** look for an open-source implementation and record it in `docs/OPEN_SOURCE_REUSE_AUDIT.md`.
9. **Independent plan:** how Code Dungeon builds the feature with its own code and data.
10. **Verify:** tests in our code base prove the implementation, not the analysis.

## 3. Standard checks for every Code Dungeon build (release gate, proposed)

| Build | Command | Pass condition |
|---|---|---|
| Next.js client (`.next/static`) | `rea audit-release-exposure .next/static --json`, plus a text search for server-only markers (answer-key fields, `SUPABASE_SECRET`, `DATABASE_URL`, `service_role`, `postgres://`) | No `exposed` checks; no marker hits |
| Unity WebGL build | `rea audit-release-exposure <Build dir> --json`; `rea inspect-il2cpp-metadata <global-metadata.dat>` if present | No credential markers; no source maps or debug symbols shipped; type and method names reviewed for accidental leaks |

## 4. What REA cannot do here

- It does not recover original Unity C# source from IL2CPP builds. It inventories metadata (type and method names, string literals).
- Static JavaScript analysis does not run code. It can run out of resource budget on large chunks, which leaves coverage incomplete (seen in investigation 001).
- Native function analysis needs a provider that is not installed.

## 5. Report template

```
# NNN — <target>: <question>
- Date / analyst / REA version
- Target and version (path, SHA-256)
- Authorisation and licence
## Question
## Method (commands, evidence ids)
## Architecture / behaviour (diagram)
## Findings
## Limitations and unknowns
## Reuse opportunities
## Independent implementation plan
## Verification (tests in our code)
```
