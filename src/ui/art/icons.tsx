/**
 * Interface icons: original 24×24 line drawings (asset provenance: drawn for Code Dungeon,
 * docs/ASSETS.md). Decorative by default (aria-hidden); pair with visible text.
 */
import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "map"
  | "journal"
  | "collection"
  | "trophy"
  | "user"
  | "check"
  | "lock"
  | "flag"
  | "swords"
  | "crown"
  | "heart"
  | "heart-empty"
  | "lantern"
  | "gem"
  | "star"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "scroll"
  | "alert"
  | "info"
  | "x"
  | "spark"
  | "eye-off"
  | "palette";

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10v9h11v-9" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  map: (
    <>
      <path d="m3.5 6.5 5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  journal: (
    <>
      <path d="M6 4h11a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Z" />
      <path d="M5 17.5A1.5 1.5 0 0 1 6.5 16H18M9 8h6M9 11h4" />
    </>
  ),
  collection: (
    <>
      <path d="M5 9h14l-1.2 10H6.2z" />
      <path d="M8 9V7a4 4 0 0 1 8 0v2" />
      <path d="M10 13h4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9" rx="1.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14v2.5" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 5h11l-2.5 3.5L17 12H6" />
    </>
  ),
  swords: (
    <>
      <path d="m4 4 9.5 9.5M4 4h3.5L15 11.5M4 4v3.5l7.5 7.5" />
      <path d="M20 4 13 11M20 4h-3M20 4v3M14.5 15.5l4 4M17 14l-3 3M7 17l-2 2M9.5 14.5 6.5 17.5" />
    </>
  ),
  crown: (
    <>
      <path d="m4 8 4 4 4-6 4 6 4-4-1.5 10h-13z" />
      <path d="M6 20h12" />
    </>
  ),
  heart: (
    <path
      d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
      fill="currentColor"
    />
  ),
  "heart-empty": <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  lantern: (
    <>
      <path d="M9 6h6M10 4h4M8.5 6h7l1 3v8l-1 3h-7l-1-3V9z" />
      <path d="M12 10.5c1.2 1.3 1.2 2.7 0 4-1.2-1.3-1.2-2.7 0-4Z" fill="currentColor" />
    </>
  ),
  gem: (
    <>
      <path d="M7 5h10l3 4.5L12 20 4 9.5z" />
      <path d="M4 9.5h16M9.5 5 8 9.5l4 10.5 4-10.5L14.5 5" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.3.6-3.9 3.7 1 5.3L12 16l-4.8 2.6 1-5.3-3.9-3.7 5.3-.6z" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  "arrow-up": <path d="M12 19V5M6 11l6-6 6 6" />,
  "arrow-down": <path d="M12 5v14M6 13l6 6 6-6" />,
  scroll: (
    <>
      <path d="M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1z" />
      <path d="M7 16h8M10 8h5M10 11.5h5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 21 19H3z" />
      <path d="M12 10v4M12 16.5v.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8v.5" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  spark: <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />,
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.6 0-1.2-1-1.5-1-2.6 0-1 .8-1.6 1.8-1.6h2.2a3.7 3.7 0 0 0 3.7-3.8C20.5 6.9 16.7 3.5 12 3.5z" />
      <circle cx="7.6" cy="11.2" r="1" />
      <circle cx="10.4" cy="7.4" r="1" />
      <circle cx="15" cy="7.6" r="1" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 8.5 4.5 9 6-.3.9-1.4 2.6-3.2 4M6.4 7.6C4.4 9 3.3 10.9 3 12c.5 1.5 4 6 9 6 1.6 0 3-.4 4.2-1" />
      <path d="M9.9 10a3 3 0 0 0 4.2 4.1" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  title,
  ...rest
}: { name: IconName; size?: number; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}
