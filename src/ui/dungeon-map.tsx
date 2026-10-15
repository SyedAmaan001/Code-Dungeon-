/**
 * The dungeon map: zones in order, each with its rooms (levels) on a trail.
 * Entirely data-driven (any number of zones and levels; no per-level branches).
 * Every state is shown with an icon and text as well as colour.
 */
import Link from "next/link";
import type { PlayerGameView } from "@/services/game-service";
import { zoneTheme } from "@/world/catalog";
import { Icon, type IconName } from "./art/icons";
import { ZoneEmblem, ZoneScene } from "./art/zone-scene";
import { LEVEL_KIND_LABEL, LEVEL_STATUS_LABEL } from "./labels";

type Level = PlayerGameView["levels"][number];

const KIND_ICON: Partial<Record<Level["kind"], IconName>> = {
  checkpoint: "flag",
  major: "swords",
  boss: "crown",
};

function statusText(level: Level, encounterWon: boolean) {
  const base = LEVEL_STATUS_LABEL[level.status] ?? level.status;
  const parts = [base];
  if (level.mastered) parts.push("mastered");
  if (encounterWon) parts.push(level.kind === "checkpoint" ? "checkpoint cleared" : "victory");
  return parts.join(" · ");
}

function Room({
  level,
  current,
  encounterWon,
}: {
  level: Level;
  current: boolean;
  encounterWon: boolean;
}) {
  const kindIcon = KIND_ICON[level.kind];
  const stateIcon: IconName | undefined =
    level.status === "completed"
      ? level.mastered
        ? "star"
        : "check"
      : level.status === "locked"
        ? "lock"
        : level.status === "in_progress"
          ? "spark"
          : undefined;
  const inner = (
    <>
      <span className="room__seal" aria-hidden="true">
        {level.number}
        {kindIcon && (
          <span className="room__kind">
            <Icon name={kindIcon} size={14} />
          </span>
        )}
        {stateIcon && (
          <span className="room__state">
            <Icon name={stateIcon} size={13} />
          </span>
        )}
      </span>
      <span className="room__title">
        <span className="sr-only">Level {level.number}: </span>
        {level.title}
      </span>
      <span className="room__status">
        {level.kind !== "standard" && `${LEVEL_KIND_LABEL[level.kind]} · `}
        {statusText(level, encounterWon)}
        {current && " · continue here"}
      </span>
    </>
  );
  const className = current ? "room room--current" : "room";
  return level.status === "locked" ? (
    <div className={className} data-status={level.status}>
      {inner}
    </div>
  ) : (
    <Link
      className={className}
      data-status={level.status}
      href={`/play/level/${encodeURIComponent(level.levelId)}`}
      aria-current={current ? "step" : undefined}
    >
      {inner}
    </Link>
  );
}

export function DungeonMap({ view }: { view: PlayerGameView }) {
  const won = new Set(view.encounters.filter((e) => e.status === "won").map((e) => e.levelId));
  const zones = [...view.zones].sort((a, b) => a.order - b.order);
  return (
    <div className="map">
      {zones.map((zone) => {
        const levels = view.levels
          .filter((l) => l.zone === zone.id)
          .sort((a, b) => a.number - b.number);
        if (levels.length === 0) return null;
        const done = levels.filter((l) => l.status === "completed").length;
        const locked = levels.every((l) => l.status === "locked");
        const theme = zoneTheme(zone.themeKey);
        const headingId = `zone-${zone.id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
        return (
          <section
            key={zone.id}
            className={locked ? "zone zone--locked" : "zone"}
            data-zone={theme}
            aria-labelledby={headingId}
          >
            <div className="zone__banner">
              <ZoneScene theme={theme} />
              <div className="zone__heading">
                <div className="stack-s">
                  <p className="eyebrow">
                    Zone {zone.order}
                    {zone.artTitle ? ` · ${zone.artTitle}` : ""}
                  </p>
                  <h2 id={headingId}>
                    <ZoneEmblem theme={theme} />
                    {zone.title}
                  </h2>
                </div>
                <p className="zone__count">
                  {locked ? (
                    <>
                      <Icon name="lock" size={16} /> Sealed
                    </>
                  ) : (
                    `${done} of ${levels.length} complete`
                  )}
                </p>
              </div>
            </div>
            <ol className="path" style={{ "--count": levels.length } as React.CSSProperties}>
              {levels.map((level) => (
                <li className="path__item" key={level.levelId}>
                  <Room
                    level={level}
                    current={level.levelId === view.resumeLevelId}
                    encounterWon={won.has(level.levelId)}
                  />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
