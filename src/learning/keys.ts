/**
 * Server-only access to answer keys, feedback, hints and explanations.
 * Importing this from a Client Component fails the Next.js build (`server-only`),
 * and ESLint forbids importing it from src/ui and src/app.
 */
import "server-only";
import type { Challenge, Level } from "./schema";

export interface ChallengeKey {
  challengeId: string;
  version: number;
  type: Challenge["type"];
  answer: Challenge["answer"];
  feedback: Challenge["feedback"];
  hints: string[];
  explanation?: string;
}

export function challengeKeys(level: Level): Map<string, ChallengeKey> {
  return new Map(
    level.challenges.map((c) => [
      c.id,
      {
        challengeId: c.id,
        version: c.version,
        type: c.type,
        answer: c.answer,
        feedback: c.feedback,
        hints: [...c.hints],
        ...(c.explanation !== undefined && { explanation: c.explanation }),
      },
    ]),
  );
}
