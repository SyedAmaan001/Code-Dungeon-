# Code Dungeon — Unity world reference board

- **Status:** a working board, 18 November 2026. It sets **direction, not final design.** The colour system, character design and biome palettes are **not locked**; the owner reviews them after the U4 look-development pass (`docs/UNITY_INTEGRATION_PLAN.md`).
- **Rule:** references teach *techniques* such as composition, lighting, readability and pacing. Never copy assets, characters, logos, layouts, story or lore from any reference. The owner's mood images in `docs/visual-references/` are not shipped and not traced (`docs/ASSETS.md`).

## 1. Creative pillars (from the owner's brief)

1. **A hybrid cinematic RPG.** You explore true 3D spaces, framed by deliberate camera moments, and then step into clean, focused learning rooms.
2. **Ancient forgotten kingdoms.** Gothic architecture, ruined magical academies, arcane mysteries.
3. **Environmental storytelling over exposition.** The world explains itself through ruins, inscriptions, light and silhouettes.
4. **Readable first.** Learning surfaces stay modern, calm and legible (DOM UI). The world is atmosphere and orientation, never a barrier to the lesson.

These carry on from `docs/VISUAL_DIRECTION.md`: an illustrated fantasy look, distinct biomes, gold/teal/earth accents, restrained ornament, not generic SaaS and not only pixel art.

## 2. The Overgrown Gate: mood targets

| Aspect | Target | Technique to learn | Where to study it (allowed sources) |
|---|---|---|---|
| Time of day | Late afternoon, low sun behind the citadel; long shadows across the road | Baked directional light, light probes, warm/cool split | Unity URP template scenes and the URP manual (Lighting) |
| Fog | Layered: ground mist in hollows, a distance haze that silhouettes the citadel | Exponential fog + height-fog shader + fog cards | Unity Graphics repo (URP source) for how fog keywords work; Shader Graph samples |
| Composition | The road leads the eye: spawn → broken arch → gate → citadel on the horizon | Leading lines; three depth planes; landmark visibility | Level-design skill (`level-design`); Chop Chop's scene layout (study only) |
| Architecture | Weathered stone, ivy, collapsed tracery, one intact monumental gate | Modular kit, trim sheets, vertex-painted moss | Original kit; ProBuilder for the blockout |
| Accent light | One warm brazier at the gate, teal sigil glow in the gate (provisional palette) | Emissive + bloom (URP post-processing) | `urp-postprocessing` skill |
| Camera | Calm orbital follow; one slow reveal blend when approaching the gate | Cinemachine 3 blends, dolly track for the reveal | Cinemachine samples (in the package, UCL) |
| Sound (later) | Wind, distant bells, birds; silence before the gate opens | Audio mixer snapshots | `audio-design` skill |

## 3. Provisional palette (not approved)

Use these for the grey box and the first lighting pass only, taken from the existing illustrated theme so the 2D and 3D worlds start out related:

| Role | Direction |
|---|---|
| Stone | Warm grey-beige, desaturated |
| Foliage | Muted olive and moss, never saturated green |
| Accent: gold | Brazier light, gilded gate edges |
| Accent: teal | Sigil glow; "available" level markers |
| Sky and fog | Pale amber near the sun, blue-grey in shadow |

The owner decides the final values after U4. Record any change in `docs/decision.md`.

## 4. Readability rules carried into 3D

- An **available** level must read from 20 m away: a lit brazier, an open or glowing gate, a teal sigil. A **locked** level is dark and sealed. A **completed** one is warm and calm. A **mastered** one has gold detail. (Presentation of the server's status only.)
- Interaction prompts are DOM-like UI in Unity (UI Toolkit), high contrast, at least 16 px equivalent.
- No meaning is carried by colour alone; shape changes too (a sealed vs. an open gate).

## 5. Explicitly avoided

- Copying the look or layout of any commercial game, anime, manhwa or web novel (including *Omniscient Reader's Viewpoint* and *Shadow Slave*). Broad techniques only: a mysterious tutorial "gate", a world that reacts to the player's progress.
- Photoreal HDRP looks: they don't fit web targets or the illustrated direction.
- Store-bought "fantasy village" packs used as they are: they make the world look generic.
