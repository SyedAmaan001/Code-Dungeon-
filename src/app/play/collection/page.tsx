import type { Metadata } from "next";
import { requirePlayer } from "@/auth/server";
import { getRuntime } from "@/services/runtime";
import { itemInfo } from "@/world/catalog";
import { Icon } from "@/ui/art/icons";
import { ItemArt, Medallion } from "@/ui/art/items";
import { formatDate } from "@/ui/labels";
import { loadPlayerView } from "../data";

export const metadata: Metadata = { title: "Collection" };

export default async function CollectionPage() {
  const player = await requirePlayer();
  const view = await loadPlayerView(player.playerId);
  const { pack } = getRuntime();

  // Every keepsake the path can award, so unearned ones show as silhouettes.
  const sources = [
    ...pack.meta.quests.filter((q) => q.status === "published" && q.reward.item),
    ...pack.meta.achievements.filter((a) => a.status === "published" && a.reward.item),
  ].map((s) => ({ item: s.reward.item!, from: s.title }));
  const owned = new Set(view.items);
  const unlocked = view.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="stack-l">
      <header className="stack-s">
        <p className="eyebrow">{view.pathTitle}</p>
        <h1>Collection</h1>
        <p className="muted">
          Achievements and keepsakes you have earned. Rewards are cosmetic: they never change XP,
          unlocks or difficulty.
        </p>
      </header>

      <section className="frame frame--ornate" aria-labelledby="items-title">
        <div className="frame__title">
          <Icon name="collection" />
          <h2 id="items-title">
            Keepsakes{" "}
            <span className="dim">
              ({owned.size} of {sources.length})
            </span>
          </h2>
        </div>
        {sources.length === 0 ? (
          <p className="muted">This path has no keepsakes.</p>
        ) : (
          <ul className="shelf">
            {sources.map(({ item, from }) => {
              const has = owned.has(item);
              const info = itemInfo(item);
              return (
                <li key={item} className={has ? "trophy" : "trophy trophy--locked"}>
                  <ItemArt item={item} muted={!has} />
                  <span className="trophy__name">{has ? info.name : "Undiscovered"}</span>
                  <span className="trophy__text">
                    {has ? info.description : `Reward for: ${from}`}
                  </span>
                  <span className="sr-only">{has ? "Earned" : "Not earned yet"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="frame" aria-labelledby="ach-title">
        <div className="frame__title">
          <Icon name="star" />
          <h2 id="ach-title">
            Achievements{" "}
            <span className="dim">
              ({unlocked} of {view.achievements.length})
            </span>
          </h2>
        </div>
        {view.achievements.length === 0 ? (
          <p className="muted">This path has no achievements.</p>
        ) : (
          <ul className="shelf">
            {view.achievements.map((a) => (
              <li key={a.id} className={a.unlocked ? "trophy" : "trophy trophy--locked"}>
                <Medallion earned={a.unlocked} />
                <span className="trophy__name">{a.title}</span>
                <span className="trophy__text">{a.description}</span>
                {a.unlocked ? (
                  <span className="badge badge--gold">
                    <Icon name="check" size={14} />
                    {a.unlockedAt ? formatDate(a.unlockedAt) : "Unlocked"}
                  </span>
                ) : (
                  <span className="badge">
                    {a.progress.current} / {a.progress.target}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
