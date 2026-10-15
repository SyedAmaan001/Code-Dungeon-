import type { Metadata } from "next";
import { requirePlayer } from "@/auth/server";
import { DungeonMap } from "@/ui/dungeon-map";
import { Icon } from "@/ui/art/icons";
import { loadPlayerView } from "../data";

export const metadata: Metadata = { title: "Dungeon map" };

export default async function MapPage() {
  const player = await requirePlayer();
  const view = await loadPlayerView(player.playerId);
  return (
    <div className="stack-l">
      <header className="stack-s">
        <p className="eyebrow">{view.pathTitle}</p>
        <h1>The dungeon map</h1>
        <p className="muted">
          Complete a room to open the next. Checkpoints <Icon name="flag" size={16} />, major
          encounters <Icon name="swords" size={16} /> and the boss <Icon name="crown" size={16} />{" "}
          are played in runs; a lost run never removes progress.
        </p>
      </header>
      {view.levels.length === 0 ? (
        <div className="frame empty">
          <Icon name="lock" size={32} />
          <p>No levels are released in this build yet.</p>
        </div>
      ) : (
        <DungeonMap view={view} />
      )}
    </div>
  );
}
