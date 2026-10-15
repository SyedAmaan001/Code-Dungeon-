"use client";
import Link from "next/link";
import { Icon } from "@/ui/art/icons";

/** Shown when the game cannot load (e.g. the database is unreachable). Details stay in server logs. */
export default function PlayError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="frame empty" role="alert" style={{ maxWidth: "36rem", margin: "2rem auto" }}>
      <Icon name="alert" size={36} />
      <h1 style={{ fontSize: "var(--text-2xl)" }}>The passage is blocked</h1>
      <p>
        Something went wrong while loading your game. Your saved progress is safe. Try again in a
        moment.
      </p>
      <div className="row" style={{ justifyContent: "center" }}>
        <button type="button" className="btn btn--primary" onClick={reset}>
          Try again
        </button>
        <Link className="btn" href="/">
          Leave
        </Link>
      </div>
    </div>
  );
}
