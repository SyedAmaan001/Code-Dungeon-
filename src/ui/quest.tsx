import type { PlayerGameView } from "@/services/game-service";
import { itemInfo } from "@/world/catalog";
import { Icon } from "./art/icons";
import { ItemArt } from "./art/items";

type Quest = PlayerGameView["quests"][number];

const STATE_LABEL: Record<Quest["state"], string> = {
  active: "Active",
  completed: "Complete",
  locked: "Not yet available",
};

export function QuestCard({ quest, compact = false }: { quest: Quest; compact?: boolean }) {
  const headingId = `quest-${quest.id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  return (
    <article
      className={quest.state === "locked" ? "quest quest--locked" : "quest"}
      aria-labelledby={headingId}
    >
      <div className="quest__seal" aria-hidden="true">
        {quest.rewardItem ? (
          <ItemArt item={quest.rewardItem} size={48} muted={quest.state !== "completed"} />
        ) : (
          <Icon name="scroll" size={28} />
        )}
      </div>
      <div className="stack-s">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 id={headingId}>{quest.title}</h3>
          <span
            className={
              quest.state === "completed"
                ? "badge badge--success"
                : quest.state === "active"
                  ? "badge badge--teal"
                  : "badge"
            }
          >
            {quest.state === "completed" ? (
              <Icon name="check" size={14} />
            ) : quest.state === "locked" ? (
              <Icon name="lock" size={14} />
            ) : null}
            {STATE_LABEL[quest.state]}
          </span>
        </div>
        {!compact && <p className="muted">{quest.description}</p>}
        {quest.state !== "locked" && (
          <ul className="objective-list" aria-label={`Objectives for ${quest.title}`}>
            {quest.objectives.map((o) => (
              <li key={o.id} className={o.met ? "objective objective--met" : "objective"}>
                <span className="objective__mark" aria-hidden="true">
                  {o.met && <Icon name="check" size={14} />}
                </span>
                <span className="objective__title">
                  <span className="sr-only">{o.met ? "Done: " : "To do: "}</span>
                  {o.title}
                </span>
                {o.progress.target > 1 && (
                  <span className="objective__count">
                    {o.progress.current}/{o.progress.target}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {!compact && quest.rewardItem && (
          <p className="dim" style={{ fontSize: "var(--text-s)" }}>
            Reward: {itemInfo(quest.rewardItem).name} (keepsake, no XP)
          </p>
        )}
      </div>
    </article>
  );
}
