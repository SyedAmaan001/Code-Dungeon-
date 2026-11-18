# Reverse-engineering investigations

Method, rules and template: `docs/REVERSE_ENGINEERING_METHOD.md`. Only owned, open-source or explicitly authorised targets are allowed. Evidence JSON stays outside the repository; reports keep the evidence ids and hashes.

| # | Target | Question | Status |
|---|---|---|---|
| 001 | Code Dungeon client bundle (`.next/static`, `b8433c5`) | Do answer keys or secrets ship to the browser? | Done: none observed (with stated limits) |
| 002 | Code Dungeon Unity WebGL build (Overgrown Gate) | Same release-exposure check, plus an IL2CPP metadata review | Planned (after slice phase U5) |
| 003 | Chop Chop (UnityTechnologies/open-project-1, Apache-2.0; DOTween excluded) | How its scene-loading and SO event-channel architecture behaves in a build | Optional. The source is readable, so read the code first and use REA only if a build-time question remains |
