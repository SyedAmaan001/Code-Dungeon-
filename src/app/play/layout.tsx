import Link from "next/link";
import type { ReactNode } from "react";
import { getSession, requirePlayer } from "@/auth/server";
import { Icon } from "@/ui/art/icons";
import { BrandMark } from "@/ui/art/zone-scene";
import { formatXp } from "@/ui/labels";
import { GameNav } from "@/ui/nav";
import { OfflineNotice } from "@/ui/offline-notice";
import { loadPlayerView } from "./data";

export const dynamic = "force-dynamic";

export default async function PlayLayout({ children }: { children: ReactNode }) {
  const player = await requirePlayer();
  const [session, view] = await Promise.all([getSession(), loadPlayerView(player.playerId)]);
  const devMode = session.config.mode === "dev";

  return (
    <>
      {devMode && (
        <p className="dev-banner" role="note">
          Development sign-in: local testing only. Not available in production builds.
        </p>
      )}
      <header className="topbar">
        <div className="topbar__inner">
          <Link href="/play" className="brand">
            <BrandMark size={30} />
            <span>Code Dungeon</span>
          </Link>
          <GameNav variant="top" />
          <div className="topbar__end">
            <span className="xp-chip" title="Lifetime XP">
              <Icon name="gem" size={16} />
              <span>
                {formatXp(view.totalXp)}
                <span className="sr-only"> experience points</span>
                <span aria-hidden="true"> XP</span>
              </span>
            </span>
            <Link
              href="/play/profile"
              className="nav__link"
              aria-label={`Profile: ${player.handle}`}
            >
              <Icon name="user" size={18} />
              <span className="sr-only">Profile</span>
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="page">
        <OfflineNotice />
        {children}
      </main>
      <GameNav variant="bottom" />
    </>
  );
}
