import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlayer } from "@/auth/server";
import type { EncounterRoom } from "@/services/game-service";
import { getRuntime } from "@/services/runtime";
import { zoneTheme } from "@/world/catalog";
import { Icon } from "@/ui/art/icons";
import { ZoneScene } from "@/ui/art/zone-scene";
import { CodeBlock } from "@/ui/code";
import { formatXp, LEVEL_KIND_LABEL, LEVEL_STATUS_LABEL, REVIEW_LABEL, plural } from "@/ui/labels";
import { ChallengePanel } from "@/ui/level-room/challenge-panel";
import { InlineText, RichText } from "@/ui/rich-text";
import { loadPlayerView } from "../../data";

type Params = Promise<{ levelId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { levelId } = await params;
  const level = getRuntime().pack.levels.find((l) => l.id === decodeURIComponent(levelId));
  return { title: level ? `Level ${level.number}: ${level.title}` : "Level" };
}

function EncounterPanel({ encounter, required }: { encounter: EncounterRoom; required: number }) {
  const kindLabel =
    encounter.encounterKind === "boss"
      ? "Boss encounter"
      : encounter.encounterKind === "major"
        ? "Major encounter"
        : "Checkpoint";
  const solved = encounter.solvedThisRun.length;
  let text: string;
  if (encounter.status === "won")
    text = `Cleared${encounter.flawless ? " flawlessly" : ""} after ${plural(encounter.runs, "run")}. Replays are practice and start no runs.`;
  else if (encounter.maxLives === null)
    text =
      encounter.status === "active"
        ? `Run ${encounter.run}: ${solved} of ${required} required challenges solved. This checkpoint cannot be lost.`
        : `Solve every required challenge in one run to record the checkpoint. This run cannot be lost.`;
  else if (encounter.status === "active")
    text = `Run ${encounter.run}: ${solved} of ${required} required challenges solved this run. Each wrong answer costs a life.`;
  else if (encounter.status === "defeated")
    text = `Run ${encounter.runs} was lost. Your learning progress and XP are kept; your next answer starts a fresh run with ${encounter.maxLives} lives.`;
  else
    text = `Your first answer or hint starts run 1 with ${encounter.maxLives} lives. Each wrong answer costs a life; losing a run never removes progress or XP.`;

  return (
    <section
      className={`frame encounter${encounter.status === "won" ? " encounter--won" : ""}`}
      aria-labelledby="encounter-title"
    >
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id="encounter-title" className="row" style={{ gap: "0.5rem" }}>
          <Icon
            name={
              encounter.encounterKind === "boss"
                ? "crown"
                : encounter.encounterKind === "major"
                  ? "swords"
                  : "flag"
            }
          />
          {kindLabel}
        </h2>
        {encounter.maxLives !== null && encounter.status !== "won" && (
          <div className="row" style={{ gap: "0.5rem" }}>
            <ul className="lives" aria-hidden="true">
              {Array.from({ length: encounter.maxLives }, (_, i) => (
                <li
                  key={i}
                  className={i < (encounter.livesRemaining ?? 0) ? "life" : "life life--spent"}
                >
                  <Icon
                    name={i < (encounter.livesRemaining ?? 0) ? "heart" : "heart-empty"}
                    size={22}
                  />
                </li>
              ))}
            </ul>
            <span className="badge badge--ember">
              {encounter.livesRemaining} of {encounter.maxLives} lives
            </span>
          </div>
        )}
        {encounter.status === "won" && (
          <span className="badge badge--gold">
            <Icon name="check" size={14} /> {encounter.flawless ? "Flawless victory" : "Victory"}
          </span>
        )}
      </div>
      <p className="muted">{text}</p>
    </section>
  );
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span
      className="meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span className="meter__fill" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </span>
  );
}

/** Where the learner stands in this room: required challenges, XP here, mastery. */
function RoomProgress({
  solved,
  required,
  xp,
  mastered,
  hasChecks,
}: {
  solved: number;
  required: number;
  xp: { earned: number; available: number };
  mastered: boolean;
  hasChecks: boolean;
}) {
  return (
    <section className="room-progress" aria-label="Your progress in this level">
      <div>
        <div className="room-progress__label">Required challenges</div>
        <div className="room-progress__value">
          {solved} of {required} solved
        </div>
        <Meter value={solved} max={required} label="Required challenges solved" />
      </div>
      <div>
        <div className="room-progress__label">XP in this level</div>
        <div className="room-progress__value">
          {formatXp(xp.earned)} of {formatXp(xp.available)}
        </div>
        <Meter value={xp.earned} max={xp.available} label="XP earned in this level" />
      </div>
      <div>
        <div className="room-progress__label">Mastery</div>
        <div className="room-progress__value">
          {mastered ? (
            <>
              <Icon name="star" size={16} /> Mastered
            </>
          ) : hasChecks ? (
            "Not yet: each knowledge check right without a hint"
          ) : (
            "Not yet: each required challenge right without a hint"
          )}
        </div>
      </div>
    </section>
  );
}

export default async function LevelPage({ params }: { params: Params }) {
  const player = await requirePlayer();
  const levelId = decodeURIComponent((await params).levelId);
  const { game, pack } = getRuntime();
  const [room, view] = await Promise.all([
    game.levelRoom(player.playerId, levelId),
    loadPlayerView(player.playerId),
  ]);

  const summary = view.levels.find((l) => l.levelId === levelId);
  if (room.status !== "ok") {
    if (room.code !== "level_locked" || !summary) notFound();
    const prerequisites = pack.levels.find((l) => l.id === levelId)?.prerequisites ?? [];
    const needed = view.levels.filter(
      (l) => prerequisites.includes(l.levelId) && l.status !== "completed",
    );
    return (
      <div className="frame empty" style={{ maxWidth: "40rem", margin: "0 auto" }}>
        <Icon name="lock" size={40} />
        <h1 style={{ fontSize: "var(--text-2xl)" }}>
          Level {summary.number}: {summary.title}
        </h1>
        <p>This room is sealed.</p>
        {needed.length > 0 && (
          <p className="muted">
            Complete{" "}
            {needed.map((l, i) => (
              <span key={l.levelId}>
                {i > 0 && ", "}
                <Link href={`/play/level/${encodeURIComponent(l.levelId)}`}>
                  Level {l.number}: {l.title}
                </Link>
              </span>
            ))}{" "}
            first.
          </p>
        )}
        <Link className="btn" href="/play/map">
          <Icon name="map" size={18} /> Back to the map
        </Link>
      </div>
    );
  }

  const level = room.level;
  const zone = view.zones.find((z) => z.id === level.zone);
  const theme = zoneTheme(zone?.themeKey ?? "");
  const status = summary?.status ?? room.view.status;
  const required = level.challenges.filter((c) => c.required).length;
  const sorted = [...view.levels].sort((a, b) => a.number - b.number);
  const next = sorted.find(
    (l) => l.number > level.number && l.status !== "locked" && l.status !== "completed",
  );
  const encounterOpen = !!room.encounter && room.encounter.status !== "won";

  return (
    <div data-zone={theme}>
      <header className="room-header">
        <ZoneScene theme={theme} />
        <div className="room-header__body">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumbs">
              <li>
                <Link href="/play/map">Map</Link>
              </li>
              <li>{zone?.title ?? "Zone"}</li>
              <li aria-current="page">Level {level.number}</li>
            </ol>
          </nav>
          <p className="eyebrow">
            Level {level.number} · {LEVEL_KIND_LABEL[level.kind]}
          </p>
          <h1>{level.title}</h1>
          {level.description && (
            <p className="muted" style={{ maxWidth: "48rem" }}>
              <InlineText text={level.description} />
            </p>
          )}
          <div className="row">
            <span className={status === "completed" ? "badge badge--success" : "badge badge--teal"}>
              {status === "completed" && <Icon name="check" size={14} />}
              {LEVEL_STATUS_LABEL[status]}
              {summary?.mastered ? " · mastered" : ""}
            </span>
            {level.estimatedMinutes && (
              <span className="badge">About {level.estimatedMinutes} min</span>
            )}
            <span className="badge">{plural(level.challenges.length, "challenge")}</span>
            <a className="badge badge--gold jump-link" href="#challenges-title">
              Jump to challenges <Icon name="arrow-down" size={14} />
            </a>
            {summary && (
              <span
                className={
                  summary.review === "human" ? "badge badge--success" : "badge badge--review"
                }
                title="Who reviewed this level's content"
              >
                {REVIEW_LABEL[summary.review]}
              </span>
            )}
          </div>
        </div>
      </header>

      <RoomProgress
        solved={level.challenges.filter((c) => c.required && room.challenges[c.id]?.correct).length}
        required={required}
        xp={room.xp}
        mastered={summary?.mastered ?? false}
        hasChecks={level.challenges.some((c) => c.role === "check")}
      />

      {status === "completed" && (
        <div className="banner" style={{ marginTop: "1.5rem" }} role="status">
          <div>
            <p className="banner__title">Level complete{summary?.mastered ? " · mastered" : ""}</p>
            <p className="muted">
              {summary?.mastered
                ? "You have shown every knowledge check without hints."
                : "Replay the knowledge checks without hints to master this level."}
            </p>
          </div>
          <div className="row">
            {next ? (
              <Link
                className="btn btn--primary"
                href={`/play/level/${encodeURIComponent(next.levelId)}`}
              >
                Level {next.number}: {next.title} <Icon name="arrow-right" size={18} />
              </Link>
            ) : (
              <Link className="btn btn--primary" href="/play">
                Back to camp <Icon name="arrow-right" size={18} />
              </Link>
            )}
            <Link className="btn" href="/play/map">
              Map
            </Link>
          </div>
        </div>
      )}

      {room.encounter && (
        <div style={{ marginTop: "1.5rem" }}>
          <EncounterPanel encounter={room.encounter} required={required} />
        </div>
      )}

      <div className="room-layout">
        <article className="frame lesson stack" aria-labelledby="lesson-title">
          <h2 id="lesson-title">Lesson</h2>
          {level.lesson ? (
            <>
              <section aria-label="Objectives" className="stack-s">
                <h3 style={{ marginTop: 0 }}>You will be able to</h3>
                <ul className="objectives">
                  {level.lesson.objectives.map((o) => (
                    <li key={o}>
                      <Icon name="check" size={16} />
                      <span>
                        <InlineText text={o} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <div className="stack-s">
                <RichText text={level.lesson.explanation} />
              </div>
              {level.lesson.examples.length > 0 && (
                <section className="stack">
                  <h3>Worked {level.lesson.examples.length === 1 ? "example" : "examples"}</h3>
                  {level.lesson.examples.map((e, i) => (
                    <CodeBlock
                      key={i}
                      code={e.code}
                      caption={e.caption}
                      stdin={e.stdin}
                      output={e.expectedOutput}
                      exception={e.expectedException}
                    />
                  ))}
                  <p className="dim" style={{ fontSize: "var(--text-s)" }}>
                    Example outputs were checked by running them with Python 3.
                  </p>
                </section>
              )}
              {level.lesson.misconceptions.length > 0 && (
                <section className="stack-s">
                  <h3>Common mix-ups</h3>
                  <ul className="misconceptions">
                    {level.lesson.misconceptions.map((m) => (
                      <li key={m}>
                        <InlineText text={m} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {level.lesson.practicalContext && (
                <section className="stack-s">
                  <h3>Where you will use this</h3>
                  <p className="muted">
                    <InlineText text={level.lesson.practicalContext} />
                  </p>
                </section>
              )}
            </>
          ) : (
            <p className="muted">This level has no lesson text.</p>
          )}
        </article>

        <div className="room-layout__work">
          <ChallengePanel
            levelId={level.id}
            challenges={level.challenges}
            progress={room.challenges}
            solvedThisRun={
              room.encounter && room.encounter.status !== "won"
                ? room.encounter.solvedThisRun
                : null
            }
            encounterOpen={encounterOpen}
          />
        </div>
      </div>
    </div>
  );
}
