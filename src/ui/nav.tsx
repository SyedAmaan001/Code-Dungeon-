"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./art/icons";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/play", label: "Home", icon: "home" },
  { href: "/play/map", label: "Map", icon: "map" },
  { href: "/play/journal", label: "Journal", icon: "journal" },
  { href: "/play/collection", label: "Collection", icon: "collection" },
  { href: "/play/leaderboard", label: "Leaderboard", icon: "trophy" },
];

function isCurrent(pathname: string, href: string) {
  if (href === "/play") return pathname === "/play";
  if (href === "/play/map") return pathname === href || pathname.startsWith("/play/level/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GameNav({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  return (
    <nav
      className={variant === "top" ? "nav nav--top" : "bottomnav"}
      aria-label={variant === "top" ? "Game" : "Game (mobile)"}
    >
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="nav__link"
          aria-current={isCurrent(pathname, l.href) ? "page" : undefined}
        >
          <Icon name={l.icon} size={variant === "top" ? 18 : 22} />
          <span>{l.label}</span>
        </Link>
      ))}
    </nav>
  );
}
