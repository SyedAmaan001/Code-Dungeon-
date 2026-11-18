# 001 — Code Dungeon client bundle: what does the browser receive?

- **Date:** 18 November 2026. Claude Code cloud session, REA 6.9.0 (`rea-agents`), Node 22.23.5.
- **Target:** Code Dungeon's own production client bundle, `.next/static` from `npx next build` at commit `b8433c5` (branch `claude/tender-cerf-ooekni`). 24 files, 2.5 MB. REA root artefact SHA-256 `cd4f1806946a6dd6615da86cb2e5abd9fb4b7a8cf8244713557c75c9bad66f64`.
- **Authorisation and licence:** we own the target. No third-party code was examined beyond the npm libraries bundled into our own build.

## Question

Does the shipped browser bundle contain answer keys, unrevealed explanations, server credentials or other server-only data? `docs/API_CONTRACTS.md` §1 claims that answer keys never leave the server. This also rehearses the release check every future Unity WebGL build must pass.

## Method

| Step | Command | Evidence |
|---|---|---|
| Static application graph | `rea analyze-javascript-application .next/static --json` | `ev_1b327cb7a631a70b1accf50319e8e4259ea3cb3b3fae5ac26073d3c7760df1bc` (provider `rea-javascript-application` v1, confidence `derived`) |
| Release-exposure audit | `rea audit-release-exposure .next/static --json` | `ev_50e6098361d37980ac9a08143032bef9c9af262cf6983b5bf69421564771b974` |
| Full-text cross-check | `grep -rl` for `answerKey`, `acceptedOutputs`, `"accepted"`, `SUPABASE_SECRET`, `DATABASE_URL`, `service_role`, `postgres://`, `explanation` | Counts below |

Evidence JSON was kept in the session scratchpad, not in the repository.

## Architecture (as relevant)

```
server (Node)                                   browser (.next/static)
 content YAML ─► learning engine ─► projection.ts ─► PublicLevel (whitelist) ─► React room UI
   answer keys stay in keys.ts (server-only)        explanation only in LevelResult after a correct answer
```

## Findings

| Check | Result |
|---|---|
| REA exposure audit summary | `exposed: 0`, `not_observed: 3` (`packaging.extractable_payload`, `native.debug_companions`, `text.credential_markers`), `unknown: 6` (source-map and Electron checks that don't apply cleanly to a web bundle), `not_applicable: 3`, `not_assessed: 3`; `no_exposure_observed_in_assessed_checks: true` |
| REA application summary | 23 of 24 JavaScript files parsed, 0 parse failures, 229,874 AST nodes visited, 0 Electron/IPC surfaces |
| `answerKey`, `acceptedOutputs`, `"accepted"` | 0 files |
| `SUPABASE_SECRET`, `DATABASE_URL`, `service_role`, `postgres://` | 0 files |
| `explanation` | 2 files. Both are **rendering code only**: the CSS class `.feedback__explanation` and the JSX that prints `result.explanation` *after the server returns it*. No lesson text |

**Conclusion:** the evidence agrees with the documented contract. No answer keys, credentials or connection strings were observed in the shipped client bundle at `b8433c5`.

## Limitations and unknowns

- REA's semantic graph was **incomplete**: 10 or more chunks hit resource budgets ("Semantic graph … exceeds the parent's remaining re[source budget]", one chunk exhausted a 1,024 MiB worker heap). Its own words: *"Graph coverage is incomplete; unavailable facts remain explicit and must not be read as absence."* The full-text search covers every file, so the marker conclusion rests on both.
- The code was parsed as inert text and never executed. Runtime responses (the RSC payload of a signed-in page) were **not** captured. Those are protected by the server-side projection and its tests (`tests/learning/projection.test.ts`), not by this check.
- A text search only finds known markers. A new secret with a different name would need the credential-marker heuristics (REA reported `not_observed`).

## Reuse opportunities

None needed. This is a tooling procedure, and it becomes the release check in `docs/REVERSE_ENGINEERING_METHOD.md` §3.

## Independent implementation plan

Turn the check into a script (backlog T-14): `npm run release:audit` builds, runs REA when it is installed, and always runs the marker search. It fails on any hit. Apply the same script to the Unity WebGL build directory.

## Verification

Repeat the commands above on the same commit and compare the root SHA-256 and the counts. The existing projection tests remain the primary guarantee.
