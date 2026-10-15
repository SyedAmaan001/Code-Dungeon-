"use client";
/**
 * Answer inputs for each deterministic challenge format. They only collect an answer in
 * the shape the server's evaluator expects; correctness is decided on the server.
 */
import { useId } from "react";
import type { PublicChallenge } from "@/learning/projection";
import { Icon } from "../art/icons";
import { CodeBlock } from "../code";

export type Draft =
  | { type: "multiple_choice"; selected: string[] }
  | { type: "predict_output"; output: string }
  | { type: "fill_blank"; blanks: Record<string, string> }
  | { type: "order_lines"; order: string[] }
  | { type: "trace"; values: Record<string, string> }
  | { type: "find_fix_bug"; line: number | null; fix: string | null }
  | { type: "code_write" };

export function initialDraft(c: PublicChallenge): Draft {
  switch (c.type) {
    case "multiple_choice":
      return { type: c.type, selected: [] };
    case "predict_output":
      return { type: c.type, output: "" };
    case "fill_blank":
      return { type: c.type, blanks: Object.fromEntries(c.blanks.map((b) => [b.id, ""])) };
    case "order_lines":
      return { type: c.type, order: c.lines.map((l) => l.id) };
    case "trace":
      return { type: c.type, values: Object.fromEntries(c.fields.map((f) => [f.id, ""])) };
    case "find_fix_bug":
      return { type: c.type, line: null, fix: null };
    case "code_write":
      return { type: c.type };
  }
}

/** The answer payload, or a reason it cannot be sent yet. */
export function toAnswer(d: Draft): { answer: unknown } | { missing: string } {
  switch (d.type) {
    case "multiple_choice":
      return d.selected.length
        ? { answer: { selected: d.selected } }
        : { missing: "Choose an answer." };
    case "predict_output":
      return d.output.trim() ? { answer: { output: d.output } } : { missing: "Type the output." };
    case "fill_blank":
      return Object.values(d.blanks).every((v) => v.trim())
        ? { answer: { blanks: d.blanks } }
        : { missing: "Fill in every blank." };
    case "order_lines":
      return { answer: { order: d.order } };
    case "trace":
      return Object.values(d.values).every((v) => v.trim())
        ? { answer: { values: d.values } }
        : { missing: "Fill in every value." };
    case "find_fix_bug":
      if (d.line === null) return { missing: "Choose the line with the bug." };
      if (d.fix === null) return { missing: "Choose a fix." };
      return { answer: { line: d.line, fix: d.fix } };
    case "code_write":
      return { missing: "Writing and running code is not available yet." };
  }
}

interface InputProps<T extends Draft["type"]> {
  challenge: Extract<PublicChallenge, { type: T }>;
  draft: Extract<Draft, { type: T }>;
  onChange: (d: Extract<Draft, { type: T }>) => void;
  disabled: boolean;
}

function MultipleChoice({ challenge, draft, onChange, disabled }: InputProps<"multiple_choice">) {
  const name = useId();
  const toggle = (id: string, checked: boolean) =>
    onChange({
      ...draft,
      selected: challenge.allowMultiple
        ? checked
          ? [...draft.selected, id]
          : draft.selected.filter((s) => s !== id)
        : [id],
    });
  return (
    <fieldset className="options" disabled={disabled}>
      <legend className="sr-only">
        {challenge.allowMultiple ? "Choose all that apply" : "Choose one answer"}
      </legend>
      {challenge.allowMultiple && <p className="dim">Choose all that apply.</p>}
      {challenge.options.map((o) => (
        <label className="option" key={o.id}>
          <input
            type={challenge.allowMultiple ? "checkbox" : "radio"}
            name={name}
            value={o.id}
            checked={draft.selected.includes(o.id)}
            onChange={(e) => toggle(o.id, e.target.checked)}
          />
          <span>
            <OptionText text={o.text} />
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Options may contain `code`; render it as code, never as HTML. */
function OptionText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(`[^`]+`)/g)
        .map((part, i) =>
          part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
            <code key={i}>{part.slice(1, -1)}</code>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
    </>
  );
}

function PredictOutput({ challenge, draft, onChange, disabled }: InputProps<"predict_output">) {
  const id = useId();
  return (
    <div className="stack">
      <CodeBlock code={challenge.code} stdin={challenge.stdin} />
      <div className="field">
        <label className="field__label" htmlFor={id}>
          What does the program print?
        </label>
        <textarea
          id={id}
          className="textarea"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={draft.output}
          onChange={(e) => onChange({ ...draft, output: e.target.value })}
          disabled={disabled}
          rows={Math.min(8, Math.max(3, challenge.code.split("\n").length))}
        />
        <span className="field__hint">
          One printed line per line. Spacing inside a line matters.
        </span>
      </div>
    </div>
  );
}

function FillBlank({ challenge, draft, onChange, disabled }: InputProps<"fill_blank">) {
  const parts = challenge.template.split(/(\{\{blank:[A-Za-z0-9._-]+\}\})/g);
  return (
    <figure className="code">
      <div className="code__label">
        <span>Python · fill in the blanks</span>
      </div>
      <pre className="template">
        <code>
          {parts.map((part, i) => {
            const m = /^\{\{blank:([A-Za-z0-9._-]+)\}\}$/.exec(part);
            if (!m) return <span key={i}>{part}</span>;
            const index = challenge.blanks.findIndex((b) => b.id === m[1]) + 1;
            const blank = challenge.blanks[index - 1];
            const value = draft.blanks[m[1]!] ?? "";
            return (
              <input
                key={i}
                className="blank"
                aria-label={blank?.label ?? `Blank ${index}`}
                style={{ "--w": Math.max(6, value.length + 1) } as React.CSSProperties}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                value={value}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...draft, blanks: { ...draft.blanks, [m[1]!]: e.target.value } })
                }
              />
            );
          })}
        </code>
      </pre>
    </figure>
  );
}

function OrderLines({ challenge, draft, onChange, disabled }: InputProps<"order_lines">) {
  const lines = new Map(challenge.lines.map((l) => [l.id, l]));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.order.length) return;
    const order = [...draft.order];
    [order[from], order[to]] = [order[to]!, order[from]!];
    onChange({ ...draft, order });
  };
  return (
    <div className="stack-s">
      <p className="dim">Use the arrow buttons to put the lines in an order that works.</p>
      <ol className="order-list" aria-label="Program lines in your order">
        {draft.order.map((id, i) => {
          const line = lines.get(id)!;
          return (
            <li key={id} className="order-item">
              <span className="order-item__index" aria-hidden="true">
                {i + 1}
              </span>
              <code>{" ".repeat(line.indent * 4) + line.text}</code>
              <span className="order-item__moves">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(i, i - 1)}
                  disabled={disabled || i === 0}
                  aria-label={`Move line ${i + 1} up: ${line.text}`}
                >
                  <Icon name="arrow-up" size={18} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(i, i + 1)}
                  disabled={disabled || i === draft.order.length - 1}
                  aria-label={`Move line ${i + 1} down: ${line.text}`}
                >
                  <Icon name="arrow-down" size={18} />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Trace({ challenge, draft, onChange, disabled }: InputProps<"trace">) {
  const base = useId();
  return (
    <div className="stack">
      <CodeBlock code={challenge.code} />
      <div className="trace-fields">
        {challenge.fields.map((f) => (
          <div className="field" key={f.id}>
            <label className="field__label" htmlFor={`${base}-${f.id}`}>
              {f.label}
            </label>
            <input
              id={`${base}-${f.id}`}
              className="input input--mono"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              value={draft.values[f.id] ?? ""}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...draft, values: { ...draft.values, [f.id]: e.target.value } })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FindFixBug({ challenge, draft, onChange, disabled }: InputProps<"find_fix_bug">) {
  const lineName = useId();
  const fixName = useId();
  return (
    <div className="stack">
      <fieldset className="options" disabled={disabled}>
        <legend className="field__label">1. Which line has the bug?</legend>
        <div className="line-picker">
          {challenge.code.split("\n").map((text, i) => (
            <label className="line-pick" key={i}>
              <input
                type="radio"
                name={lineName}
                value={i + 1}
                checked={draft.line === i + 1}
                onChange={() => onChange({ ...draft, line: i + 1 })}
              />
              <span className="line-pick__no" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <span className="sr-only">Line {i + 1}: </span>
                {text || " "}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="options" disabled={disabled}>
        <legend className="field__label">2. Which change fixes it?</legend>
        {challenge.fixes.map((f) => (
          <label className="option" key={f.id}>
            <input
              type="radio"
              name={fixName}
              value={f.id}
              checked={draft.fix === f.id}
              onChange={() => onChange({ ...draft, fix: f.id })}
            />
            <span>
              <OptionText text={f.text} />
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function AnswerInput({
  challenge,
  draft,
  onChange,
  disabled,
}: {
  challenge: PublicChallenge;
  draft: Draft;
  onChange: (d: Draft) => void;
  disabled: boolean;
}) {
  const props = { onChange, disabled } as const;
  switch (challenge.type) {
    case "multiple_choice":
      return <MultipleChoice challenge={challenge} draft={draft as never} {...props} />;
    case "predict_output":
      return <PredictOutput challenge={challenge} draft={draft as never} {...props} />;
    case "fill_blank":
      return <FillBlank challenge={challenge} draft={draft as never} {...props} />;
    case "order_lines":
      return <OrderLines challenge={challenge} draft={draft as never} {...props} />;
    case "trace":
      return <Trace challenge={challenge} draft={draft as never} {...props} />;
    case "find_fix_bug":
      return <FindFixBug challenge={challenge} draft={draft as never} {...props} />;
    case "code_write":
      return (
        <p className="notice-box">
          <Icon name="info" size={18} />
          Writing and running your own code needs a secure sandbox, which is not available yet.
        </p>
      );
  }
}
