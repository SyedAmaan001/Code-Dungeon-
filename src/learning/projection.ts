/**
 * Public projection: the only shape of content that may reach a browser.
 *
 * Built field-by-field (a whitelist), so answers, feedback, hints and explanations
 * can never leak because a new key field was added to the schema. The matching
 * server-only accessor for answer keys lives in ./keys.ts.
 */
import type { Challenge, Level } from "./schema";

interface PublicChallengeBase {
  id: string;
  version: number;
  difficulty: number;
  prompt: string;
  hintCount: number;
}

export type PublicChallenge = PublicChallengeBase &
  (
    | { type: "multiple_choice"; options: { id: string; text: string }[]; allowMultiple: boolean }
    | { type: "predict_output"; language: string; code: string; stdin?: string }
    | {
        type: "fill_blank";
        language: string;
        template: string;
        blanks: { id: string; label?: string }[];
      }
    | {
        type: "order_lines";
        language: string;
        lines: { id: string; text: string; indent: number }[];
      }
    | { type: "trace"; language: string; code: string; fields: { id: string; label: string }[] }
    | {
        type: "find_fix_bug";
        language: string;
        code: string;
        fixes: { id: string; text: string }[];
      }
    | { type: "code_write"; language: string; starterCode: string }
  );

export interface PublicLevel {
  id: string;
  version: number;
  number: number;
  zone: string;
  title: string;
  kind: Level["kind"];
  prerequisites: string[];
  estimatedMinutes?: number;
  lesson?: {
    objective: string;
    explanation: string;
    example?: { code: string; expectedOutput?: string };
    misconceptions: string[];
  };
  challenges: PublicChallenge[];
}

export function toPublicLevel(level: Level): PublicLevel {
  return {
    id: level.id,
    version: level.version,
    number: level.number,
    zone: level.zone,
    title: level.title,
    kind: level.kind,
    prerequisites: [...level.prerequisites],
    ...(level.estimatedMinutes !== undefined && { estimatedMinutes: level.estimatedMinutes }),
    ...(level.lesson && {
      lesson: {
        objective: level.lesson.objective,
        explanation: level.lesson.explanation,
        ...(level.lesson.example && {
          example: {
            code: level.lesson.example.code,
            ...(level.lesson.example.expectedOutput !== undefined && {
              expectedOutput: level.lesson.example.expectedOutput,
            }),
          },
        }),
        misconceptions: [...level.lesson.misconceptions],
      },
    }),
    challenges: level.challenges.map(toPublicChallenge),
  };
}

export function toPublicChallenge(c: Challenge): PublicChallenge {
  const base: PublicChallengeBase = {
    id: c.id,
    version: c.version,
    difficulty: c.difficulty,
    prompt: c.prompt,
    hintCount: c.hints.length,
  };
  switch (c.type) {
    case "multiple_choice":
      return {
        ...base,
        type: c.type,
        options: c.options.map((o) => ({ id: o.id, text: o.text })),
        allowMultiple: c.allowMultiple,
      };
    case "predict_output":
      return {
        ...base,
        type: c.type,
        language: c.language,
        code: c.code,
        ...(c.stdin !== undefined && { stdin: c.stdin }),
      };
    case "fill_blank":
      return {
        ...base,
        type: c.type,
        language: c.language,
        template: c.template,
        blanks: c.blanks.map((b) => ({ id: b.id, ...(b.label && { label: b.label }) })),
      };
    case "order_lines":
      return {
        ...base,
        type: c.type,
        language: c.language,
        lines: displayOrder(c).map((l) => ({ id: l.id, text: l.text, indent: l.indent })),
      };
    case "trace":
      return {
        ...base,
        type: c.type,
        language: c.language,
        code: c.code,
        fields: c.fields.map((f) => ({ id: f.id, label: f.label })),
      };
    case "find_fix_bug":
      return {
        ...base,
        type: c.type,
        language: c.language,
        code: c.code,
        fixes: c.fixes.map((f) => ({ id: f.id, text: f.text })),
      };
    case "code_write":
      return { ...base, type: c.type, language: c.language, starterCode: c.starterCode };
  }
}

type OrderLines = Extract<Challenge, { type: "order_lines" }>;

/**
 * Authors usually write lines in the correct order, so showing them as authored
 * would reveal the answer. Shuffle deterministically (seeded by the challenge id,
 * so every learner and every render sees the same order) and never show an
 * accepted order.
 */
export function displayOrder(c: OrderLines): OrderLines["lines"] {
  const accepted = new Set(c.answer.orders.map((o) => o.join("|")));
  const random = mulberry32(hashString(c.id));
  const lines = [...c.lines];
  for (let attempt = 0; attempt < 20; attempt++) {
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [lines[i], lines[j]] = [lines[j]!, lines[i]!];
    }
    if (!accepted.has(lines.map((l) => l.id).join("|"))) return lines;
  }
  // Pathological case (e.g. every permutation accepted): fall back to a rotation.
  return [...c.lines.slice(1), c.lines[0]!];
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
