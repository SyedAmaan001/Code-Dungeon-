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

/** One short status line; the encounter kind is shown separately as a tag. */
function statusText(level: Level, encounterWon: boolean) {
  if (level.status === "completed") {
    if (level.mastered) return "Mastered";
    if (encounterWon) return level.kind === "checkpoint" ? "Checkpoint cleared" : "Victory";
    return "Complete";
  }
  return LEVEL_STATUS_LABEL[level.status] ?? level.status;
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
      {level.kind !== "standard" && (
        <span className="room__tag">
          {LEVEL_KIND_LABEL[level.kind]}
          {encounterWon && <span className="sr-only"> (won)</span>}
        </span>
      )}
      <span className="room__title">
        <span className="sr-only">Level {level.number}: </span>
        {level.title}
      </span>
      <span className="room__status">
        {statusText(level, encounterWon)}
        {current && <span className="room__here"> · continue here</span>}
      </span>
    </>
  );
  const data = {
    "data-status": level.status,
    "data-kind": level.kind,
    "data-mastered": level.mastered || undefined,
    "data-won": encounterWon || undefined,
  };
  const className = current ? "room room--current" : "room";
  return level.status === "locked" ? (
    <div className={className} {...data}>
      {inner}
    </div>
  ) : (
    <Link
      className={className}
      {...data}
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
                <div className="zone__count">
                  {locked ? (
                    <span className="row" style={{ gap: "0.35rem" }}>
                      <Icon name="lock" size={16} /> Sealed
                    </span>
                  ) : (
                    <>
                      <span>
                        {done} of {levels.length} complete
                      </span>
                      <span
                        className="meter meter--zone"
                        role="progressbar"
                        aria-label={`${zone.title} progress`}
                        aria-valuemin={0}
                        aria-valuemax={levels.length}
                        aria-valuenow={done}
                      >
                        <span
                          className="meter__fill"
                          style={{ width: `${(done / levels.length) * 100}%` }}
                        />
                      </span>
                    </>
                  )}
                </div>
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

/** Explains every room state on the map (icons, shapes and words, not colour alone). */
export function MapLegend() {
  const item = (icon: IconName, label: string, className = "") => (
    <li className={`legend__item ${className}`}>
      <span className="legend__swatch" aria-hidden="true">
        <Icon name={icon} size={14} />
      </span>
      {label}
    </li>
  );
  return (
    <details className="legend frame">
      <summary>How to read the map</summary>
      <ul className="legend__list">
        {item("arrow-right", "Open: ready to enter", "legend--open")}
        {item("spark", "In progress", "legend--open")}
        {item("check", "Complete", "legend--done")}
        {item("star", "Mastered: every knowledge check shown without hints", "legend--done")}
        {item("lock", "Locked: finish the room before it", "legend--locked")}
        {item("flag", "Checkpoint: cannot be lost; records your progress", "legend--checkpoint")}
        {item("swords", "Major encounter: 3 lives per run", "legend--major")}
        {item("crown", "Boss: the final challenge, 3 lives per run", "legend--boss")}
      </ul>
    </details>
  );
}
