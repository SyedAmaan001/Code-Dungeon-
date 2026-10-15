import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// Self-hosted fonts (SIL Open Font License; docs/ASSETS.md). Latin subsets load on demand.
import "@fontsource-variable/cinzel/wght.css";
import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";
import "@fontsource/alegreya-sans/800.css";
import "@fontsource/alegreya-sans/400-italic.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Code Dungeon", template: "%s · Code Dungeon" },
  description:
    "Learn Python by exploring an illustrated fantasy dungeon: real lessons, server-checked challenges and saved progress.",
};

export const viewport: Viewport = {
  themeColor: "#0e0d11",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
