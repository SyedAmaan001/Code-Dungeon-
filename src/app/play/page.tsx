import type { Metadata } from "next";
import Link from "next/link";
import { requirePlayer } from "@/auth/server";
import { getRuntime } from "@/services/runtime";
import { itemInfo, zoneTheme } from "@/world/catalog";
import { Icon } from "@/ui/art/icons";
import { ItemArt } from "@/ui/art/items";
import { ZoneScene } from "@/ui/art/zone-scene";
import { formatXp, plural } from "@/ui/labels";
import { QuestCard } from "@/ui/quest";
import { loadPlayerView } from "./data";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const player = await requirePlayer();
  const view = await loadPlayerView(player.playerId);
  const { withheld, release } = getRuntime();

  const levels = [...view.levels].sort((a, b) => a.number - b.number);
  const resume = levels.find((l) => l.levelId === view.resumeLevelId);
  const completed = levels.filter((l) => l.status === "completed").length;
  const mastered = levels.filter((l) => l.mastered).length;
  const allDone = levels.length > 0 && completed === levels.length;
  const focusLevel = resume ?? levels.at(-1);
  const zone = view.zones.find((z) => z.id === focusLevel?.zone) ?? view.zones[0];
  const theme = zoneTheme(zone?.themeKey ?? "");
  const activeQuests = view.quests.filter((q) => q.state === "active");
  const questsDone = view.quests.filter((q) => q.state === "completed").length;
  const achievementsDone = view.achievements.filter((a) => a.unlocked).length;
  const agentReviewed = levels.filter((l) => l.review === "agent").length;
  const pct = view.maxXp > 0 ? Math.round((view.totalXp / view.maxXp) * 100) : 0;
  const recentItems = [...view.items].reverse().slice(0, 6);

  return (
    <div className="stack-l" data-zone={theme}>
      <section className="hero" aria-labelledby="home-title">
        <ZoneScene theme={theme} />
        <div className="hero__body">
          <p className="eyebrow">
            {zone ? `${zone.artTitle ?? zone.title} · ${view.pathTitle}` : view.pathTitle}
          </p>
          <h1 id="home-title">
            {allDone
              ? "Expedition complete"
              : completed === 0
                ? "Your expedition begins"
                : `Welcome back, ${player.handle}`}
          </h1>
          {levels.length === 0 ? (
            <p className="muted">
              No levels are released yet
              {release === "public" && withheld.length > 0
                ? ": every level is waiting for human review."
                : "."}
            </p>
          ) : allDone ? (
            <p className="muted">
              You completed all {levels.length} levels. Replay any room to practise and earn
              mastery.
            </p>
          ) : (
            resume && (
              <p className="muted">
                Next: <strong className="display">Level {resume.number}</strong> — {resume.title}
                {resume.description ? `. ${resume.description}` : ""}
              </p>
            )
          )}
          <div className="row">
            {resume && !allDone && (
              <Link
                className="btn btn--primary btn--lg"
                href={`/play/level/${encodeURIComponent(resume.levelId)}`}
              >
                {resume.status === "in_progress" ? "Continue" : "Enter"} level {resume.number}
                <Icon name="arrow-right" size={20} />
              </Link>
            )}
            <Link className="btn" href="/play/map">
              <Icon name="map" size={18} /> Open the map
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="progress-title" className="stack">
        <h2 id="progress-title" className="sr-only">
          Your progress
        </h2>
        <div className="ledger">
          <div className="ledger__item">
            <div className="ledger__value">{formatXp(view.totalXp)} XP</div>
            <div className="ledger__label">of {formatXp(view.maxXp)} on this path</div>
            <div
              className="meter"
              role="progressbar"
              aria-label="Path XP"
              aria-valuemin={0}
              aria-valuemax={view.maxXp}
              aria-valuenow={view.totalXp}
              style={{ marginTop: "0.5rem" }}
            >
              <div className="meter__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="ledger__item">
            <div className="ledger__value">
              {completed}/{levels.length}
            </div>
            <div className="ledger__label">levels complete · {mastered} mastered</div>
          </div>
          <div className="ledger__item">
            <div className="ledger__value">
              {questsDone}/{view.quests.length}
            </div>
            <div className="ledger__label">quests complete</div>
          </div>
          <div className="ledger__item">
            <div className="ledger__value">
              {achievementsDone}/{view.achievements.length}
            </div>
            <div className="ledger__label">achievements</div>
          </div>
          <div className="ledger__item">
            <div className="ledger__value">
              {view.lastCheckpoint
                ? `Level ${levels.find((l) => l.levelId === view.lastCheckpoint)?.number ?? "?"}`
                : "None"}
            </div>
            <div className="ledger__label">last checkpoint</div>
          </div>
        </div>
      </section>

      <div className="split">
        <section className="frame frame--ornate" aria-labelledby="quests-title">
          <div className="frame__title">
            <Icon name="scroll" />
            <h2 id="quests-title">Active quests</h2>
          </div>
          {activeQuests.length === 0 ? (
            <p className="muted">
              {questsDone === view.quests.length && view.quests.length > 0
                ? "Every quest is complete."
                : "No active quests yet. Quests appear as new rooms open."}
            </p>
          ) : (
            <div>
              {activeQuests.slice(0, 3).map((q) => (
                <QuestCard key={q.id} quest={q} compact />
              ))}
            </div>
          )}
          <p style={{ marginTop: "1rem" }}>
            <Link href="/play/journal">Open the quest journal</Link>
          </p>
        </section>

        <section className="frame" aria-labelledby="rewards-title">
          <div className="frame__title">
            <Icon name="collection" />
            <h2 id="rewards-title">Recent finds</h2>
          </div>
          {recentItems.length === 0 ? (
            <p className="muted">
              Nothing yet. Quests and achievements reward keepsakes (cosmetic only, no XP).
            </p>
          ) : (
            <ul className="shelf">
              {recentItems.map((item, i) => (
                <li key={`${item}-${i}`} className="trophy">
                  <ItemArt item={item} />
                  <span className="trophy__name">{itemInfo(item).name}</span>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: "1rem" }}>
            <Link href="/play/collection">View your collection</Link>
          </p>
          {agentReviewed > 0 && (
            <p className="notice-box" style={{ marginTop: "1.25rem" }}>
              <Icon name="info" size={18} />
              <span>
                {plural(agentReviewed, "level")} on this path {agentReviewed === 1 ? "was" : "were"}{" "}
                checked by an AI agent and automated tests; human review is still pending. Report
                anything that looks wrong.
              </span>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
