/**
 * Human-review checklist for a content pack (DEC-011), generated from the content itself so
 * it always matches what learners see. It lists every claim a reviewer must check, including
 * answer keys (the document is for reviewers, not learners). It never records a review: only
 * a person editing `review.kind: human` in a level file does that.
 */
import { reviewStatus } from "./release";
import type { Challenge, ContentPack, Level } from "./schema";

const STATUS_TEXT = {
  human_reviewed: "Human-reviewed",
  ai_reviewed: "AI-reviewed only — human review pending",
  unreviewed: "Not reviewed",
} as const;

const fence = (code: string) => ["```", code, "```"].join("\n");
const inline = (text: string) => (text.includes("`") ? text : `\`${text}\``);
const quote = (text: string) => text.replace(/\n/g, " ");

function answerKey(c: Challenge): string[] {
  switch (c.type) {
    case "multiple_choice": {
      const correct = c.options.filter((o) => c.answer.correct.includes(o.id));
      return [
        `- Correct option${correct.length > 1 ? "s" : ""}: ${correct.map((o) => `${o.id}) ${quote(o.text)}`).join("; ")}`,
        `- Other options: ${c.options
          .filter((o) => !c.answer.correct.includes(o.id))
          .map((o) => `${o.id}) ${quote(o.text)}`)
          .join("; ")}`,
      ];
    }
    case "predict_output":
      return [
        "- Program:",
        "",
        fence(c.code),
        "",
        "- Expected output:",
        "",
        fence(c.answer.output),
        ...(c.answer.acceptedVariants.length
          ? ["", `- Also accepted: ${c.answer.acceptedVariants.map(inline).join(", ")}`]
          : []),
      ];
    case "fill_blank":
      return [
        "- Template:",
        "",
        fence(c.template),
        "",
        ...c.blanks.map(
          (b) => `- Blank \`${b.id}\` accepts: ${c.answer.accepted[b.id]!.map(inline).join(", ")}`,
        ),
      ];
    case "order_lines": {
      const text = new Map(c.lines.map((l) => [l.id, "    ".repeat(l.indent) + l.text]));
      return [
        `- ${c.answer.orders.length} accepted order(s). First accepted order:`,
        "",
        fence(c.answer.orders[0]!.map((id) => text.get(id)).join("\n")),
      ];
    }
    case "trace":
      return [
        "- Program:",
        "",
        fence(c.code),
        "",
        ...c.fields.map(
          (f) => `- ${quote(f.label)}: ${c.answer.values[f.id]!.map(inline).join(", ")}`,
        ),
      ];
    case "find_fix_bug": {
      const fix = c.fixes.find((f) => f.id === c.answer.fix)!;
      return [
        "- Program:",
        "",
        fence(c.code),
        "",
        `- Bug on line ${c.answer.line}; correct fix: ${quote(fix.text)}`,
        `- Other fixes offered: ${c.fixes
          .filter((f) => f.id !== c.answer.fix)
          .map((f) => quote(f.text))
          .join("; ")}`,
      ];
    }
    case "code_write":
      return ["- Code-writing challenge (needs a sandbox; not publishable yet)."];
  }
}

function challengeSection(c: Challenge, index: number): string[] {
  return [
    `#### Challenge ${index + 1} — \`${c.id}\` (${c.type.replace(/_/g, " ")}, ${c.role === "check" ? "knowledge check" : "exercise"}, difficulty ${c.difficulty}${c.required ? "" : ", optional"})`,
    "",
    `**Prompt:** ${quote(c.prompt)}`,
    "",
    ...answerKey(c),
    "",
    `- Hints: ${c.hints.map((h, i) => `(${i + 1}) ${quote(h)}`).join(" ")}`,
    ...(c.explanation
      ? [`- Explanation shown after a correct answer: ${quote(c.explanation)}`]
      : []),
    "",
    "- [ ] The answer key is correct for Python 3.10+.",
    "- [ ] Every reasonable correct answer is accepted (formatting, spacing, equivalent forms); nothing wrong is accepted.",
    "- [ ] Feedback for wrong answers is accurate and does not give the answer away.",
    "- [ ] Hints progress from a nudge to a strong clue, and none states the answer.",
    "- [ ] The explanation is correct and teaches the idea, not just the answer.",
    "",
  ];
}

function levelSection(level: Level, file: string, zone: string): string[] {
  const examples = level.lesson?.examples.length ?? 0;
  return [
    `### Level ${level.number} — ${level.title}`,
    "",
    `- Id \`${level.id}\` · zone ${zone} · ${level.kind} · file \`content/python-fundamentals/${file}\``,
    `- Review status: **${STATUS_TEXT[reviewStatus(level)]}**${level.review ? ` (recorded reviewer: ${level.review.reviewer}, ${level.review.date}, Python ${level.review.pythonVersion})` : ""}`,
    `- Automated evidence: ${examples} worked example(s) and every runnable answer key are executed with real CPython by \`npm run content:verify-python\` in CI; schema, hints and references by \`npm run content:validate\`.`,
    `- Play it: \`/play/level/${level.id}\``,
    "",
    "**Lesson**",
    "",
    "- [ ] Objectives are observable and match what the lesson teaches.",
    "- [ ] The explanation is accurate, beginner-appropriate and not misleadingly simplified.",
    "- [ ] Code in the lesson renders with correct indentation on desktop and phone.",
    "- [ ] Worked examples and captions say what the code really does.",
    "- [ ] Common mix-ups describe real misconceptions and correct them accurately.",
    "- [ ] The practical context is true and relevant.",
    `- [ ] Sources are appropriate (${level.sources.map((s) => `\`${s.source}\``).join(", ") || "none"}).`,
    "",
    ...level.challenges.flatMap(challengeSection),
    "**Sign-off** (a person, not an AI tool)",
    "",
    "- Reviewer name: ____________________  Date: __________",
    "- Decision: [ ] approve as is  [ ] approve after the changes noted  [ ] needs rework",
    "- Notes:",
    "",
  ];
}

export function reviewChecklist(pack: ContentPack): string {
  const published = pack.levels
    .filter((l) => l.status === "published")
    .sort((a, b) => a.number - b.number);
  const human = published.filter((l) => reviewStatus(l) === "human_reviewed").length;
  const zones = new Map(pack.meta.zones.map((z) => [z.id, z.title]));
  return [
    `# ${pack.meta.path.title} — human review checklist`,
    "",
    "<!-- Generated by `npm run content:review-checklist` from the content files. Do not edit by hand; edit the content and regenerate. -->",
    "",
    `**Status:** ${human} of ${published.length} published levels are human-reviewed. AI review (\`review.kind: agent\`) is recorded separately and never counts as human approval (DEC-011). Public release is blocked until every level is human-reviewed (\`npm run content:release-check\`).`,
    "",
    "This document contains answer keys. It is for reviewers only; it is not served to learners.",
    "",
    "## How to review a level",
    "",
    "1. Play the level in a local build (`npm run dev`, development sign-in) on a desktop and a phone-sized window.",
    "2. Work through the checklist below for the level. Run any code you doubt with Python 3.10 or newer.",
    "3. Fix problems in the level's YAML file, then run `npm run content:validate` and `npm run content:verify-python`.",
    "4. When you approve a level, edit its `review:` block yourself: `reviewer: <your name>`, `date: <YYYY-MM-DD>`, `kind: human`, the `pythonVersion` you checked with, and optional `notes`. AI tools must never set `kind: human`; validation rejects AI-looking reviewer names.",
    "5. Regenerate this checklist (`npm run content:review-checklist`) and commit both files.",
    "",
    "## Levels",
    "",
    ...published.flatMap((l) =>
      levelSection(l, pack.levelFiles[l.id] ?? "?", zones.get(l.zone) ?? l.zone),
    ),
  ].join("\n");
}
