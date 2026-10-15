/**
 * Reward item illustrations: original 64×64 drawings in the outlined, warm-highlight style
 * described in VISUAL_DIRECTION.md (not traced from the reference sheet). Cosmetic only.
 */
const INK = "#1b130d";
const line = {
  stroke: INK,
  strokeWidth: 2.4,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

const DRAWINGS: Record<string, React.ReactNode> = {
  "gate-key": (
    <>
      <circle cx="20" cy="22" r="10" fill="#6f7b86" {...line} />
      <circle cx="20" cy="22" r="4.5" fill="#2a2f35" {...line} />
      <path d="M27 29 47 49" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M27 29 47 49" stroke="#7d8a95" strokeWidth={3.6} strokeLinecap="round" />
      <path d="m41 43 5-5 3 3-5 5M46 48l4-4 3 3-4 4" fill="#6f7b86" {...line} />
      <path d="M15 17.5c1.5-1.8 3.4-2.6 5.6-2.4" stroke="#c9d2d9" strokeWidth={1.6} fill="none" />
    </>
  ),
  "ember-lantern": (
    <>
      <path d="M26 10h12M32 6v4" {...line} fill="none" />
      <path d="M22 16h20l-2 5H24z" fill="#b08a3e" {...line} />
      <path d="M24 21h16l2 24H22z" fill="#3a2a1c" {...line} />
      <path d="M32 26c5 6 5 11 0 15-5-4-5-9 0-15Z" fill="#f08a46" {...line} />
      <path d="M32 31c2.4 3 2.4 5.6 0 7.6-2.4-2-2.4-4.6 0-7.6Z" fill="#ffd27a" />
      <path d="M20 45h24l-2 6H22z" fill="#b08a3e" {...line} />
      <path d="M25 18h7" stroke="#f1d59a" strokeWidth={1.6} />
    </>
  ),
  "forge-hammer": (
    <>
      <path d="M29 30 15 54" stroke={INK} strokeWidth={7.5} strokeLinecap="round" />
      <path d="M29 30 15 54" stroke="#8a5a32" strokeWidth={4} strokeLinecap="round" />
      <path d="M20 16 40 8l8 14-20 8z" fill="#5f6870" {...line} />
      <path d="M40 8l8 14 6-2-7-14z" fill="#454c53" {...line} />
      <path d="M23 17.5 38 11.5" stroke="#b9c2c9" strokeWidth={1.6} />
    </>
  ),
  "archive-tome": (
    <>
      <path d="M14 12h32a4 4 0 0 1 4 4v34H18a4 4 0 0 1-4-4z" fill="#7a4a2a" {...line} />
      <path d="M14 46a4 4 0 0 1 4-4h32" fill="none" {...line} />
      <path d="M18 46h31" stroke="#e8dcc0" strokeWidth={3} />
      <path d="M26 12v30M38 12v30" stroke={INK} strokeWidth={2.4} />
      <path d="M24 12h4v30h-4zM36 12h4v30h-4z" fill="#3c2616" />
      <circle cx="32" cy="27" r="5" fill="#c9a24e" {...line} />
      <path d="M18 15h24" stroke="#b07a4c" strokeWidth={1.6} />
    </>
  ),
  "world-tree-seed": (
    <>
      <circle cx="32" cy="36" r="17" fill="#d7b46a" opacity={0.22} />
      <path
        d="M32 18c9 4 13 12 11 20-2 7-7 11-11 11s-9-4-11-11c-2-8 2-16 11-20Z"
        fill="#c98f3a"
        {...line}
      />
      <path d="M32 22c4 6 4 18 0 25" stroke="#8a5a20" strokeWidth={2} fill="none" />
      <path d="M32 18c2-6 7-9 13-9-1 6-6 10-13 9Z" fill="#7e9c5e" {...line} />
      <path d="M26 27c1.5-2.5 3.5-4 6-5" stroke="#f3d9a0" strokeWidth={1.8} fill="none" />
    </>
  ),
  "magnifying-lens": (
    <>
      <path d="M39 39 52 52" stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <path d="M39 39 52 52" stroke="#6b4426" strokeWidth={4.4} strokeLinecap="round" />
      <circle cx="28" cy="28" r="15" fill="#b08a3e" {...line} />
      <circle cx="28" cy="28" r="10.5" fill="#3e9f9a" {...line} />
      <path d="M21.5 24.5a8 8 0 0 1 6-5.5" stroke="#bff3ee" strokeWidth={2} fill="none" />
    </>
  ),
  "copper-ring": (
    <>
      <ellipse cx="32" cy="38" rx="17" ry="12" fill="none" stroke={INK} strokeWidth={9} />
      <ellipse cx="32" cy="38" rx="17" ry="12" fill="none" stroke="#b86f3d" strokeWidth={5} />
      <path d="M19 33c4-4 10-5 15-5" stroke="#f0b98a" strokeWidth={1.8} fill="none" />
      <path d="M27 22h10l3 5-8 6-8-6z" fill="#44c9c2" {...line} />
      <path d="M29 24h4" stroke="#d9fffb" strokeWidth={1.6} />
    </>
  ),
  "explorer-goggles": (
    <>
      <path
        d="M6 34c4-10 48-10 52 0"
        fill="none"
        stroke="#4a3322"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx="21" cy="36" r="10.5" fill="#b08a3e" {...line} />
      <circle cx="43" cy="36" r="10.5" fill="#b08a3e" {...line} />
      <circle cx="21" cy="36" r="6.5" fill="#2f8f8a" {...line} />
      <circle cx="43" cy="36" r="6.5" fill="#2f8f8a" {...line} />
      <path d="M30 35h4" {...line} />
      <path
        d="M17.5 33a4 4 0 0 1 3-2.5M39.5 33a4 4 0 0 1 3-2.5"
        stroke="#c6fbf6"
        strokeWidth={1.8}
      />
    </>
  ),
  "golden-key": (
    <>
      <path
        d="M18 14c6-6 12 0 6 6 6-6 12 0 6 6-6 6-12 0-6-6-6 6-12 0-6-6Z"
        fill="#e2bb55"
        {...line}
      />
      <circle cx="24" cy="20" r="2.6" fill="#7a5a1a" />
      <path d="M28 25 48 45" stroke={INK} strokeWidth={6.5} strokeLinecap="round" />
      <path d="M28 25 48 45" stroke="#e2bb55" strokeWidth={3.2} strokeLinecap="round" />
      <path d="m42 39 5-4 3 3-4 5M47 44l4-3 2.5 2.5-3.5 4" fill="#e2bb55" {...line} />
      <path d="M17 15c1.5-1.6 3-2.4 4.8-2.4" stroke="#fff1bf" strokeWidth={1.6} fill="none" />
    </>
  ),
  "scholar-book": (
    <>
      <path d="M12 14h18a4 4 0 0 1 4 4v32a4 4 0 0 0-4-4H12z" fill="#2f4a6b" {...line} />
      <path d="M52 14H34a4 4 0 0 0-4 4v32a4 4 0 0 1 4-4h18z" fill="#2a4361" {...line} />
      <path d="M16 20h10M16 25h10M38 20h10M38 25h8" stroke="#a9c3e0" strokeWidth={1.6} />
      <path d="M44 14v14l3-3 3 3V14" fill="#c74a3a" {...line} />
    </>
  ),
};

const FALLBACK = (
  <>
    <circle cx="32" cy="32" r="16" fill="#8a7650" {...line} />
    <path
      d="m32 22 3 7 7 .6-5.4 4.6 1.8 7-6.4-3.8-6.4 3.8 1.8-7L22 29.6l7-.6z"
      fill="#e8d39a"
      {...line}
    />
  </>
);

export function ItemArt({
  item,
  size = 56,
  muted = false,
}: {
  item: string;
  size?: number;
  /** Not yet earned: drawn as a dim silhouette. */
  muted?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={muted ? "item-art item-art--muted" : "item-art"}
    >
      {DRAWINGS[item] ?? FALLBACK}
    </svg>
  );
}

/** Achievement medallion: gold when earned, carved stone when not. */
export function Medallion({ earned, size = 56 }: { earned: boolean; size?: number }) {
  const face = earned ? "#d7b46a" : "#3a3540";
  const rim = earned ? "#a5843f" : "#2a262e";
  const mark = earned ? "#4a3712" : "#57505d";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="25" fill={rim} {...line} />
      <circle cx="32" cy="32" r="19" fill={face} {...line} />
      <path
        d="m32 19 3.8 8 8.7.9-6.5 5.9 1.8 8.6L32 38l-7.8 4.4 1.8-8.6-6.5-5.9 8.7-.9z"
        fill={mark}
      />
      {earned && <path d="M19 26a14 14 0 0 1 10-9" stroke="#f6e3b0" strokeWidth={2} fill="none" />}
    </svg>
  );
}
