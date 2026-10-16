import "server-only";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, type Theme } from "@/ui/theme";

/** The theme to render for this request, from the preference cookie (DEC-019). */
export async function currentTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
