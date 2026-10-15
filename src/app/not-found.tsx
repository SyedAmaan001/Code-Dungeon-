import Link from "next/link";
import { Icon } from "@/ui/art/icons";

export default function NotFound() {
  return (
    <main id="main" className="page">
      <div className="frame empty" style={{ maxWidth: "36rem", margin: "3rem auto" }}>
        <Icon name="map" size={36} />
        <h1 style={{ fontSize: "var(--text-2xl)" }}>No such room</h1>
        <p>This passage does not lead anywhere.</p>
        <Link className="btn btn--primary" href="/play/map">
          Back to the map
        </Link>
      </div>
    </main>
  );
}
