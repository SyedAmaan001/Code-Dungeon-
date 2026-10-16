# Asset provenance and licences

Every visual asset shipped by the app is listed here (CLAUDE.md: record licences and provenance; never copy proprietary art).

| Asset | Location | Origin | Licence |
|---|---|---|---|
| Zone scenes (5), zone emblems, brand mark | `src/ui/art/zone-scene.tsx` | Drawn for Code Dungeon as inline SVG in Phase 5, following the biome descriptions in `docs/VISUAL_DIRECTION.md`. Not traced or derived from the reference images. | Project-owned |
| Reward item illustrations (10) and achievement medallion | `src/ui/art/items.tsx` | Drawn for Code Dungeon in Phase 5 in an outlined, warm-highlight style inspired by the brief; no shapes copied from `docs/visual-references/02_inventory_item_sheet.png`. | Project-owned |
| Interface icons | `src/ui/art/icons.tsx` | Drawn for Code Dungeon in Phase 5 (24×24 line icons). | Project-owned |
| Cinzel (display) | npm `@fontsource-variable/cinzel` 5.3.0 | Natanael Gama, via Fontsource (self-hosted, no runtime requests to Google) | SIL Open Font License 1.1 |
| Alegreya Sans (body) | npm `@fontsource/alegreya-sans` 5.3.0 | Juan Pablo del Peral / Huerta Tipográfica, via Fontsource | SIL Open Font License 1.1 |
| JetBrains Mono (code) | npm `@fontsource-variable/jetbrains-mono` 5.3.0 | JetBrains, via Fontsource | SIL Open Font License 1.1 |
| Bitcount Ink, Bitcount Single (Onyx theme titles, headings, labels) | npm `@fontsource/bitcount-ink` 5.3.0, `@fontsource/bitcount-single` 5.3.0 | Petr van Blokland, via Fontsource; named in the owner's Design.docx | SIL Open Font License 1.1 |
| Inter (Onyx theme reading text) | npm `@fontsource-variable/inter` 5.3.0 | Rasmus Andersson, via Fontsource | SIL Open Font License 1.1 |
| Onyx colour tokens | `src/app/theme-onyx.css` | Original values in the onyx/cobalt family the owner chose; not copied from any brand (DEC-019) | Project-owned |
| shadcn/ui Button | `src/ui/shadcn/button.tsx` | shadcn/ui (new-york style), transcribed by hand | MIT |
| Motion 13.4.6, Lenis 1.3.26, Tailwind CSS 4.3.3, clsx, tailwind-merge, class-variance-authority, @radix-ui/react-slot | npm | Libraries (code, not artwork) | MIT / Apache-2.0 (class-variance-authority) |
| GSAP 3.15.0 | npm | GreenSock (Webflow) | GSAP Standard "no charge" licence (https://gsap.com/standard-license), not OSI open source — R-55 |
| Owner-supplied references | `docs/visual-references/` | Supplied by the owner as mood references only. | Not shipped in the app; not to be copied |

No raster images, third-party icon packs, logos or characters are used.
