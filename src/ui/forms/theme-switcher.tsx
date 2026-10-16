/**
 * Theme choice (DEC-019). A plain form posting to a server action, so it works without
 * JavaScript; the server sets the cookie and re-renders with the chosen theme.
 */
import { setTheme } from "@/app/actions/appearance";
import { Icon } from "@/ui/art/icons";
import { Button } from "@/ui/shadcn/button";
import { THEME_LABELS, THEMES, type Theme } from "@/ui/theme";

export function ThemeSwitcher({ current }: { current: Theme }) {
  return (
    <form action={setTheme} className="stack-s">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
        {THEMES.map((t) => (
          <Button
            key={t}
            type="submit"
            name="theme"
            value={t}
            variant={t === current ? "default" : "outline"}
            aria-pressed={t === current}
          >
            {t === current && <Icon name="check" size={16} />}
            {THEME_LABELS[t].name}
          </Button>
        ))}
      </div>
      <p className="dim">{THEME_LABELS[current].description}</p>
    </form>
  );
}

/** Compact one-click toggle for the top bar, to compare the two themes on any screen. */
export function ThemeToggle({ current }: { current: Theme }) {
  const next: Theme = current === "onyx" ? "fantasy" : "onyx";
  const label = `Switch to the ${THEME_LABELS[next].name} theme`;
  return (
    <form action={setTheme} className="theme-toggle-form">
      <Button
        type="submit"
        name="theme"
        value={next}
        variant="ghost"
        size="icon"
        aria-label={label}
        title={label}
        className="theme-toggle"
      >
        <Icon name="palette" size={18} />
      </Button>
    </form>
  );
}
