/**
 * Cross-reference and publication checks for a loaded content pack.
 * Implements the automated part of docs/CONTENT_QUALITY_STANDARD.md.
 * Every issue names the file, the level (when relevant) and the field.
 */
import { BUILT_IN_EVALUATORS } from "./evaluation/evaluators";
import { normalizeOutput, normalizeToken } from "./evaluation/normalize";
import type { ContentIssue } from "./issues";
import type { Challenge, ContentPack, Level, Predicate } from "./schema";

export interface ValidateOptions {
  /**
   * Whether a sandboxed CodeRunner is enabled. While false (the current state),
   * `code_write` challenges may exist as drafts but cannot be published.
   */
  codeRunnerEnabled: boolean;
  /** Challenge formats that have a registered evaluator. */
  evaluatorTypes: readonly string[];
}

export const DEFAULT_VALIDATE_OPTIONS: ValidateOptions = {
  codeRunnerEnabled: false,
  evaluatorTypes: BUILT_IN_EVALUATORS.map((e) => e.type),
};

/** Published challenges carry exactly this many progressive hints (nudge, clue, strong hint). */
export const REQUIRED_HINTS = 3;

const BLANK_PATTERN = /\{\{blank:([A-Za-z0-9._-]+)\}\}/g;

type Report = (at: string | undefined, message: string) => void;

export function validatePack(
  pack: ContentPack,
  options: Partial<ValidateOptions> = {},
): ContentIssue[] {
  const opts = { ...DEFAULT_VALIDATE_OPTIONS, ...options };
  const issues: ContentIssue[] = [];
  const add =
    (severity: ContentIssue["severity"], file?: string, level?: string) =>
    (at: string | undefined, message: string) =>
      issues.push({
        severity,
        ...(file && { file }),
        ...(level && { level }),
        ...(at && { at }),
        message,
      });
  const pathErr = add("error", "path.yaml");

  const { meta, levels, sources } = pack;
  const fileOf = (level: Level) => pack.levelFiles[level.id];

  // ---- Unique IDs (one namespace per pack, so any reference is unambiguous) ----
  const seen = new Map<string, string>();
  const claim = (id: string, what: string, report: Report) => {
    const prior = seen.get(id);
    if (prior) report("id", `duplicate id "${id}" (${what}; already used by ${prior})`);
    else seen.set(id, what);
  };
  claim(meta.subject.id, "subject", pathErr);
  claim(meta.path.id, "path", pathErr);
  meta.zones.forEach((z) => claim(z.id, "zone", pathErr));
  meta.quests.forEach((q) => claim(q.id, "quest", pathErr));
  meta.achievements.forEach((a) => claim(a.id, "achievement", pathErr));
  sources.forEach((s) => claim(s.id, "source", add("error", "sources.yaml")));
  for (const level of levels) {
    const report = add("error", fileOf(level), level.id);
    claim(level.id, "level", report);
    level.challenges.forEach((c) => claim(c.id, `challenge in ${level.id}`, report));
  }

  const zoneOrders = new Set<number>();
  for (const z of meta.zones) {
    if (zoneOrders.has(z.order)) pathErr(`zones.${z.id}.order`, `duplicate zone order ${z.order}`);
    zoneOrders.add(z.order);
  }

  // ---- Levels ----
  const levelById = new Map(levels.map((l) => [l.id, l]));
  const zoneIds = new Set(meta.zones.map((z) => z.id));
  const sourceIds = new Set(sources.map((s) => s.id));
  const numbers = new Map<number, string>();

  for (const level of levels) {
    const err = add("error", fileOf(level), level.id);
    const warn = add("warning", fileOf(level), level.id);

    const prior = numbers.get(level.number);
    if (prior) err("number", `level number ${level.number} already used by ${prior}`);
    else numbers.set(level.number, level.id);

    if (!zoneIds.has(level.zone)) err("zone", `unknown zone "${level.zone}"`);

    for (const pre of level.prerequisites) {
      const target = levelById.get(pre);
      if (pre === level.id) err("prerequisites", "a level cannot require itself");
      else if (!target) err("prerequisites", `unknown prerequisite level "${pre}"`);
      else if (level.status === "published" && target.status !== "published")
        err("prerequisites", `published level requires unpublished level "${pre}"`);
    }
    level.sources.forEach((ref, i) => {
      if (!sourceIds.has(ref.source)) err(`sources[${i}]`, `unknown source "${ref.source}"`);
    });

    level.challenges.forEach((c, i) => {
      const at = `challenges[${i}] (${c.id})`;
      checkChallengeConsistency(c, at, err);
      checkHints(c, at, err);
    });

    if (level.status === "published") checkPublishable(level, opts, err);
    if (level.status !== "draft" && level.challenges.length === 0)
      warn("challenges", `level in "${level.status}" state has no challenges yet`);
  }

  // ---- Progression graph ----
  for (const cycle of findCycles(levels)) {
    const first = levelById.get(cycle[0]!)!;
    add(
      "error",
      fileOf(first),
      first.id,
    )("prerequisites", `prerequisite cycle: ${cycle.join(" → ")}`);
  }
  const published = levels.filter((l) => l.status === "published");
  if (published.length > 0) {
    if (!published.some((l) => l.prerequisites.length === 0))
      pathErr(
        undefined,
        "no published level is unlockable at the start (every one has prerequisites)",
      );
    const reachable = reachableLevels(published);
    for (const l of published)
      if (!reachable.has(l.id))
        add(
          "error",
          fileOf(l),
          l.id,
        )("prerequisites", "level can never be unlocked from a starting level");

    const agentOnly = published.filter((l) => l.review?.kind === "agent").length;
    if (agentOnly > 0)
      add("warning", "path.yaml")(
        undefined,
        `${agentOnly} published level(s) were reviewed only by an AI agent and automated checks; human review is pending`,
      );
  }

  // ---- Quests and achievements reference real content ----
  const checkPredicate = (p: Predicate, at: string) => {
    if (p.kind === "complete_levels")
      p.levels.forEach((id) => levelById.has(id) || pathErr(at, `unknown level "${id}"`));
    if (p.kind === "complete_zone" && !zoneIds.has(p.zone)) pathErr(at, `unknown zone "${p.zone}"`);
  };
  meta.quests.forEach((q) =>
    q.objectives.forEach((o) => checkPredicate(o.predicate, `quests.${q.id}.${o.id}`)),
  );
  meta.achievements.forEach((a) => checkPredicate(a.predicate, `achievements.${a.id}`));

  return issues;
}

function checkChallengeConsistency(c: Challenge, at: string, err: Report) {
  const byAnswer = Object.keys(c.feedback?.byAnswer ?? {});
  const badKey = (key: string, why: string) =>
    err(`${at}.feedback.byAnswer`, `misconception key "${key}" ${why}`);

  switch (c.type) {
    case "multiple_choice": {
      const optionIds = new Set(c.options.map((o) => o.id));
      if (optionIds.size !== c.options.length) err(`${at}.options`, "duplicate option ids");
      c.answer.correct
        .filter((id) => !optionIds.has(id))
        .forEach((id) => err(`${at}.answer`, `answer references unknown option "${id}"`));
      if (!c.allowMultiple && c.answer.correct.length !== 1)
        err(`${at}.answer`, "single-answer multiple choice must have exactly one correct option");
      if (c.answer.correct.length >= c.options.length)
        err(`${at}.answer`, "at least one option must be incorrect");
      const correctKey = [...c.answer.correct].sort().join(",");
      for (const key of byAnswer) {
        if (key === correctKey) badKey(key, "is the correct answer");
        else if (key.split(",").some((id) => !optionIds.has(id)))
          badKey(key, "names an unknown option");
      }
      break;
    }
    case "predict_output": {
      const accepted = [c.answer.output, ...c.answer.acceptedVariants].map(normalizeOutput);
      for (const key of byAnswer)
        if (accepted.includes(normalizeOutput(key))) badKey(key, "is an accepted answer");
      break;
    }
    case "fill_blank": {
      const declared = new Set(c.blanks.map((b) => b.id));
      const inTemplate = new Set([...c.template.matchAll(BLANK_PATTERN)].map((m) => m[1]!));
      for (const id of declared) {
        if (!inTemplate.has(id))
          err(`${at}.template`, `blank "${id}" does not appear in the template`);
        if (!c.answer.accepted[id]) err(`${at}.answer`, `blank "${id}" has no accepted answers`);
      }
      for (const id of inTemplate)
        if (!declared.has(id))
          err(`${at}.template`, `template placeholder "${id}" is not declared`);
      if (c.blanks.length === 1) {
        const accepted = (c.answer.accepted[c.blanks[0]!.id] ?? []).map(normalizeToken);
        for (const key of byAnswer)
          if (accepted.includes(normalizeToken(key))) badKey(key, "is an accepted answer");
      }
      break;
    }
    case "order_lines": {
      const ids = c.lines.map((l) => l.id);
      if (new Set(ids).size !== ids.length) err(`${at}.lines`, "duplicate line ids");
      const sorted = [...ids].sort().join("|");
      c.answer.orders.forEach((order, i) => {
        if ([...order].sort().join("|") !== sorted)
          err(`${at}.answer.orders[${i}]`, "an accepted order must use every line exactly once");
      });
      break;
    }
    case "trace": {
      for (const f of c.fields)
        if (!c.answer.values[f.id]) err(`${at}.answer`, `field "${f.id}" has no accepted values`);
      for (const id of Object.keys(c.answer.values))
        if (!c.fields.some((f) => f.id === id))
          err(`${at}.answer`, `answer for unknown field "${id}"`);
      break;
    }
    case "find_fix_bug": {
      const lineCount = c.code.split("\n").length;
      if (c.answer.line > lineCount)
        err(
          `${at}.answer.line`,
          `answer line ${c.answer.line} is beyond the ${lineCount}-line program`,
        );
      if (!c.fixes.some((f) => f.id === c.answer.fix))
        err(`${at}.answer.fix`, `answer references unknown fix "${c.answer.fix}"`);
      if (c.fixedCode !== undefined && c.fixedCode.trim() === c.code.trim())
        err(`${at}.fixedCode`, "fixedCode is identical to the buggy code");
      for (const key of byAnswer) {
        const m = /^(fix|line):(.+)$/.exec(key);
        if (!m) badKey(key, 'must look like "fix:<id>" or "line:<number>"');
        else if (m[1] === "fix" && (m[2] === c.answer.fix || !c.fixes.some((f) => f.id === m[2])))
          badKey(key, "must name a wrong fix that exists");
        else if (m[1] === "line" && Number(m[2]) === c.answer.line)
          badKey(key, "is the correct line");
      }
      break;
    }
    case "code_write":
      break;
  }
}

/** Hints must be distinct and must not simply contain the answer. */
function checkHints(c: Challenge, at: string, err: Report) {
  const field = `${at}.hints`;
  if (new Set(c.hints.map((h) => h.trim().toLowerCase())).size !== c.hints.length)
    err(field, "hints must be distinct (each one should add a new clue)");

  const secrets: string[] = [];
  if (c.type === "predict_output")
    secrets.push(...[c.answer.output, ...c.answer.acceptedVariants].map(normalizeOutput));
  if (c.type === "multiple_choice")
    secrets.push(...c.options.filter((o) => c.answer.correct.includes(o.id)).map((o) => o.text));
  if (c.type === "fill_blank") secrets.push(...Object.values(c.answer.accepted).flat());
  const revealing = secrets.filter((s) => s.trim().length >= 6);
  c.hints.forEach((hint, i) => {
    const leaked = revealing.find((s) => hint.includes(s.trim()));
    if (leaked) err(`${field}[${i}]`, `hint ${i + 1} reveals the answer ("${leaked.trim()}")`);
  });
}

function checkPublishable(level: Level, options: ValidateOptions, err: Report) {
  const missing = (at: string, what: string) => err(at, `published level is missing ${what}`);
  if (!level.description) missing("description", "a description");
  if (!level.lesson) missing("lesson", "a lesson");
  else {
    if (level.lesson.examples.length === 0) missing("lesson.examples", "a verified worked example");
    if (!level.lesson.practicalContext) missing("lesson.practicalContext", "a practical context");
  }
  if (level.challenges.length === 0) missing("challenges", "at least one challenge");
  if (!level.challenges.some((c) => c.role === "exercise"))
    missing("challenges", 'an exercise (role: "exercise")');
  if (!level.challenges.some((c) => c.role === "check"))
    missing("challenges", 'a knowledge check (role: "check")');
  if (!level.challenges.some((c) => c.required)) missing("challenges", "a required challenge");
  if (level.sources.length === 0) missing("sources", "at least one source reference");
  if (!level.review) missing("review", "review metadata (reviewer, date, pythonVersion)");
  if (level.estimatedMinutes === undefined) missing("estimatedMinutes", "estimatedMinutes");

  level.challenges.forEach((c, i) => {
    const at = `challenges[${i}] (${c.id})`;
    if (!c.feedback) err(`${at}.feedback`, "published challenge needs correct/incorrect feedback");
    if (!c.explanation) err(`${at}.explanation`, "published challenge needs an explanation");
    if (c.hints.length !== REQUIRED_HINTS)
      err(
        `${at}.hints`,
        `published challenge needs exactly ${REQUIRED_HINTS} progressive hints (has ${c.hints.length})`,
      );
    if (c.type === "code_write" && !options.codeRunnerEnabled)
      err(at, "code_write challenges cannot be published while live code execution is disabled");
    else if (!options.evaluatorTypes.includes(c.type))
      err(`${at}.type`, `no evaluator is registered for "${c.type}"`);
    const python = "language" in c && c.language === "python";
    if (python && c.type === "fill_blank" && !c.check)
      err(`${at}.check`, "published fill_blank needs a check so every accepted answer is run");
    if (python && c.type === "order_lines" && !c.check)
      err(`${at}.check`, "published order_lines needs a check so every accepted order is run");
    if (python && c.type === "find_fix_bug" && !(c.buggyBehaviour && c.fixedCode && c.check))
      err(
        at,
        "published find_fix_bug needs buggyBehaviour, fixedCode and check so the bug and fix are proven",
      );
  });
}

/** Levels reachable from levels with no prerequisites, following only the given levels. */
export function reachableLevels(levels: readonly Level[]): Set<string> {
  const reachable = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const l of levels) {
      if (!reachable.has(l.id) && l.prerequisites.every((p) => reachable.has(p))) {
        reachable.add(l.id);
        grew = true;
      }
    }
  }
  return reachable;
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
