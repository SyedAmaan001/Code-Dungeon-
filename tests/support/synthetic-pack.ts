/**
 * Synthetic 100-level learning path, generated for tests only.
 *
 * Proves the content model scales past the 25-level launch path: 20 zones × 5 levels,
 * levels 1–25 published (mirroring the launch target), 26–100 draft, a non-linear
 * prerequisite graph (each zone's final level requires all four earlier levels in
 * that zone), and one quest per zone. Content is placeholder text, clearly synthetic.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";

export const SYNTHETIC_LEVELS = 100;
export const SYNTHETIC_PUBLISHED = 25;
const PER_ZONE = 5;

const pad = (n: number) => String(n).padStart(3, "0");
const levelId = (n: number) => `syn.L${pad(n)}`;
const zoneId = (z: number) => `syn.zone.${z}`;

export function syntheticLevel(n: number): Record<string, unknown> {
  const zone = Math.ceil(n / PER_ZONE);
  const posInZone = ((n - 1) % PER_ZONE) + 1;
  const zoneStart = (zone - 1) * PER_ZONE + 1;
  const prerequisites =
    n === 1
      ? []
      : posInZone === PER_ZONE
        ? Array.from({ length: PER_ZONE - 1 }, (_, i) => levelId(zoneStart + i))
        : [levelId(n - 1)];
  const published = n <= SYNTHETIC_PUBLISHED;

  return {
    id: levelId(n),
    version: 1,
    number: n,
    zone: zoneId(zone),
    title: `Synthetic Level ${n}`,
    description: "Synthetic level for scale tests.",
    status: published ? "published" : "draft",
    kind: n === SYNTHETIC_LEVELS ? "boss" : posInZone === PER_ZONE ? "checkpoint" : "standard",
    prerequisites,
    ...(published && {
      estimatedMinutes: 5,
      lesson: {
        objectives: [`Synthetic objective ${n}.`],
        explanation: "Synthetic explanation.",
        examples: [{ code: `print(${n})`, expectedOutput: String(n) }],
        practicalContext: "Synthetic context.",
      },
      challenges: [
        {
          id: `${levelId(n)}.c1`,
          version: 1,
          type: "predict_output",
          difficulty: 1,
          prompt: "What does this print?",
          code: `print(${n} * 2)`,
          answer: { output: String(n * 2) },
          feedback: { correct: "Correct.", incorrect: "Not quite." },
          hints: ["Nudge.", "Clue.", "Strong hint."],
          explanation: "Synthetic explanation.",
        },
        {
          id: `${levelId(n)}.c2`,
          version: 1,
          type: "multiple_choice",
          role: "check",
          difficulty: 1,
          prompt: "Synthetic knowledge check.",
          options: [
            { id: "a", text: "Right" },
            { id: "b", text: "Wrong" },
          ],
          answer: { correct: ["a"] },
          feedback: { correct: "Correct.", incorrect: "Not quite." },
          hints: ["Nudge.", "Clue.", "Strong hint."],
          explanation: "Synthetic explanation.",
        },
      ],
      sources: [{ source: "syn.source" }],
      review: { reviewer: "synthetic", date: "2026-10-15", pythonVersion: "3.13", kind: "human" },
    }),
  };
}

export function syntheticPathFile(): Record<string, unknown> {
  const zones = SYNTHETIC_LEVELS / PER_ZONE;
  return {
    schemaVersion: 2,
    subject: { id: "syn-subject", title: "Synthetic", description: "Synthetic subject for tests." },
    path: {
      id: "syn-path",
      title: "Synthetic 100-Level Path",
      description: "Generated test data; not curriculum.",
      version: 1,
      status: "draft",
      audience: "Automated tests.",
      learningGoal: "Prove the model scales to 100 levels.",
      language: "python",
      minLanguageVersion: "3.10",
    },
    zones: Array.from({ length: zones }, (_, i) => ({
      id: zoneId(i + 1),
      title: `Synthetic Zone ${i + 1}`,
      order: i + 1,
      themeKey: `theme-${(i % 5) + 1}`,
    })),
    quests: Array.from({ length: zones }, (_, i) => ({
      id: `syn.quest.${i + 1}`,
      title: `Clear zone ${i + 1}`,
      description: "Synthetic quest.",
      status: i * PER_ZONE < SYNTHETIC_PUBLISHED ? "published" : "draft",
      objectives: [
        {
          id: "o1",
          title: "Clear the zone",
          predicate: { kind: "complete_zone", zone: zoneId(i + 1) },
        },
      ],
      reward: { xp: 50 },
    })),
    achievements: [
      {
        id: "syn.ach.centurion",
        title: "Centurion",
        description: "Complete 100 levels.",
        status: "draft",
        predicate: { kind: "complete_level_count", count: 100 },
      },
    ],
  };
}

/** Writes the synthetic pack as YAML files to a fresh temp directory and returns its path. */
export function writeSyntheticPack(): string {
  const dir = mkdtempSync(join(tmpdir(), "code-dungeon-synthetic-"));
  mkdirSync(join(dir, "levels"));
  writeFileSync(join(dir, "path.yaml"), stringify(syntheticPathFile()));
  writeFileSync(
    join(dir, "sources.yaml"),
    stringify({
      sources: [
        {
          id: "syn.source",
          title: "Synthetic Source",
          edition: "n/a",
          licence: "n/a (test data)",
          reviewed: "2026-10-15",
        },
      ],
    }),
  );
  for (let n = 1; n <= SYNTHETIC_LEVELS; n++) {
    writeFileSync(join(dir, "levels", `L${pad(n)}.yaml`), stringify(syntheticLevel(n)));
  }
  return dir;
}
