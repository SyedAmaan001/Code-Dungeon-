/**
 * Content-pack schemas for the learning engine.
 *
 * A content pack is one learning path stored as data under `content/<pack>/`:
 *   path.yaml      subject, path, zones, quests, achievements
 *   sources.yaml   reference registry (title, edition/version, licence, review date)
 *   levels/*.yaml  one level per file
 *
 * These schemas check structure only. Cross-references (unique IDs, prerequisites,
 * publication completeness) are checked by `validatePack` in ./validate.ts.
 * Nothing here is specific to Python or to 25 levels.
 */
import { z } from "zod";

/**
 * Content format version. v2 (Phase 2): lesson objectives[]/examples[]/practicalContext,
 * level description, challenge role/required, ≤3 progressive hints, and verifiable
 * checks for fill_blank, order_lines, trace and find_fix_bug.
 */
export const SCHEMA_VERSION = 2;

/** Stable identifier: never reused, never derived from a display title. e.g. `py.L003`, `py.L003.c1`. */
export const Id = z
  .string()
  .regex(/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/, "IDs use letters, digits and . _ - separators");

const Text = z.string().trim().min(1);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dates use YYYY-MM-DD");

export const PublicationStatus = z.enum(["draft", "review", "published"]);
export type PublicationStatus = z.infer<typeof PublicationStatus>;

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export const Source = z.strictObject({
  id: Id,
  title: Text,
  author: Text.optional(),
  /** Edition, documentation version or release the content was checked against. */
  edition: Text,
  url: z.url().optional(),
  licence: Text,
  reviewed: IsoDate,
  notes: Text.optional(),
});
export type Source = z.infer<typeof Source>;

export const SourcesFile = z.strictObject({
  sources: z.array(Source),
});

// ---------------------------------------------------------------------------
// Runnable code (lesson examples, predict-output challenges)
// ---------------------------------------------------------------------------

export const CodeLanguage = z.enum(["python"]);

const expectationFields = {
  stdin: z.string().optional(),
  /** Exact stdout (trailing whitespace per line and trailing blank lines are ignored). */
  expectedOutput: z.string().optional(),
  /** For programs that deliberately fail: the exception class name on the final traceback line. */
  expectedException: Id.optional(),
};

const exactlyOneExpectation = (e: { expectedOutput?: string; expectedException?: string }) =>
  (e.expectedOutput === undefined) !== (e.expectedException === undefined);
const exactlyOneMessage = {
  message: "declare exactly one of expectedOutput or expectedException",
};

/** What running a program must produce; verified by `npm run content:verify-python`. */
export const Expectation = z
  .strictObject(expectationFields)
  .refine(exactlyOneExpectation, exactlyOneMessage);
export type Expectation = z.infer<typeof Expectation>;

/** A worked example whose real output is verified by `npm run content:verify-python`. */
export const VerifiedExample = z
  .strictObject({
    code: Text,
    /** Optional one-line note shown with the example. */
    caption: Text.optional(),
    ...expectationFields,
  })
  .refine(exactlyOneExpectation, exactlyOneMessage);
export type VerifiedExample = z.infer<typeof VerifiedExample>;

// ---------------------------------------------------------------------------
// Challenges — public fields vs answer keys
//
// Fields under `answer`, `feedback`, `hints` and `explanation` are server-only.
// The public projection (./projection.ts) is a whitelist, so a new key field can
// never leak by accident.
// ---------------------------------------------------------------------------

const Feedback = z.strictObject({
  correct: Text,
  /** Default feedback for any wrong answer. */
  incorrect: Text,
  /** Targeted feedback keyed by a likely wrong answer (normalised). */
  byAnswer: z.record(z.string(), Text).optional(),
});

export const ChallengeRole = z.enum(["exercise", "check"]);

const ChallengeBase = {
  id: Id,
  version: z.int().positive(),
  difficulty: z.int().min(1).max(3),
  /** `exercise` = practice; `check` = short knowledge check used for mastery. */
  role: ChallengeRole.default("exercise"),
  /** Required challenges must be answered correctly to complete the level. */
  required: z.boolean().default(true),
  prompt: Text,
  feedback: Feedback.optional(),
  /**
   * Progressive hints, revealed one at a time and in order:
   * 1 = gentle nudge, 2 = specific conceptual clue, 3 = strong hint that still
   * leaves the final step to the learner. Published challenges need all three.
   */
  hints: z.array(Text).max(3).default([]),
  /** Why the correct answer is correct; shown after submission. */
  explanation: Text.optional(),
};

const Option = z.strictObject({ id: Id, text: Text });

export const MultipleChoiceChallenge = z.strictObject({
  ...ChallengeBase,
  type: z.literal("multiple_choice"),
  options: z.array(Option).min(2),
  allowMultiple: z.boolean().default(false),
  answer: z.strictObject({ correct: z.array(Id).min(1) }),
});

export const PredictOutputChallenge = z.strictObject({
  ...ChallengeBase,
  type: z.literal("predict_output"),
  language: CodeLanguage.default("python"),
  code: Text,
  stdin: z.string().optional(),
  answer: z.strictObject({
    /** Verified against real Python by content:verify-python. */
    output: z.string(),
    acceptedVariants: z.array(z.string()).default([]),
  }),
});

/** `template` contains placeholders `{{blank:<id>}}` that match `blanks`. */
export const FillBlankChallenge = z.strictObject({
  ...ChallengeBase,
  type: z.literal("fill_blank"),
  language: CodeLanguage.default("python"),
  template: Text,
  blanks: z.array(z.strictObject({ id: Id, label: Text.optional() })).min(1),
  answer: z.strictObject({ accepted: z.record(Id, z.array(Text).min(1)) }),
  /** Every accepted answer, substituted into the template, must produce this. */
  check: Expectation.optional(),
});

export const OrderLinesChallenge = z.strictObject({
  ...ChallengeBase,
  type: z.literal("order_lines"),
  language: CodeLanguage.default("python"),
  lines: z
    .array(z.strictObject({ id: Id, text: Text, indent: z.int().min(0).max(8).default(0) }))
    .min(2),
  answer: z.strictObject({ orders: z.array(z.array(Id).min(2)).min(1) }),
  /** Every accepted order, assembled with 4-space indents, must produce this. */
  check: Expectation.optional(),
});

export const TraceChallenge = z.strictObject({
  ...ChallengeBase,
  type: z.literal("trace"),
  language: CodeLanguage.default("python"),
  code: Text,
  fields: z
    .array(
      z.strictObject({
        id: Id,
        label: Text,
        /** Python expression whose str() is the expected value (defaults to the field id). */
        expression: Text.optional(),
      }),
    )
    .min(1),
  answer: z.strictObject({ values: z.record(Id, z.array(Text).min(1)) }),
});

export const FindFixBugChallenge = z.strictObject({
  ...ChallengeBase,
  type: z.literal("find_fix_bug"),
  language: CodeLanguage.default("python"),
  code: Text,
  fixes: z.array(Option).min(2),
  answer: z.strictObject({ line: z.int().positive(), fix: Id }),
  /** What the buggy program actually does (proves the bug is real). */
  buggyBehaviour: Expectation.optional(),
  /** The program with the correct fix applied, and what it must produce. */
  fixedCode: Text.optional(),
  check: Expectation.optional(),
});

/** Requires a sandboxed CodeRunner. Cannot be published while live execution is disabled. */
export const CodeWriteChallenge = z.strictObject({
  ...ChallengeBase,
  type: z.literal("code_write"),
  language: CodeLanguage.default("python"),
  starterCode: z.string().default(""),
  answer: z.strictObject({
    tests: z
      .array(z.strictObject({ stdin: z.string().optional(), expectedOutput: z.string() }))
      .min(1),
  }),
});

export const Challenge = z.discriminatedUnion("type", [
  MultipleChoiceChallenge,
  PredictOutputChallenge,
  FillBlankChallenge,
  OrderLinesChallenge,
  TraceChallenge,
  FindFixBugChallenge,
  CodeWriteChallenge,
]);
export type Challenge = z.infer<typeof Challenge>;
export type ChallengeType = Challenge["type"];
export const CHALLENGE_TYPES = [
  "multiple_choice",
  "predict_output",
  "fill_blank",
  "order_lines",
  "trace",
  "find_fix_bug",
  "code_write",
] as const satisfies readonly ChallengeType[];

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export const Lesson = z.strictObject({
  /** Observable abilities, e.g. "Predict what print() shows for a string literal." */
  objectives: z.array(Text).min(1),
  /** Original beginner-friendly explanation (Markdown-light: paragraphs and `code`). */
  explanation: Text,
  /** Worked examples, each verified against real Python. */
  examples: z.array(VerifiedExample).default([]),
  misconceptions: z.array(Text).default([]),
  /** Where this is useful outside the game. */
  practicalContext: Text.optional(),
});

export const LevelKind = z.enum(["standard", "checkpoint", "major", "boss"]);

export const Level = z.strictObject({
  id: Id,
  version: z.int().positive(),
  /** Position in the path. Data, not UI: any positive integer, unique within the path. */
  number: z.int().positive(),
  zone: Id,
  title: Text,
  /** One or two sentences shown on the map/room card. */
  description: Text.optional(),
  status: PublicationStatus,
  kind: LevelKind.default("standard"),
  /** Planning note for drafts (topics to cover). Never shown to learners. */
  outline: Text.optional(),
  prerequisites: z.array(Id).default([]),
  skills: z.array(Id).default([]),
  estimatedMinutes: z.int().positive().optional(),
  /** Drafts may be outlines; validatePack enforces completeness for published levels. */
  lesson: Lesson.optional(),
  challenges: z.array(Challenge).default([]),
  sources: z.array(z.strictObject({ source: Id, topic: Text.optional() })).default([]),
  review: z
    .strictObject({
      reviewer: Text,
      date: IsoDate,
      /** Python version the examples and answer keys were verified with. */
      pythonVersion: z.string().regex(/^3\.\d+$/),
      /**
       * Required, never defaulted (DEC-011): `agent` = written/checked by an AI agent and
       * automated tests; `human` = a person reviewed it. AI review is never human approval.
       */
      kind: z.enum(["agent", "human"]),
      notes: Text.optional(),
    })
    .optional(),
});
export type Level = z.infer<typeof Level>;

// ---------------------------------------------------------------------------
// Path, zones, quests, achievements
// ---------------------------------------------------------------------------

export const EncounterKind = z.enum(["checkpoint", "major", "boss"]);

/**
 * Closed vocabulary evaluated by the game engine (src/domain/game/predicates.ts).
 * Content can never carry executable rules. Phase 3 added level_unlocked,
 * master_level_count and the encounter predicates (additive: v2 files still parse).
 */
export const Predicate = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("complete_levels"), levels: z.array(Id).min(1) }),
  z.strictObject({ kind: z.literal("complete_level_count"), count: z.int().positive() }),
  z.strictObject({ kind: z.literal("complete_zone"), zone: Id }),
  z.strictObject({
    kind: z.literal("correct_challenges_of_type"),
    challengeType: z.enum(CHALLENGE_TYPES),
    count: z.int().positive(),
  }),
  z.strictObject({ kind: z.literal("level_no_hints_first_try"), count: z.int().positive() }),
  z.strictObject({ kind: z.literal("earn_xp"), amount: z.int().positive() }),
  z.strictObject({ kind: z.literal("level_unlocked"), level: Id }),
  z.strictObject({ kind: z.literal("master_level_count"), count: z.int().positive() }),
  /** Win the encounter on one checkpoint, major or boss level. */
  z.strictObject({ kind: z.literal("encounter_won"), level: Id }),
  /** Win `count` encounters, optionally of one kind. */
  z.strictObject({
    kind: z.literal("encounters_won"),
    encounterKind: EncounterKind.optional(),
    count: z.int().positive(),
  }),
  /** Win `count` encounters without losing a life or revealing a hint during the winning run. */
  z.strictObject({
    kind: z.literal("flawless_encounters"),
    encounterKind: EncounterKind.optional(),
    count: z.int().positive(),
  }),
]);
export type Predicate = z.infer<typeof Predicate>;

const Reward = z.strictObject({
  /**
   * Must be 0: quest/achievement XP is not part of the approved XP policy (DEC-002, DEC-005).
   * validatePack rejects other values unless rewardXpAllowed is enabled.
   */
  xp: z.int().min(0).default(0),
  /** Cosmetic reward icon key (VISUAL_DIRECTION.md); not an inventory economy. */
  item: Id.optional(),
});

export const Quest = z.strictObject({
  id: Id,
  title: Text,
  description: Text,
  status: PublicationStatus,
  /** When the quest becomes active. Omitted = active from the start. */
  activation: Predicate.optional(),
  objectives: z
    .array(
      z.strictObject({
        id: Id,
        title: Text,
        predicate: Predicate,
        /** Optional objectives are shown and tracked but not needed to complete the quest. */
        optional: z.boolean().default(false),
      }),
    )
    .min(1),
  reward: Reward.default({ xp: 0 }),
});

export const Achievement = z.strictObject({
  id: Id,
  title: Text,
  description: Text,
  status: PublicationStatus,
  predicate: Predicate,
  reward: Reward.default({ xp: 0 }),
});

export const Zone = z.strictObject({
  id: Id,
  /** Curriculum title. */
  title: Text,
  order: z.int().positive(),
  /** World-layer theme key; art can change without touching curriculum IDs. */
  themeKey: Id,
  artTitle: Text.optional(),
});

export const PathFile = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  subject: z.strictObject({ id: Id, title: Text, description: Text }),
  path: z.strictObject({
    id: Id,
    title: Text,
    description: Text,
    version: z.int().positive(),
    status: PublicationStatus,
    audience: Text,
    learningGoal: Text,
    language: CodeLanguage.optional(),
    /** Minimum language version learners need, e.g. "3.10". */
    minLanguageVersion: z
      .string()
      .regex(/^\d+\.\d+$/)
      .optional(),
  }),
  zones: z.array(Zone).min(1),
  quests: z.array(Quest).default([]),
  achievements: z.array(Achievement).default([]),
});
export type PathFile = z.infer<typeof PathFile>;

export interface ContentPack {
  /** Directory the pack was loaded from (for messages). */
  dir: string;
  meta: PathFile;
  sources: Source[];
  levels: Level[];
  /** Map level id → file it came from (for messages). */
  levelFiles: Record<string, string>;
}
