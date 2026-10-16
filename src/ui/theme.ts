/**
 * Visual themes (DEC-019). "fantasy" is the approved art direction and the default; "onyx" is a
 * preview built from the owner's Design.docx so the two can be compared on the same screens.
 * The choice is a display preference only: it is stored in a cookie, never in the game database,
 * and it changes no game rule.
 */
export const THEMES = ["fantasy", "onyx"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "fantasy";
export const THEME_COOKIE = "cd_theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEME_LABELS: Record<Theme, { name: string; description: string }> = {
  fantasy: {
    name: "Fantasy",
    description: "The illustrated dungeon: stone, gold and torchlight.",
  },
  onyx: {
    name: "Onyx (preview)",
    description: "A calm onyx-and-cobalt interface with pixel display type and smooth motion.",
  },
};

/** Any unknown, missing or tampered value falls back to the default theme. */
export function parseTheme(value: string | undefined | null): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : DEFAULT_THEME;
}
