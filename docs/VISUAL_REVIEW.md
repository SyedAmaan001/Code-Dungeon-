# Visual review checklist (Phase 6)

Use this to review the interface on real devices before any public release. Automated checks already cover part of it (marked **auto**); the rest needs a person's eyes. Screenshots from the Phase 6 review were sent with the hand-off (desktop 1360, landscape tablet 1024, portrait tablet 820, phone 390) and can be re-created with the dev server and a seeded player (`scripts/e2e/seed.ts`).

## Every screen
- [ ] Dark-fantasy identity holds: charcoal/stone surfaces, restrained gold, no generic dashboard cards, no heavy glow.
- [ ] One clear primary action per view (gold button).
- [ ] Text is readable at arm's length; nothing important relies on colour alone. **auto (axe):** no serious/critical WCAG 2.1 A/AA issues on landing, sign-in and nine game views.
- [ ] Keyboard only: skip link, visible gold focus ring, every control reachable, tabs operable with arrow keys.
- [ ] No horizontal scrolling. **auto:** all game screens and all 25 rooms at 390px; rooms 1/10/25 at 820px and 1024px.
- [ ] Reduced motion: no pulsing, flicker or rise animations. **auto** for the map seal.
- [ ] No console errors or failed requests. **auto:** every e2e test fails on them.

## Dungeon map
- [ ] Locked, open, in-progress, complete and mastered rooms are distinguishable without reading the legend; the legend explains them.
- [ ] Checkpoint (double ring), major encounter (ember ring) and boss (large ember-and-gold ring) stand out; won encounters show a gold badge.
- [ ] Zone progress meters match the "n of m complete" text.
- [ ] Phone: the vertical trail alternates sides and stays inside the screen.

## Level room
- [ ] Lesson code keeps its indentation; `>=`, `!=` and `->` look exactly as typed. **auto** for indentation and ligatures.
- [ ] Progress strip (required challenges, XP here, mastery) matches what happened.
- [ ] Each challenge format is usable with mouse, keyboard and touch; ordering works with the arrow buttons.
- [ ] Feedback is announced and easy to tell apart (correct / not quite / not counted / error with Retry).
- [ ] Hints reveal one at a time and say what they cost (no XP or lives; affects flawless and mastery).
- [ ] Encounter panel: lives, run number, defeat message ("progress and XP are kept"), victory.
- [ ] Laptop (≥ 900px wide): challenge column beside the lesson; on tall screens it stays visible while reading.

## Journal, collection, leaderboard, profile
- [ ] Quests show objectives with progress counts; rewards say "keepsake, no XP".
- [ ] Unearned keepsakes and achievements read as silhouettes with their requirement.
- [ ] Leaderboard explains the ranking and shows the viewer's place or why they are not ranked.
- [ ] Profile: visibility toggle saves; delete-account section is clearly separated, needs the exact handle, and the button stays disabled until both confirmations are given.

## States
- [ ] Loading skeletons look like the page they replace.
- [ ] Empty states (no quests yet, no keepsakes, nobody ranked) explain what to do next.
- [ ] Offline notice appears when the connection drops; Retry works after reconnecting. **auto**.
- [ ] Error pages say progress is safe and offer a way on.
