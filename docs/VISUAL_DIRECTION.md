# Code Dungeon — Visual Direction

**Status:** Initial visual brief based on owner-supplied references (13 October 2026). Treat as a direction to prototype and validate—not a final, immutable design system.

## The visual thesis

Code Dungeon should feel like entering a distinctive illustrated fantasy world with deliberate art direction and a polished, usable game interface. The product should not look like a generic SaaS dashboard, nor should it be constrained to a purely old-school pixel-art aesthetic. Blend atmospheric environment art, hand-illustrated reward/quest icons, carefully framed UI surfaces, restrained ornament and clear contemporary typography.

The world art can be painterly and dimensional. Some pixel texture or tile language may be used selectively when it improves the design, but should not define every screen. The main product surface is the playable map and rooms; a marketing homepage is only a doorway into that world.

## What the references communicate

### 1. Five-scene dungeon strip

The owner-supplied image shows five stacked environments:

1. An overgrown graveyard/gate with leaning monuments, misty green light and weathered stone.
2. A ruined stone hall with columns and a vivid orange fire basin.
3. A sanctum with a large glowing central sigil and banners in distinct colors.
4. A dark cavern with stone arches, roots and a warm distant opening.
5. A monumental, twisted world tree framed by old colonnades and golden sunset light.

**Use:** distinct, memorable environments; progression communicated by silhouettes, lighting and increasingly significant landmarks; a five-zone map with five levels per launch zone.

### 2. Illustrated item sheet

The owner-supplied sheet includes rings, goggles, bags, potions, books, belts, keys and unusual tools in a hand-drawn, strongly outlined style with warm highlights.

**Use:** consistent quest-object icons, achievement art, loot/reward illustrations and possible future inventory art. For the MVP, item illustrations are rewards and identity—not a reason to build an extensive equipment economy. Only make items functionally affect gameplay when there is an explicit rule and a tested reason.

### 3. Fantasy-game website layout

The reference uses textured dark framing, ornate gold/ivory display typography, teal cinematic artwork, navigational elements and gameplay imagery contained in visual frames.

**Use:** high-level presentation rhythm, strong brand typography, contrast between immersive art and clean explanations, story-led composition. Do not copy the source's name/logo, characters, cards, assets, exact screen design or distinctive layouts.

### 4. Painterly environment references

The additional concepts show sunlit desert ruins, a luminous underwater/whale scene, monumental architecture, ice and snow, misty mountains, underwater ruins, cyan forest, glowing green woodland and warm golden forest.

**Use:** a vocabulary for later content packs and future areas. They communicate varied atmosphere and color, not a demand to create every biome now. The launch should feel complete with five cohesive zones; future biomes can be added once the core loop works.

## The first five visual zones

Keep the curriculum zone names, and treat the following as optional in-world names for visual identity.

| Levels | Curriculum zone | Visual identity | Palette / lighting cue |
|---|---|---|---|
| 1–5 | Adventurer's Camp | **The Overgrown Gate** — mossy graveyard, broken gate, leaning stones, dawn mist and a readable path forward | Muted moss, slate, weathered gray-green; small warm lantern/gold focal points |
| 6–10 | Branching Caverns | **The Ember Hall** — ancient stone hall, columns, cracked masonry and a fire basin | Deep plum/charcoal stone, ember orange, warm gold against shadow |
| 11–15 | Function Forge | **The Sigil Sanctum** — central luminous glyph, structured stonework and differently colored banners | Teal/cyan, moss green, restrained violet and gold; bright focal point |
| 16–20 | Archive of Structures | **The Rootbound Deep** — layered arches, ancient records, roots and lantern-lit passages | Dark earth/umber, charcoal, moss and selective amber; emphasize hidden connections |
| 21–25 | Runtime Citadel | **The World-Tree Citadel** — a monumental tree, ruined colonnade, sunset sky and a final ascent | Warm sunset gold, dark bark/stone, touches of teal/green magic |

The art titles can change later without changing course IDs, level IDs or progression logic. Curriculum structure and world illustration should not be coupled in code.

## Shared design language

- **Backgrounds:** deep charcoal, near-night plum, or dark umber rather than flat pure black. Use environmental art as atmosphere, not as a noisy wallpaper under every paragraph.
- **Frames and panels:** restrained stone, carved wood or antique-brass framing; use ornament sparingly. Avoid excessive borders and competing card outlines.
- **Accent colors:** antique gold for rewards/progression; ember amber for fire and key success moments; teal/cyan for magic and focus; moss green for natural areas; violet for shadow; ice blue as a future zone accent.
- **Typography:** a distinctive serif or otherwise characterful display face for limited titles; a highly legible UI sans-serif for labels, lesson text and menus; monospace for code. Do not use ornate typography for long explanations.
- **Illustration:** consistent lighting direction, perspective, edge treatment, palette and relative scale. Avoid mixing uncoordinated clip-art or icon packs.
- **Map:** clear connected paths, visible current/completed/locked states, room labels, quest markers and five visually differentiated launch zones. On desktop, allow an immersive landscape map; on mobile, provide a deliberate compact or vertical progression rather than shrinking the entire desktop map.
- **Items/rewards:** consistent icon silhouettes and highlights. Reward names, value and purpose should be apparent. Don't let decorative loot create fake or opaque game rules.
- **Motion:** subtle torch/fire flicker, leaves, drifting dust or rune glow only when performant; transitions should communicate feedback; respect `prefers-reduced-motion` and provide a usable static state.
- **Sound:** optional, nonessential and easy to mute; gameplay must work silently.

Suggested initial color tokens (starting points only; test accessibility and adjust):

```css
:root {
  --world-night: #17171D;
  --panel-obsidian: #27232B;
  --panel-stone: #37333A;
  --text-parchment: #F2EBDD;
  --text-muted: #BDB5A7;
  --quest-gold: #D7B46A;
  --ember-amber: #F08A46;
  --magic-teal: #44C9C2;
  --moss-green: #829C76;
  --rune-violet: #9B82CF;
  --ice-blue: #8BD6F0;
}
```

These tokens are not an excuse to rely on color alone. Completed/current/locked/error/success states need icons, labels, shape or text in addition to color. Test contrast, code legibility and focus visibility.

## Screen-level direction

1. **Entry/home:** one bold atmospheric world image, a clear “continue your quest” action, a compact account/progress summary and a route to the map. Do not build a long marketing site in place of the app.
2. **World map:** the main navigational hub. It shows five zones, 25 meaningful nodes, paths, progress states and a clear selected room. Avoid a plain grid of identical cards.
3. **Room/lesson:** the environment establishes mood, while a well-structured foreground panel presents the learning objective, concise explanation, worked example and next action.
4. **Challenge:** clarity wins. The prompt and answer controls/code editor need a stable readable surface, visible submit state, hints and keyboard support. Keep ambient art/animation behind the work area.
5. **Feedback/victory:** state whether the response was correct, explain why, identify common mistakes, show XP/quest progress and give the next useful step. Rewards should feel good without hiding the learning.
6. **Quest journal:** clear objective steps, completion markers, rewards and prerequisites; no invented objectives or dead buttons.
7. **Player/profile/leaderboard:** use the same world language, but prioritize readable data, actual persistent progress and honest scoring rules.

## Boundaries and acceptance criteria

- Original art or assets with documented licenses only. Never copy the game website's logo, characters, cards, proprietary illustrations or exact UI.
- A large cinematic 3D world is not required. Start with a responsive web app, optimized 2D backdrops, CSS/SVG overlays and lightweight components; add heavier rendering only when justified by the experience.
- Any ambient art must have a fallback and must not block rendering or interaction.
- No fake player counts, fake leaderboards, fake code execution or decorative buttons that imply nonexistent features.
- The complete 25-level learning loop must be usable and readable before spending time on large amounts of artwork.
- Ask the owner to review one representative map/room/challenge slice before generating a large asset set.
