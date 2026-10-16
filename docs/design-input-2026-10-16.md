# Design input from the owner (Design.docx, 2026-10-16)

The owner shared `Design.docx` and chose (DEC-019): **preview theme first**, palette family **onyx + cobalt**, libraries **Motion, Tailwind + shadcn/ui, GSAP + Lenis**. The document itself is not committed: it contains text and design tokens copied from third-party websites and documentation. This page records what it contained and what was done with each part.

| Part of the document | What it contained | Outcome |
|---|---|---|
| Fonts | Bitcount Ink (headings) and Bitcount Single (body), with a type scale | **Adopted for Onyx** headings, labels and numbers (OFL, self-hosted via Fontsource). Reading text uses Inter: a pixel face for lesson paragraphs hurts readability. The colour font's palette is recoloured to ivory/cobalt. |
| Colour/type set 1 | Onyx canvas, graphite cards, ivory text, one cobalt action colour; Arcadia fonts (extracted from mercury.com) | **Chosen palette family.** Onyx uses original values in this family (`src/app/theme-onyx.css`), measured for contrast. Arcadia is a paid font: not used. |
| Colour/type set 2 | Light parchment page, ink text, blue accent; PP Mondwest and "af" fonts (from generalintelligencecompany.com) | Not chosen. Paid fonts. |
| Colour/type set 3 | Near-black, chalk text, muted gold strokes; Aeonik and Input fonts (from hyperstudio.org) | Not chosen. Paid fonts. |
| Colour/type set 4 | Black, phosphor-white text, lime accent; Goga and Inter (from modal.com) | Not chosen. Goga is a custom font. |
| Motion | Motion and its AI kit (`npx motion-ai`), GSAP install notes, Lenis, motion-primitives | **Motion, GSAP (ScrollTrigger) and Lenis adopted** for Onyx-only decoration. The AI kit installs agent skills and MCP servers into the developer's tools, not the app: not installed. motion-primitives: not needed yet. |
| Components | shadcn/ui registries (Bklit charts, KokonutUI), a Uiverse CSS loader | **Tailwind v4 + shadcn/ui adopted** (Button so far). Bklit, KokonutUI and the loader: no current use. The shadcn registry is blocked by this cloud environment's network policy, so the Button was added by hand from the upstream source. |
| Redis | "Install Redis from the GitHub repo and work on it" | **Not added.** No job for it yet: rate limiting already runs in PostgreSQL (DEC-016). It would be an extra service with later hosting cost, which needs a purpose and approval. |
| TUI libraries | Python terminal UI libraries (Textual, Rich, urwid, …) | Not applicable: Code Dungeon runs in the browser. Could matter for a future terminal edition. |
