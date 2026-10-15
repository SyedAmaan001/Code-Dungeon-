import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "./art/zone-scene";

export function PublicHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Link href="/" className="brand">
          <BrandMark size={30} />
          <span>Code Dungeon</span>
        </Link>
        <div className="topbar__end">{children}</div>
      </div>
    </header>
  );
}
