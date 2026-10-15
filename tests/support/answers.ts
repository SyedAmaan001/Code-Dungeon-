import type { Challenge } from "@/learning/schema";

/** A correct submission built from the server-side answer key (tests only). */
export function correctSubmission(c: Challenge): unknown {
  switch (c.type) {
    case "multiple_choice":
      return { selected: c.answer.correct };
    case "predict_output":
      return { output: c.answer.output };
    case "fill_blank":
      return {
        blanks: Object.fromEntries(c.blanks.map((b) => [b.id, c.answer.accepted[b.id]![0]!])),
      };
    case "order_lines":
      return { order: c.answer.orders[0] };
    case "trace":
      return {
        values: Object.fromEntries(c.fields.map((f) => [f.id, c.answer.values[f.id]![0]!])),
      };
    case "find_fix_bug":
      return { line: c.answer.line, fix: c.answer.fix };
    case "code_write":
      throw new Error("code_write has no evaluator");
  }
}

/** A well-formed but wrong submission (tests only). */
export function wrongSubmission(c: Challenge): unknown {
  switch (c.type) {
    case "multiple_choice":
      return { selected: [c.options.find((o) => !c.answer.correct.includes(o.id))!.id] };
    case "predict_output":
      return { output: "definitely not the output" };
    case "fill_blank":
      return { blanks: Object.fromEntries(c.blanks.map((b) => [b.id, "zzz"])) };
    case "order_lines": {
      const accepted = new Set(c.answer.orders.map((o) => o.join("|")));
      const ids = c.lines.map((l) => l.id);
      const candidates = [ids, [...ids].reverse(), [...ids.slice(1), ids[0]!]];
      return { order: candidates.find((o) => !accepted.has(o.join("|"))) };
    }
    case "trace":
      return { values: Object.fromEntries(c.fields.map((f) => [f.id, "zzz"])) };
    case "find_fix_bug":
      return { line: c.answer.line, fix: c.fixes.find((f) => f.id !== c.answer.fix)!.id };
    case "code_write":
      throw new Error("code_write has no evaluator");
  }
}
