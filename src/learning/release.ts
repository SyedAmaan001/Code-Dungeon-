/**
 * Content release policy (DEC-011).
 *
 * AI review and human review are distinct statuses. In `development` every published
 * level is playable (local development and testing). In `public` only levels a person
 * has reviewed are published; the rest are withheld, and anything that depends on a
 * withheld level stays locked by the normal prerequisite rules.
 */
import type { ContentPack, Level } from "./schema";

export const CONTENT_RELEASES = ["development", "public"] as const;
export type ContentRelease = (typeof CONTENT_RELEASES)[number];

/** How a level was reviewed. `ai_reviewed` is never presented as approval. */
export type ReviewStatus = "human_reviewed" | "ai_reviewed" | "unreviewed";

export function reviewStatus(level: Pick<Level, "review">): ReviewStatus {
  if (!level.review) return "unreviewed";
  return level.review.kind === "human" ? "human_reviewed" : "ai_reviewed";
}

export function parseContentRelease(raw: string | undefined): ContentRelease {
  const value = (raw ?? "").trim() || "development";
  if (!(CONTENT_RELEASES as readonly string[]).includes(value))
    throw new Error(`CONTENT_RELEASE must be one of ${CONTENT_RELEASES.join(", ")}`);
  return value as ContentRelease;
}

export interface WithheldLevel {
  levelId: string;
  number: number;
  review: ReviewStatus;
}

/** Published levels that may not be released publicly (not human-reviewed). */
export function levelsNeedingHumanReview(pack: ContentPack): WithheldLevel[] {
  return pack.levels
    .filter((l) => l.status === "published" && reviewStatus(l) !== "human_reviewed")
    .map((l) => ({ levelId: l.id, number: l.number, review: reviewStatus(l) }))
    .sort((a, b) => a.number - b.number);
}

/**
 * The pack as it may be served for a release. Never mutates the input. Withheld levels
 * keep their content on disk but are marked `review`, so no service treats them as playable.
 */
export function applyReleasePolicy(
  pack: ContentPack,
  release: ContentRelease,
): { pack: ContentPack; withheld: WithheldLevel[] } {
  if (release === "development") return { pack, withheld: [] };
  const withheld = levelsNeedingHumanReview(pack);
  const ids = new Set(withheld.map((w) => w.levelId));
  return {
    pack: {
      ...pack,
      levels: pack.levels.map((l) => (ids.has(l.id) ? { ...l, status: "review" as const } : l)),
    },
    withheld,
  };
}
