"use client";
import { Icon } from "@/ui/art/icons";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="page">
      <div className="frame empty" role="alert" style={{ maxWidth: "36rem", margin: "3rem auto" }}>
        <Icon name="alert" size={36} />
        <h1 style={{ fontSize: "var(--text-2xl)" }}>Something went wrong</h1>
        <p>The page could not be loaded. Try again in a moment.</p>
        <button type="button" className="btn btn--primary" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
