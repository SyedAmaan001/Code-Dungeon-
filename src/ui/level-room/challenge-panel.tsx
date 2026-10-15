"use client";
/**
 * The level room's work area: one challenge at a time, answer submission, feedback and
 * progressive hints. Server actions decide everything; this component sends an answer
 * with an idempotency key and shows what the server returned. A retried request (e.g.
 * after a network error) reuses its key, so it is never counted twice.
 */
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { revealHint, submitAnswer } from "@/app/actions/game";
import type { PublicChallenge } from "@/learning/projection";
import type { HintView, Notice, SubmitView } from "@/services/presenter";
import { Icon, type IconName } from "../art/icons";
import { CHALLENGE_TYPE_LABEL } from "../labels";
import { InlineText } from "../rich-text";
import { AnswerInput, initialDraft, toAnswer, type Draft } from "./answer-inputs";

export interface ChallengeProgress {
  attempts: number;
  correct: boolean;
  hints: string[];
  explanation?: string;
}

interface Props {
  levelId: string;
  challenges: PublicChallenge[];
  progress: Record<string, ChallengeProgress>;
  /** Challenges solved in the active encounter run (null when the level is not an encounter). */
  solvedThisRun: string[] | null;
  encounterOpen: boolean;
}

const NOTICE_ICON: Partial<Record<Notice["kind"], IconName>> = {
  xp: "gem",
  level_completed: "check",
  level_mastered: "star",
  level_unlocked: "arrow-right",
  life_lost: "heart-empty",
  encounter_defeated: "alert",
  encounter_won: "crown",
  checkpoint: "flag",
  quest_activated: "scroll",
  objective_met: "check",
  quest_completed: "scroll",
  achievement: "star",
  item: "collection",
  encounter_started: "swords",
  sync: "info",
};

function newKey() {
  return `ui-${crypto.randomUUID()}`;
}

function Notices({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null;
  return (
    <ul className="notices">
      {notices.map((n, i) => (
        <li key={i} className={`notice notice--${n.kind}`}>
          <Icon name={NOTICE_ICON[n.kind] ?? "info"} size={16} />
          <span>{n.href ? <a href={n.href}>{n.text}</a> : n.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Feedback({ result }: { result: SubmitView }) {
  switch (result.status) {
    case "evaluated": {
      const fb = result.feedback;
      return (
        <div className={`feedback feedback--${result.correct ? "correct" : "incorrect"}`}>
          <p className="feedback__head">
            <Icon name={result.correct ? "check" : "x"} size={22} />
            {result.correct ? "Correct" : "Not quite"}
            {result.duplicate && <span className="badge">already counted</span>}
          </p>
          <p>
            <InlineText text={fb.message} />
          </p>
          {fb.detail && (
            <p className="muted">
              <InlineText text={fb.detail} />
            </p>
          )}
          {fb.explanation && (
            <p className="feedback__explanation">
              <InlineText text={fb.explanation} />
            </p>
          )}
          <Notices notices={result.notices} />
        </div>
      );
    }
    case "not_counted":
      return (
        <div
          className={`feedback feedback--${result.feedback.tone === "error" ? "error" : "invalid"}`}
        >
          <p className="feedback__head">
            <Icon name="info" size={20} /> Not counted
          </p>
          <p>{result.feedback.message}</p>
        </div>
      );
    case "rejected":
      return (
        <div className="feedback feedback--invalid">
          <p className="feedback__head">
            <Icon name="alert" size={20} /> Not sent
          </p>
          <p>{result.message}</p>
        </div>
      );
    case "signed_out":
      return (
        <div className="feedback feedback--error">
          <p className="feedback__head">
            <Icon name="lock" size={20} /> Signed out
          </p>
          <p>
            Your session ended. <a href="/sign-in">Sign in again</a> to keep playing; nothing was
            counted.
          </p>
        </div>
      );
    case "rate_limited":
      return (
        <div className="feedback feedback--invalid">
          <p className="feedback__head">
            <Icon name="alert" size={20} /> Slow down
          </p>
          <p>Too many answers in a short time. Wait a moment and try again.</p>
        </div>
      );
    case "error":
      return (
        <div className="feedback feedback--error">
          <p className="feedback__head">
            <Icon name="alert" size={20} /> Something went wrong
          </p>
          <p>Your answer could not be checked. Try again; it will not be counted twice.</p>
        </div>
      );
  }
}

export function ChallengePanel({
  levelId,
  challenges,
  progress,
  solvedThisRun,
  encounterOpen,
}: Props) {
  const router = useRouter();
  const firstOpen = Math.max(
    0,
    challenges.findIndex((c) => !progress[c.id]?.correct),
  );
  const [selected, setSelected] = useState(firstOpen);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(challenges.map((c) => [c.id, initialDraft(c)])),
  );
  const [results, setResults] = useState<Record<string, SubmitView>>({});
  const [hints, setHints] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(challenges.map((c) => [c.id, progress[c.id]?.hints ?? []])),
  );
  const [hintError, setHintError] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"submit" | "hint" | null>(null);
  const pendingKey = useRef<Record<string, string>>({});
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const challenge = challenges[selected]!;
  const result = results[challenge.id];
  const solved = (id: string) =>
    progress[id]?.correct ||
    (results[id]?.status === "evaluated" && (results[id] as { correct: boolean }).correct);
  // Run state comes from the server (refreshed after every answer), never guessed locally.
  const solvedRun = (id: string) => !!solvedThisRun?.includes(id);

  function submit() {
    const built = toAnswer(drafts[challenge.id]!);
    if ("missing" in built) {
      setMissing((m) => ({ ...m, [challenge.id]: built.missing }));
      return;
    }
    setMissing((m) => ({ ...m, [challenge.id]: "" }));
    const key = (pendingKey.current[challenge.id] ??= newKey());
    const id = challenge.id;
    setBusy("submit");
    startTransition(async () => {
      let view: SubmitView;
      try {
        view = await submitAnswer({
          submissionId: key,
          levelId,
          challengeId: id,
          answer: built.answer,
        });
      } catch {
        // Network failure: keep the key so a retry cannot be counted twice.
        setResults((r) => ({ ...r, [id]: { status: "error" } }));
        return;
      }
      delete pendingKey.current[id];
      setResults((r) => ({ ...r, [id]: view }));
      if (view.status === "evaluated") router.refresh();
    });
  }

  function hint() {
    const id = challenge.id;
    setBusy("hint");
    startTransition(async () => {
      let view: HintView;
      try {
        view = await revealHint({ levelId, challengeId: id });
      } catch {
        setHintError((e) => ({ ...e, [id]: "The hint could not be loaded. Try again." }));
        return;
      }
      if (view.status === "ok") {
        setHints((h) => ({ ...h, [id]: view.revealed }));
        setHintError((e) => ({ ...e, [id]: "" }));
        router.refresh();
      } else {
        setHintError((e) => ({
          ...e,
          [id]:
            view.status === "rejected"
              ? view.message
              : view.status === "signed_out"
                ? "Your session ended. Sign in again."
                : view.status === "rate_limited"
                  ? "Too many requests. Wait a moment."
                  : "The hint could not be loaded. Try again.",
        }));
      }
    });
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = challenges.length - 1;
    const next =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setSelected(next);
    tabRefs.current[next]?.focus();
  }

  const revealed = hints[challenge.id] ?? [];
  const hintsLeft = challenge.hintCount - revealed.length;
  const panelId = `challenge-panel-${selected}`;
  const isSolved = solved(challenge.id);

  return (
    <section className="frame frame--ornate stack" aria-labelledby="challenges-title">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id="challenges-title">Challenges</h2>
        <span className="dim">
          {challenges.filter((c) => solved(c.id)).length} of {challenges.length} solved
        </span>
      </div>

      <div className="tabs" role="tablist" aria-label="Challenges in this level">
        {challenges.map((c, i) => {
          const done = solved(c.id);
          const runDone = solvedThisRun ? solvedRun(c.id) : done;
          return (
            <button
              key={c.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`challenge-tab-${i}`}
              aria-selected={i === selected}
              aria-controls={`challenge-panel-${i}`}
              tabIndex={i === selected ? 0 : -1}
              className={runDone ? "tab tab--solved" : "tab"}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <span className="tab__mark" aria-hidden="true">
                {runDone ? <Icon name="check" size={16} /> : i + 1}
              </span>
              <span>
                {c.role === "check" ? "Check" : "Exercise"} {i + 1}
                <span className="sr-only">
                  {runDone ? ", solved" : done ? ", solved before this run" : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="challenge"
        role="tabpanel"
        id={panelId}
        aria-labelledby={`challenge-tab-${selected}`}
        key={challenge.id}
      >
        <div className="challenge__meta">
          <span className="badge">{CHALLENGE_TYPE_LABEL[challenge.type] ?? challenge.type}</span>
          {challenge.role === "check" && <span className="badge badge--teal">Knowledge check</span>}
          {!challenge.required && <span className="badge">Optional</span>}
          <span className="badge" title="Difficulty">
            Difficulty {challenge.difficulty} of 3
          </span>
          {isSolved && (
            <span className="badge badge--success">
              <Icon name="check" size={14} /> Solved
            </span>
          )}
        </div>

        <p className="challenge__prompt">
          <InlineText text={challenge.prompt} />
        </p>

        {isSolved && solvedThisRun && encounterOpen && !solvedRun(challenge.id) && (
          <p className="notice-box">
            <Icon name="swords" size={18} />
            Solved before, but an encounter run needs every required challenge solved within the
            same run. Answer it again for this run.
          </p>
        )}

        <AnswerInput
          challenge={challenge}
          draft={drafts[challenge.id]!}
          onChange={(d) => setDrafts((all) => ({ ...all, [challenge.id]: d }))}
          disabled={pending}
        />

        {missing[challenge.id] && (
          <p className="form-error" role="alert">
            <Icon name="info" size={18} /> {missing[challenge.id]}
          </p>
        )}

        <div className="challenge__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={submit}
            disabled={pending || challenge.type === "code_write"}
            aria-busy={pending}
          >
            {pending && busy === "submit"
              ? "Checking…"
              : isSolved && !(solvedThisRun && encounterOpen && !solvedRun(challenge.id))
                ? "Submit again (practice)"
                : "Submit answer"}
          </button>
          {challenge.hintCount > 0 && (
            <button
              type="button"
              className="btn"
              onClick={hint}
              disabled={pending || hintsLeft <= 0}
            >
              <Icon name="lantern" size={18} />
              {pending && busy === "hint"
                ? "Lighting the lantern…"
                : hintsLeft > 0
                  ? `Reveal hint ${revealed.length + 1} of ${challenge.hintCount}`
                  : "No hints left"}
            </button>
          )}
          {selected < challenges.length - 1 && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setSelected(selected + 1)}
            >
              Next challenge <Icon name="arrow-right" size={18} />
            </button>
          )}
        </div>
        {challenge.hintCount > 0 && hintsLeft > 0 && encounterOpen && (
          <p className="dim" style={{ fontSize: "var(--text-s)" }}>
            Hints never cost XP or lives, but a run with hints is not flawless, and a hint stops
            this challenge counting for mastery.
          </p>
        )}

        <div role="status" aria-live="polite">
          {result ? (
            <Feedback result={result} />
          ) : (
            progress[challenge.id]?.explanation && (
              <div className="feedback feedback--correct">
                <p className="feedback__head">
                  <Icon name="check" size={20} /> You solved this before
                </p>
                <p className="feedback__explanation">
                  <InlineText text={progress[challenge.id]!.explanation!} />
                </p>
              </div>
            )
          )}
        </div>

        {(revealed.length > 0 || hintError[challenge.id]) && (
          <div className="stack-s">
            <h3 className="sr-only">Hints</h3>
            <ol className="hints" aria-live="polite">
              {revealed.map((h, i) => (
                <li className="hint" key={i}>
                  <span className="hint__tier">Hint {i + 1}</span>
                  <span>
                    <InlineText text={h} />
                  </span>
                </li>
              ))}
            </ol>
            {hintError[challenge.id] && (
              <p className="form-error" role="alert">
                {hintError[challenge.id]}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
