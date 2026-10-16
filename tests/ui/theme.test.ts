import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme, THEME_LABELS, THEMES } from "@/ui/theme";

describe("theme preference (DEC-019)", () => {
  it("defaults to the approved fantasy theme", () => {
    expect(DEFAULT_THEME).toBe("fantasy");
    expect(parseTheme(undefined)).toBe("fantasy");
    expect(parseTheme(null)).toBe("fantasy");
    expect(parseTheme("")).toBe("fantasy");
  });

  it("accepts only known themes, so a tampered cookie cannot inject a value", () => {
    expect(parseTheme("onyx")).toBe("onyx");
    expect(parseTheme("fantasy")).toBe("fantasy");
    for (const bad of ["Onyx", " onyx", "onyx;", "<script>", "light", "__proto__", "toString"]) {
      expect(parseTheme(bad)).toBe("fantasy");
    }
  });

  it("labels every theme", () => {
    for (const t of THEMES) expect(THEME_LABELS[t].name.length).toBeGreaterThan(0);
  });
});
