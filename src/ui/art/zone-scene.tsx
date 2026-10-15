/**
 * Zone backdrops: original layered-silhouette SVG scenes for the five launch biomes
 * (VISUAL_DIRECTION.md "The first five visual zones"). Decorative: the zone name is always
 * shown as text beside them. Lightweight (no raster images) and static under reduced motion.
 */
import { useId } from "react";
import type { ZoneTheme } from "@/world/catalog";

type Ids = (name: string) => string;

function OvergrownGate({ id }: { id: Ids }) {
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b4b44" />
          <stop offset="0.6" stopColor="#1d2723" />
          <stop offset="1" stopColor="#111614" />
        </linearGradient>
        <radialGradient id={id("lamp")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f3c86e" stopOpacity="0.85" />
          <stop offset="1" stopColor="#f3c86e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="320" fill={`url(#${id("sky")})`} />
      <path
        d="M0 210c80-40 150-60 230-45s140 40 230 20 190-60 300-40 190 50 260 35 120-20 180-10v150H0z"
        fill="#24312c"
      />
      {/* bare trees */}
      <path
        d="M90 230V120M90 150l-30-35M90 135l35-40M90 175l-40-20M1080 235V105M1080 140l40-45M1080 160l-45-30M1080 120l-20-30"
        stroke="#18201d"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <ellipse
        cx="600"
        cy="150"
        rx="110"
        ry="80"
        fill={`url(#${id("lamp")})`}
        className="scene-flicker"
      />
      {/* broken gate */}
      <path d="M520 300V170q80-90 160 0v130h-26V178q-54-60-108 0v122z" fill="#161d1a" />
      <path d="M650 160l40-28 6 10-36 24z" fill="#161d1a" />
      <circle cx="600" cy="150" r="7" fill="#f6d488" />
      {/* leaning gravestones */}
      <path
        d="M250 300v-70q20-26 42 0v70zM330 300l8-52q22-20 38 6l-6 46zM820 300v-62q18-24 38 0v62zM905 300l-6-44q16-22 34-2l2 46z"
        fill="#1a221f"
      />
      <path d="M440 300v-34h10v-16h10v16h10v34z" fill="#1a221f" />
      <rect y="292" width="1200" height="28" fill="#101512" />
      <ellipse cx="300" cy="285" rx="320" ry="14" fill="#c8d6cf" opacity="0.07" />
      <ellipse cx="900" cy="275" rx="380" ry="16" fill="#c8d6cf" opacity="0.06" />
    </>
  );
}

function EmberHall({ id }: { id: Ids }) {
  const columns = [110, 290, 470, 730, 910, 1090];
  return (
    <>
      <defs>
        <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2232" />
          <stop offset="1" stopColor="#140f16" />
        </linearGradient>
        <radialGradient id={id("fire")} cx="0.5" cy="0.6" r="0.5">
          <stop offset="0" stopColor="#ffb25c" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#f08a46" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f08a46" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="320" fill={`url(#${id("wall")})`} />
      {/* masonry */}
      <path
        d="M0 70h1200M0 130h1200M0 190h1200M60 0v70M240 70v60M420 0v70M380 130v60M780 0v70M820 70v60M1000 130v60M1140 0v70"
        stroke="#3a2e40"
        strokeWidth="2"
      />
      <ellipse
        cx="600"
        cy="220"
        rx="260"
        ry="170"
        fill={`url(#${id("fire")})`}
        className="scene-flicker"
      />
      {columns.map((x) => (
        <g key={x} fill="#1b141e">
          <rect x={x - 26} y="40" width="52" height="250" />
          <rect x={x - 36} y="28" width="72" height="18" />
          <rect x={x - 36} y="282" width="72" height="14" />
          <rect x={x - 22} y="46" width="6" height="236" fill="#2a2030" />
        </g>
      ))}
      {/* fire basin */}
      <path d="M540 250h120l-20 26h-80z" fill="#1d1418" />
      <path d="M585 276h30v18h-30z" fill="#1d1418" />
      <path
        d="M560 252c10-30 22-34 18-60 20 18 22 30 22 44 4-20 14-30 12-52 22 24 26 44 22 68z"
        fill="#f08a46"
        className="scene-flicker"
      />
      <path d="M582 252c6-14 12-18 12-32 10 12 14 22 10 32z" fill="#ffd27a" />
      <rect y="292" width="1200" height="28" fill="#0f0b10" />
    </>
  );
}

function SigilSanctum({ id }: { id: Ids }) {
  const banners: [number, string][] = [
    [230, "#8a4b2f"],
    [340, "#7a2f35"],
    [860, "#2f4f7a"],
    [970, "#2f6b4f"],
  ];
  return (
    <>
      <defs>
        <linearGradient id={id("stone")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2a2d" />
          <stop offset="1" stopColor="#101618" />
        </linearGradient>
        <radialGradient id={id("glow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7ff0e6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#44c9c2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="320" fill={`url(#${id("stone")})`} />
      <path d="M0 60h1200M0 250h1200" stroke="#2b383b" strokeWidth="3" />
      <circle cx="600" cy="140" r="150" fill={`url(#${id("glow")})`} className="scene-pulse" />
      <g fill="none" stroke="#d7b46a" strokeWidth="3" opacity="0.9">
        <circle cx="600" cy="140" r="78" />
        <circle cx="600" cy="140" r="62" stroke="#7ff0e6" strokeWidth="2" />
        <path d="M600 62v156M522 140h156M545 85l110 110M655 85 545 195" opacity="0.6" />
        <rect x="566" y="106" width="68" height="68" transform="rotate(45 600 140)" />
      </g>
      {banners.map(([x, color]) => (
        <g key={x}>
          <path d={`M${x - 34} 70h68v140l-34 22-34-22z`} fill={color} opacity="0.75" />
          <path
            d={`M${x} 100l14 24-14 24-14-24z`}
            fill="none"
            stroke="#e9d9a8"
            strokeWidth="2"
            opacity="0.7"
          />
          <rect x={x - 40} y="62" width="80" height="8" fill="#141b1d" />
        </g>
      ))}
      {/* altar and steps */}
      <path d="M520 250h160v-22H520z" fill="#162022" />
      <path d="M440 270h320v-20H440zM380 292h440v-22H380z" fill="#131b1d" />
      <path d="M90 292V120h40v172zM1070 292V120h40v172z" fill="#141b1d" />
      <rect y="292" width="1200" height="28" fill="#0c1112" />
    </>
  );
}

function RootboundDeep({ id }: { id: Ids }) {
  return (
    <>
      <defs>
        <linearGradient id={id("cave")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2017" />
          <stop offset="1" stopColor="#0e0a07" />
        </linearGradient>
        <radialGradient id={id("opening")} cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stopColor="#f0c26e" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#c98f3a" stopOpacity="0.25" />
          <stop offset="1" stopColor="#c98f3a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="320" fill={`url(#${id("cave")})`} />
      <ellipse cx="600" cy="190" rx="200" ry="150" fill={`url(#${id("opening")})`} />
      {/* layered arches */}
      <path d="M0 0h1200v320H900V200q-300-260-600 0v120H0z" fill="#1a130d" />
      <path
        d="M0 0h1200v40q-120 10-160 120v160H1000V170q-400-220-800 0v150H160V160Q120 50 0 40z"
        fill="#22180f"
        opacity="0.9"
      />
      {/* hanging roots */}
      <path
        d="M330 0c10 60-20 90 0 150M370 0c-10 40 20 70 6 120M840 0c-14 50 16 80-4 140M880 0c10 30-12 60 4 100M600 0c-6 30 8 50-2 80"
        stroke="#3a2a1a"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      {/* records and lanterns */}
      <path
        d="M220 292v-60h26v60zM252 292v-48h20v48zM940 292v-70h24v70zM970 292v-52h22v52z"
        fill="#140e09"
      />
      <circle cx="430" cy="215" r="8" fill="#f3c86e" className="scene-flicker" />
      <circle cx="770" cy="205" r="8" fill="#f3c86e" className="scene-flicker" />
      <path d="M430 160v47M770 150v47" stroke="#2a1e13" strokeWidth="3" />
      <rect y="292" width="1200" height="28" fill="#0b0805" />
    </>
  );
}

function WorldTreeCitadel({ id }: { id: Ids }) {
  return (
    <>
      <defs>
        <linearGradient id={id("dusk")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a2b2c" />
          <stop offset="0.45" stopColor="#b7743a" />
          <stop offset="0.8" stopColor="#e3ad5a" />
          <stop offset="1" stopColor="#3a2418" />
        </linearGradient>
      </defs>
      <rect width="1200" height="320" fill={`url(#${id("dusk")})`} />
      <circle cx="600" cy="170" r="110" fill="#f5d38a" opacity="0.55" />
      {/* colonnade */}
      {[60, 170, 280, 920, 1030, 1140].map((x, i) => (
        <g key={x} fill="#2a1a12">
          <rect x={x - 22} y={i % 3 === 2 ? 130 : 70} width="44" height="230" />
          <rect x={x - 30} y={i % 3 === 2 ? 120 : 60} width="60" height="14" />
        </g>
      ))}
      <path d="M30 60h280v-18H30zM890 60h280v-18H890z" fill="#2a1a12" />
      {/* the tree */}
      <path
        d="M560 300c20-40 10-90 24-130 8-24-10-40-30-62M640 300c-16-44-6-96-22-134-10-24 12-44 36-60M600 170c-4-50 10-80 0-120M600 120c30-30 60-30 90-56M600 140c-34-24-70-24-104-50M620 90c20-10 40-30 46-56M580 80c-16-14-22-34-40-46"
        stroke="#24160e"
        strokeWidth="18"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M520 300c30-14 130-14 160 0z" fill="#24160e" />
      <path d="M450 300h300v-14H450z" fill="#1f130c" />
      <circle cx="600" cy="150" r="5" fill="#7ff0e6" className="scene-pulse" />
      <rect y="300" width="1200" height="20" fill="#1a100a" />
    </>
  );
}

const SCENES: Record<ZoneTheme, (p: { id: Ids }) => React.ReactNode> = {
  "overgrown-gate": OvergrownGate,
  "ember-hall": EmberHall,
  "sigil-sanctum": SigilSanctum,
  "rootbound-deep": RootboundDeep,
  "world-tree-citadel": WorldTreeCitadel,
};

export function ZoneScene({ theme, className }: { theme: ZoneTheme; className?: string }) {
  const base = useId().replace(/:/g, "");
  const Scene = SCENES[theme];
  return (
    <svg
      className={className ? `zone-scene ${className}` : "zone-scene"}
      viewBox="0 0 1200 320"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <Scene id={(name) => `${base}-${name}`} />
    </svg>
  );
}

/** Small emblem for a zone (map legend, headers). */
export function ZoneEmblem({ theme, size = 28 }: { theme: ZoneTheme; size?: number }) {
  const shapes: Record<ZoneTheme, React.ReactNode> = {
    "overgrown-gate": <path d="M6 22V12q6-8 12 0v10M9 22v-8q3-4 6 0v8" />,
    "ember-hall": (
      <path d="M8 21h8M9 21l1-4h4l1 4M12 17c-3-2-3-5 0-9 1 2 3 3 2 6 1-1 2-2 2-4 2 3 1 6-4 7" />
    ),
    "sigil-sanctum": (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    "rootbound-deep": <path d="M4 20V11q8-10 16 0v9M9 4c0 4-2 6 0 9M15 4c1 3-1 5 1 8" />,
    "world-tree-citadel": (
      <path d="M12 21v-8M12 13c-4 0-6-3-6-6 3 0 5 1 6 4 1-3 3-4 6-4 0 3-2 6-6 6M8 21h8" />
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[theme]}
    </svg>
  );
}

/** Brand mark: a keyhole within a carved sigil ring. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="14" fill="#1d1b22" stroke="#d7b46a" strokeWidth="1.6" />
      <circle
        cx="16"
        cy="16"
        r="10"
        fill="none"
        stroke="#a5843f"
        strokeWidth="1"
        strokeDasharray="2 2.6"
      />
      <circle cx="16" cy="13.5" r="3.2" fill="#d7b46a" />
      <path d="M14.4 15.5h3.2l1.2 7h-5.6z" fill="#d7b46a" />
    </svg>
  );
}
