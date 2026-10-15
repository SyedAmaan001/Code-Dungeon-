import "server-only";
import { join } from "node:path";
import { findPackDirs, loadPack } from "@/learning/loader";
import { validatePack } from "@/learning/validate";

export interface PathOverview {
  id: string;
  title: string;
  zones: number;
  levels: number;
  published: number;
  /** Published levels whose review metadata says only an AI agent reviewed them. */
  awaitingHumanReview: number;
  valid: boolean;
}

/** Real counts from the content packs on disk, for the honest status page. */
export function getPathOverviews(root = join(process.cwd(), "content")): PathOverview[] {
  return findPackDirs(root).flatMap((dir) => {
    const { pack, issues } = loadPack(dir);
    if (!pack) return [];
    const errors = [...issues, ...validatePack(pack)].filter((i) => i.severity === "error");
    return [
      {
        id: pack.meta.path.id,
        title: pack.meta.path.title,
        zones: pack.meta.zones.length,
        levels: pack.levels.length,
        published: pack.levels.filter((l) => l.status === "published").length,
        awaitingHumanReview: pack.levels.filter(
          (l) => l.status === "published" && l.review?.kind === "agent",
        ).length,
        valid: errors.length === 0,
      },
    ];
  });
}
