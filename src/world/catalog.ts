/**
 * World layer: presentation data keyed by content ids (VISUAL_DIRECTION.md).
 * Plain data — no game rules. Curriculum ids stay stable if names or art change.
 */

export interface ItemInfo {
  name: string;
  /** One line of flavour: what the object is, never a gameplay effect (items are cosmetic). */
  description: string;
}

export const ITEMS: Record<string, ItemInfo> = {
  "gate-key": { name: "Gate Key", description: "Heavy iron key to the camp gate you repaired." },
  "ember-lantern": {
    name: "Ember Lantern",
    description: "Carries a flame from the Ember Hall's basin.",
  },
  "forge-hammer": { name: "Forge Hammer", description: "Worn smooth by many repeated strikes." },
  "archive-tome": {
    name: "Archive Tome",
    description: "Bound records from the Rootbound Deep.",
  },
  "world-tree-seed": {
    name: "World-Tree Seed",
    description: "Warm to the touch. Proof you reached the Citadel's summit.",
  },
  "magnifying-lens": { name: "Magnifying Lens", description: "For reading the smallest details." },
  "copper-ring": { name: "Copper Ring", description: "A plain ring, polished by use." },
  "explorer-goggles": {
    name: "Explorer Goggles",
    description: "Brass goggles for long expeditions.",
  },
  "golden-key": { name: "Golden Key", description: "Opens nothing in particular. Shines anyway." },
  "scholar-book": { name: "Scholar's Book", description: "Filled with careful notes." },
};

export function itemInfo(id: string): ItemInfo {
  return (
    ITEMS[id] ?? {
      name: id
        .split(/[-_.]/)
        .filter(Boolean)
        .map((w) => w[0]!.toUpperCase() + w.slice(1))
        .join(" "),
      description: "A keepsake from your journey.",
    }
  );
}

/** Visual identity per zone theme key (art titles live in content; colours live here). */
export const ZONE_THEMES = [
  "overgrown-gate",
  "ember-hall",
  "sigil-sanctum",
  "rootbound-deep",
  "world-tree-citadel",
] as const;
export type ZoneTheme = (typeof ZONE_THEMES)[number];

export function zoneTheme(themeKey: string): ZoneTheme {
  return (ZONE_THEMES as readonly string[]).includes(themeKey)
    ? (themeKey as ZoneTheme)
    : "overgrown-gate";
}
