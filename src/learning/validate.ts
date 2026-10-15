/**
 * Cross-reference and publication checks for a loaded content pack.
 * Implements the automated part of docs/CONTENT_QUALITY_STANDARD.md.
 */
import type { ContentIssue } from "./issues";
import type { Challenge, ContentPack, Level, Predicate } from "./schema";

export interface ValidateOptions {
  /**
   * Whether a sandboxed CodeRunner is enabled. While false (the current state),
   * `code_write` challenges may exist as drafts but cannot be published.
   */
  codeRunnerEnabled: boolean;
}

export const DEFAULT_VALIDATE_OPTIONS: ValidateOptions = { codeRunnerEnabled: false };

const BLANK_PATTERN = /\{\{blank:([A-Za-z0-9._-]+)\}\}/g;

export function validatePack(
  pack: ContentPack,
  options: ValidateOptions = DEFAULT_VALIDATE_OPTIONS,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const err = (file: string | undefined, at: string | undefined, message: string) =>
    issues.push({ severity: "error", file, at, message });
  const warn = (file: string | undefined, at: string | undefined, message: string) =>
    issues.push({ severity: "warning", file, at, message });

  const { meta, levels, sources } = pack;
  const fileOf = (level: Level) => pack.levelFiles[level.id];

  // ---- Unique IDs (one namespace per pack, so any reference is unambiguous) ----
  const seen = new Map<string, string>();
  const claim = (id: string, what: string, file?: string) => {
    const prior = seen.get(id);
    if (prior) err(file, undefined, `duplicate id "${id}" (${what}; already used by ${prior})`);
    else seen.set(id, what);
  };
  claim(meta.subject.id, "subject", "path.yaml");
  claim(meta.path.id, "path", "path.yaml");
  meta.zones.forEach((z) => claim(z.id, "zone", "path.yaml"));
  meta.quests.forEach((q) => claim(q.id, "quest", "path.yaml"));
  meta.achievements.forEach((a) => claim(a.id, "achievement", "path.yaml"));
  sources.forEach((s) => claim(s.id, "source", "sources.yaml"));
  for (const level of levels) {
    claim(level.id, "level", fileOf(level));
    level.challenges.forEach((c) => claim(c.id, `challenge in ${level.id}`, fileOf(level)));
  }

  const zoneOrders = new Set<number>();
  for (const z of meta.zones) {
    if (zoneOrders.has(z.order))
      err("path.yaml", `zones.${z.id}`, `duplicate zone order ${z.order}`);
    zoneOrders.add(z.order);
  }

  // ---- Levels ----
  const levelById = new Map(levels.map((l) => [l.id, l]));
  const zoneIds = new Set(meta.zones.map((z) => z.id));
  const sourceIds = new Set(sources.map((s) => s.id));
  const numbers = new Map<number, string>();

  for (const level of levels) {
    const file = fileOf(level);
    const prior = numbers.get(level.number);
    if (prior) err(file, "number", `level number ${level.number} already used by ${prior}`);
    else numbers.set(level.number, level.id);

    if (!zoneIds.has(level.zone)) err(file, "zone", `unknown zone "${level.zone}"`);

    for (const pre of level.prerequisites) {
      const target = levelById.get(pre);
      if (pre === level.id) err(file, "prerequisites", "a level cannot require itself");
      else if (!target) err(file, "prerequisites", `unknown prerequisite level "${pre}"`);
      else if (level.status === "published" && target.status !== "published")
        err(file, "prerequisites", `published level requires unpublished level "${pre}"`);
    }
    for (const ref of level.sources) {
      if (!sourceIds.has(ref.source)) err(file, "sources", `unknown source "${ref.source}"`);
    }

    level.challenges.forEach((c, i) =>
      checkChallengeConsistency(c, `challenges[${i}] (${c.id})`, file, err),
    );

    if (level.status === "published") checkPublishable(level, file, options, err);
    if (level.status !== "draft" && level.challenges.length === 0)
      warn(file, undefined, `level in "${level.status}" state has no challenges yet`);
  }

  // ---- Prerequisite graph must be acyclic ----
  for (const cycle of findCycles(levels)) {
    err(
      fileOf(levelById.get(cycle[0]!)!),
      "prerequisites",
      `prerequisite cycle: ${cycle.join(" → ")}`,
    );
  }

  // ---- Quests and achievements reference real content ----
  const checkPredicate = (p: Predicate, at: string) => {
    if (p.kind === "complete_levels")
      p.levels.forEach((id) => levelById.has(id) || err("path.yaml", at, `unknown level "${id}"`));
    if (p.kind === "complete_zone" && !zoneIds.has(p.zone))
      err("path.yaml", at, `unknown zone "${p.zone}"`);
  };
  meta.quests.forEach((q) =>
    q.objectives.forEach((o) => checkPredicate(o.predicate, `quests.${q.id}.${o.id}`)),
  );
  meta.achievements.forEach((a) => checkPredicate(a.predicate, `achievements.${a.id}`));

  return issues;
}

type Report = (file: string | undefined, at: string | undefined, message: string) => void;

function checkChallengeConsistency(
  c: Challenge,
  at: string,
  file: string | undefined,
  err: Report,
) {
  switch (c.type) {
    case "multiple_choice": {
      const optionIds = new Set(c.options.map((o) => o.id));
      if (optionIds.size !== c.options.length) err(file, at, "duplicate option ids");
      c.answer.correct
        .filter((id) => !optionIds.has(id))
        .forEach((id) => err(file, at, `answer references unknown option "${id}"`));
      if (!c.allowMultiple && c.answer.correct.length !== 1)
        err(file, at, "single-answer multiple choice must have exactly one correct option");
      if (c.answer.correct.length >= c.options.length)
        err(file, at, "at least one option must be incorrect");
      break;
    }
    case "fill_blank": {
      const declared = new Set(c.blanks.map((b) => b.id));
      const inTemplate = new Set([...c.template.matchAll(BLANK_PATTERN)].map((m) => m[1]!));
      for (const id of declared) {
        if (!inTemplate.has(id)) err(file, at, `blank "${id}" does not appear in the template`);
        if (!c.answer.accepted[id]) err(file, at, `blank "${id}" has no accepted answers`);
      }
      for (const id of inTemplate)
        if (!declared.has(id)) err(file, at, `template placeholder "${id}" is not declared`);
      break;
    }
    case "order_lines": {
      const ids = c.lines.map((l) => l.id);
      if (new Set(ids).size !== ids.length) err(file, at, "duplicate line ids");
      const sorted = [...ids].sort().join("|");
      c.answer.orders.forEach((order, i) => {
        if ([...order].sort().join("|") !== sorted)
          err(file, at, `answer order ${i} must use every line exactly once`);
      });
      break;
    }
    case "trace": {
      for (const f of c.fields)
        if (!c.answer.values[f.id]) err(file, at, `field "${f.id}" has no accepted values`);
      for (const id of Object.keys(c.answer.values))
        if (!c.fields.some((f) => f.id === id)) err(file, at, `answer for unknown field "${id}"`);
      break;
    }
    case "find_fix_bug": {
      const lineCount = c.code.split("\n").length;
      if (c.answer.line > lineCount)
        err(file, at, `answer line ${c.answer.line} is beyond the ${lineCount}-line program`);
      if (!c.fixes.some((f) => f.id === c.answer.fix))
        err(file, at, `answer references unknown fix "${c.answer.fix}"`);
      break;
    }
    case "predict_output":
    case "code_write":
      break; // Outputs are verified against real Python by content:verify-python.
  }
}

function checkPublishable(
  level: Level,
  file: string | undefined,
  options: ValidateOptions,
  err: Report,
) {
  const missing = (what: string) => err(file, undefined, `published level is missing ${what}`);
  if (!level.lesson) missing("a lesson");
  else if (!level.lesson.example) missing("a verified lesson example");
  if (level.challenges.length === 0) missing("at least one challenge");
  if (level.sources.length === 0) missing("at least one source reference");
  if (!level.review) missing("review metadata (reviewer, date, pythonVersion)");
  if (level.estimatedMinutes === undefined) missing("estimatedMinutes");

  level.challenges.forEach((c, i) => {
    const at = `challenges[${i}] (${c.id})`;
    if (!c.feedback) err(file, at, "published challenge needs correct/incorrect feedback");
    if (!c.explanation) err(file, at, "published challenge needs an explanation");
    if (c.type === "code_write" && !options.codeRunnerEnabled)
      err(
        file,
        at,
        "code_write challenges cannot be published while live code execution is disabled",
      );
  });
}

/** Returns each distinct cycle once, as a list of level ids ending where it started. */
export function findCycles(levels: readonly Level[]): string[][] {
  const deps = new Map(levels.map((l) => [l.id, l.prerequisites.filter((p) => p !== l.id)]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const cycles: string[][] = [];

  const visit = (id: string) => {
    state.set(id, "visiting");
    stack.push(id);
    for (const next of deps.get(id) ?? []) {
      if (!deps.has(next)) continue; // unknown ids are reported separately
      if (state.get(next) === "visiting") cycles.push([...stack.slice(stack.indexOf(next)), next]);
      else if (!state.has(next)) visit(next);
    }
    stack.pop();
    state.set(id, "done");
  };
  for (const l of levels) if (!state.has(l.id)) visit(l.id);
  return cycles;
}

/** Topological order of level ids (prerequisites first). Throws if the graph has a cycle. */
export function prerequisiteOrder(levels: readonly Level[]): string[] {
  if (findCycles(levels).length) throw new Error("prerequisite graph has a cycle");
  const byId = new Map(levels.map((l) => [l.id, l]));
  const out: string[] = [];
  const done = new Set<string>();
  const visit = (id: string) => {
    if (done.has(id) || !byId.has(id)) return;
    done.add(id);
    byId.get(id)!.prerequisites.forEach(visit);
    out.push(id);
  };
  [...levels].sort((a, b) => a.number - b.number).forEach((l) => visit(l.id));
  return out;
}
