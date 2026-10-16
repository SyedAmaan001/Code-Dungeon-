"use server";
/**
 * Display preference only (DEC-019): which visual theme to render. Stored in a cookie so the
 * server renders the right theme on the first paint; nothing is written to the game database.
 */
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "@/ui/theme";

export async function setTheme(formData: FormData): Promise<void> {
  const theme = parseTheme(String(formData.get("theme") ?? ""));
  (await cookies()).set(THEME_COOKIE, theme, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
  });
}
