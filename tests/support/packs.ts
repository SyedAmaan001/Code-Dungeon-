import { fileURLToPath } from "node:url";
import { loadPack } from "@/learning/loader";
import type { ContentPack } from "@/learning/schema";

export const FIXTURES = fileURLToPath(new URL("../fixtures/packs", import.meta.url));
export const VALID_SMALL = `${FIXTURES}/valid-small`;
export const CONTENT_ROOT = fileURLToPath(new URL("../../content", import.meta.url));

/** Load a pack that is expected to parse; throws with the issues otherwise. */
export function loadOrThrow(dir: string): ContentPack {
  const { pack, issues } = loadPack(dir);
  if (!pack) throw new Error(`failed to load ${dir}: ${JSON.stringify(issues, null, 2)}`);
  return pack;
}

/** Fresh deep copy so a test can mutate a pack without affecting others. */
export function clonePack(pack: ContentPack): ContentPack {
  return structuredClone(pack);
}
