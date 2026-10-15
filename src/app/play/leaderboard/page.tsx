import type { Metadata } from "next";
import Link from "next/link";
import { requirePlayer } from "@/auth/server";
import { getRuntime } from "@/services/runtime";
import { Icon } from "@/ui/art/icons";
import { formatXp } from "@/ui/labels";

export const metadata: Metadata = { title: "Leaderboard" };

const UNRANKED: Record<string, string> = {
  hidden: "You are hidden from the leaderboard. You can change this in your profile.",
  no_xp: "Earn your first XP to appear on the leaderboard.",
  unknown: "You are not on the leaderboard yet.",
};

export default async function LeaderboardPage() {
  const player = await requirePlayer();
  const board = await getRuntime().game.leaderboard(player.playerId, { limit: 50 });

  return (
    <div className="stack-l">
      <header className="stack-s">
        <p className="eyebrow">Lifetime XP</p>
        <h1>Leaderboard</h1>
        <p className="muted">
          Ranked by verified lifetime XP. Equal XP is ordered by who reached it first. Only players
          who chose to be shown appear, by handle.
        </p>
      </header>

      <div className="frame row" role="status" style={{ justifyContent: "space-between" }}>
        {board.viewer.ranked ? (
          <p>
            You are <strong className="display">#{board.viewer.rank}</strong> of {board.totalRanked}{" "}
            with {formatXp(board.viewer.xp)} XP.
          </p>
        ) : (
          <p className="muted">{UNRANKED[board.viewer.reason]}</p>
        )}
        {!board.viewer.ranked && board.viewer.reason === "hidden" && (
          <Link className="btn" href="/play/profile">
            Profile settings
          </Link>
        )}
      </div>

      <section className="frame frame--ornate" aria-labelledby="board-title">
        <h2 id="board-title" className="frame__title">
          <Icon name="trophy" /> Top adventurers
        </h2>
        {board.entries.length === 0 ? (
          <div className="empty">
            <Icon name="trophy" size={32} />
            <p>No one is ranked yet. Complete a challenge to claim the first place.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="board">
              <caption className="sr-only">
                Top {board.entries.length} of {board.totalRanked} ranked players
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Adventurer</th>
                  <th scope="col" className="num">
                    XP
                  </th>
                </tr>
              </thead>
              <tbody>
                {board.entries.map((e, i) => (
                  <tr
                    key={`${e.rank}-${e.handle}-${i}`}
                    className={e.isViewer ? "is-viewer" : undefined}
                  >
                    <td className="board__rank">#{e.rank}</td>
                    <td>
                      {e.handle}
                      {e.isViewer && (
                        <span className="badge badge--teal" style={{ marginLeft: 8 }}>
                          You
                        </span>
                      )}
                    </td>
                    <td className="num">{formatXp(e.xp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
