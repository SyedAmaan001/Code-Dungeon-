# Code Dungeon design system (Phase 5)

- **Status:** implemented in `src/app/globals.css` and `src/ui/`. It follows `docs/VISUAL_DIRECTION.md` and is ready for the owner's review of one representative slice (map, room, challenge) before any larger art investment (P-006).
- **Principle:** a premium dark-fantasy game surface that never gets in the way of learning. Atmosphere lives in zone scenes, frames and type; the work area (lesson, code, challenge) is calm, high-contrast and stable.

## 1. Tokens

| Group | Tokens | Notes |
|---|---|---|
| Surfaces | `--night-0` #0e0d11, `--night-1` #15141a, `--surface-1` #1c1a21, `--surface-2` #24212a, `--surface-3` #2e2a34 | Deep charcoal and stone, never flat black; a faint noise texture and two distant glows sit behind the page |
| Lines | `--line`, `--line-strong`, `--line-gold` | One border per surface; gold hairlines only on framed panels |
| Text | `--parchment` #f2ebdd, `--parchment-muted` #c7bead, `--parchment-dim` #9c9385 | |
| Accents | `--gold` / `--gold-bright` / `--gold-deep` (rewards, progress, primary actions), `--ember` (encounters, lives), `--teal` (current room, focus of play, hints), `--moss`, `--violet`, `--success`, `--danger` | Restrained: gold marks progress and the one primary action per view |
| Zone accent | `--zone-accent`, set by `data-zone="<themeKey>"` | moss (Overgrown Gate), ember (Ember Hall), teal (Sigil Sanctum), amber (Rootbound Deep), bright gold (World-Tree Citadel) |
| Type | `--font-display` Cinzel (titles, eyebrows, numerals only), `--font-body` Alegreya Sans (all reading text and UI), `--font-mono` JetBrains Mono (code) | Display face is never used for paragraphs |
| Scale | `--text-xs` … `--text-3xl` (fluid for headings), spacing `--s-1` … `--s-8` (4px base), radii 6/10/16px | |
| Interaction | `--ring` (2px gap + 2px bright-gold ring), `--ease` | Visible focus on every interactive element |

## 2. Measured contrast (WCAG 2.1, computed from the tokens)

| Foreground | on night-0 | on surface-1 | on surface-2 |
|---|---|---|---|
| parchment | 16.3 | 14.5 | 13.4 |
| parchment-muted | 10.5 | 9.3 | 8.6 |
| parchment-dim (hints, captions) | 6.4 | 5.7 | 5.2 |
| gold-bright | 12.9 | 11.5 | 10.5 |
| teal | 10.4 | 9.3 | 8.5 |
| success / danger | 10.8 / 8.3 | 9.6 / 7.4 | 8.8 / 6.8 |
| primary button text #1f150a on its gold gradient | 7.0 – 11.0 | | |

All text pairs pass AA (4.5:1). The locked-room numeral (#6e6676, 3.1–3.5:1) is decorative, large bold text and hidden from assistive technology; the room's state is carried by the "Locked" label and lock icon. The axe scan in `e2e/game.spec.ts` checks every main screen for serious and critical WCAG 2.1 A/AA violations.

## 3. Components (`src/ui/`)

| Component | Purpose |
|---|---|
| `GameNav` | Top navigation on wide screens; fixed bottom tab bar under 860px; `aria-current` on the active section |
| `DungeonMap` | Zones in order, each with a scene banner and a trail of rooms; data-driven for any number of zones/levels; zig-zag row on desktop, alternating vertical trail on phones |
| `ZoneScene`, `ZoneEmblem`, `BrandMark` | Original SVG scenes and marks (see `docs/ASSETS.md`) |
| Level room (`ChallengePanel`, `AnswerInput`) | Tabbed challenges (arrow keys, Home/End), one control set per format, live feedback region, progressive hints, encounter-run awareness |
| `QuestCard`, collection shelf, `Medallion`, `ItemArt` | Journal and collection |
| Forms (`ProfileForm`, `OnboardingForm`, `MagicLinkForm`, `DevSignInForm`) | `useActionState` server-action forms with inline errors |
| Primitives (CSS) | `.frame` (+ `--ornate` corner ticks), `.btn` (`--primary`, `--ghost`, `--lg`), `.badge` variants, `.meter`, `.ledger`, `.notice-box`, `.banner`, `.empty`, `.skeleton` |

## 4. States and feedback

- Room states: locked (dashed seal + lock + "Locked"), open (teal ring that slowly beckons), in progress (teal + spark), complete (gold seal + check), mastered (gold seal with a bright halo and a gold star badge). Encounter rooms (Phase 6) carry an outer ring and a kind tag above the title: checkpoint = double moss ring, major = ember ring, boss = larger seal with an ember ring and a gold outer line; a won encounter turns its kind badge gold. Each room shows one status word. A collapsible legend on the map explains all of it.
- Level room (Phase 6): a progress strip under the header shows required challenges solved, XP earned of the level's maximum, and mastery; error feedback offers Retry; an offline notice appears when the connection drops.
- Feedback: correct (check, green border, explanation), not quite (cross, warm-red border, targeted hint text), not counted / not sent / signed out / slow down / error — each with an icon and a sentence, never colour alone.
- Loading skeletons, empty states (no quests, no items, no ranked players, no released levels), sealed-room page, not-found and error boundaries.

## 5. Motion and accessibility

- Motion is decorative only: torch flicker and sigil pulse in scenes, the open room's beckon, feedback/hint rise-in. `prefers-reduced-motion: reduce` stops all of it (checked in e2e). `forced-colors` gives frames, buttons, options and seals a system border.
- Keyboard: skip link, visible focus ring, tablist keyboard model, order-the-lines uses move-up/down buttons (no drag required), radio/checkbox inputs for choices and lines.
- Screen readers: landmarks, one `h1` per page, labelled regions, `role="status"`/`aria-live` for feedback and hints, `sr-only` text for state that is otherwise shown by icons, progress bar values.
- Code fidelity: ligatures are disabled for code, `pre`, textareas and inputs, so `>=`, `!=` and `->` appear exactly as typed; lesson fences render as indented code blocks.
- Responsive: 16px gutters, no horizontal scrolling at 390px (checked in e2e), bottom navigation with safe-area padding, "Jump to challenges" link when the lesson and challenges stack.

## 6. Themes and styling infrastructure (DEC-019)

- **Themes:** `<html data-theme="fantasy|onyx">`, set by the server from the `cd_theme` preference cookie (`src/ui/theme.ts`, `src/ui/current-theme.ts`). Fantasy (§1–5) is the approved default. Switch: Profile › Appearance (shadcn Buttons with `aria-pressed`) and a top-bar toggle on screens ≥ 640px.
- **Stylesheet entry** `src/app/app.css`, in cascade layers: `base` = `globals.css` (this design system, unchanged) < `components` = `theme-onyx.css` (every rule scoped to `[data-theme="onyx"]`) < `utilities` = Tailwind v4. Tailwind's preflight and default theme are not loaded; a small `@theme` maps utility tokens (`bg-primary`, `text-sm`, `rounded-md`, `font-heading`, …) onto the design-system variables, so utilities follow the active theme. Never give a Tailwind theme key the same name as a design-system variable (it would refer to itself).
- **shadcn/ui:** `components.json` places components in `src/ui/shadcn/`, helper `cn()` in `src/ui/cn.ts`. Because there is no preflight, `[data-slot]` elements get the resets shadcn relies on. Semantic roles: `--primary-fill`, `--primary-ink`, `--focus-color`.
- **Fantasy unchanged:** a pixel comparison of 20 screenshots (5 screens × 4 widths) before and after the infrastructure showed no difference beyond the new switch (under 0.01% animation-timing noise).

## 7. Onyx preview theme

| Group | Tokens |
|---|---|
| Surfaces | canvas `#14141d`, `#191924`, card `#1d1d29`, `#242432`, `#2c2c3c`; lines `#2f2f40` / `#4b4b5e`; faint dot grid and a cobalt glow behind the page |
| Text | ivory `#ececf3`, muted `#c4c4ce`, dim `#a8a8b8` |
| Action | cobalt `#4f5fe6` fill with white text (hover `#4555d8`); cobalt text `#8d9bff` / `#b4bdff` for progress and links |
| Semantic | cyan `#6ccbe2` (current room, hints), ember `#f29a6b` (encounters), success `#7ed9a6`, danger `#f3958a`; zone accents kept for orientation |
| Type | Bitcount Ink for page titles (colour font recoloured with `@font-palette-values --onyx`), Bitcount Single for section headings, eyebrows, badges, tabs and numbers, Inter for all reading text and buttons, JetBrains Mono for code |
| Shape | radii 4/8/12px; room seals are rounded squares; ornate frame corners removed |
| Scenes | the illustrated zone scenes stay but recede (desaturated, 55% opacity) behind a 24px grid tinted with the zone accent |

Measured contrast (WCAG 2.1):

| Foreground | on canvas | on card | on surface-2 |
|---|---|---|---|
| ivory `#ececf3` | 15.6 | 14.2 | 13.0 |
| muted `#c4c4ce` | 10.6 | 9.6 | 8.8 |
| dim `#a8a8b8` | 7.8 | 7.1 | 6.5 |
| cobalt text `#8d9bff` | 7.2 | 6.6 | 6.0 |
| cobalt bright `#b4bdff` | 10.2 | 9.3 | 8.5 |
| cyan `#6ccbe2` | 9.8 | 9.0 | 8.2 |
| success / danger | 10.8 / 8.3 | 9.8 / 7.5 | 9.0 / 6.9 |
| ember `#f29a6b` | 8.4 | 7.6 | 7.0 |

White on cobalt 5.1 (hover 5.9); locked numerals `#85859c` on their seal 4.95; code line numbers 5.7. The axe scan passes (no serious/critical issues) on every game screen, all 25 rooms, the public pages and with feedback shown.

**Motion (Onyx only, `src/ui/onyx-motion.tsx`):** Lenis smooth wheel scrolling; GSAP ScrollTrigger reveals each zone and draws its trail (`--trail`); Motion springs in map rooms, the level room, feedback and hints. Libraries load on demand (the Fantasy theme downloads none of them) and nothing runs under `prefers-reduced-motion: reduce`. All content is in the page from the first render; map zones below the fold fade in as they scroll into view. Animations always end at full opacity with no transform, and scrolling to the end reveals every zone (both asserted in e2e).
