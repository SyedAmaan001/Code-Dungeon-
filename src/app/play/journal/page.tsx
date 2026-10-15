import type { Metadata } from "next";
import { requirePlayer } from "@/auth/server";
import { Icon } from "@/ui/art/icons";
import { QuestCard } from "@/ui/quest";
import { loadPlayerView } from "../data";

export const metadata: Metadata = { title: "Quest journal" };

export default async function JournalPage() {
  const player = await requirePlayer();
  const view = await loadPlayerView(player.playerId);
  const groups = [
    { key: "active", title: "Active", quests: view.quests.filter((q) => q.state === "active") },
    {
      key: "completed",
      title: "Completed",
      quests: view.quests.filter((q) => q.state === "completed"),
    },
    {
      key: "locked",
      title: "Not yet available",
      quests: view.quests.filter((q) => q.state === "locked"),
    },
  ] as const;

  return (
    <div className="stack-l">
      <header className="stack-s">
        <p className="eyebrow">{view.pathTitle}</p>
        <h1>Quest journal</h1>
        <p className="muted">
          Quests track what you have really done on the path. They reward keepsakes, never XP.
          Optional objectives keep counting after a quest is complete.
        </p>
      </header>
      {view.quests.length === 0 ? (
        <div className="frame empty">
          <Icon name="scroll" size={32} />
          <p>There are no quests on this path yet.</p>
        </div>
      ) : (
        groups.map(
          (g) =>
            g.quests.length > 0 && (
              <section
                key={g.key}
                className="frame frame--ornate"
                aria-labelledby={`journal-${g.key}`}
              >
                <h2 id={`journal-${g.key}`} className="frame__title">
                  {g.title} <span className="dim">({g.quests.length})</span>
                </h2>
                {g.quests.map((q) => (
                  <QuestCard key={q.id} quest={q} />
                ))}
              </section>
            ),
        )
      )}
    </div>
  );
}
