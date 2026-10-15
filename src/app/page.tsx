import Link from "next/link";
import { getPathOverviews } from "@/services/content-overview";
import { Icon } from "@/ui/art/icons";
import { ZoneScene } from "@/ui/art/zone-scene";
import { PublicHeader } from "@/ui/public-header";

/** Public doorway into the game. Static: it shows real content counts, nothing per player. */
export default function Landing() {
  const paths = getPathOverviews();
  const python = paths.find((p) => p.id === "python-fundamentals");

  return (
    <>
      <PublicHeader>
        <Link className="btn" href="/sign-in">
          Sign in
        </Link>
      </PublicHeader>
      <main id="main" className="page stack-l">
        <section
          className="hero hero--tall"
          aria-labelledby="landing-title"
          data-zone="overgrown-gate"
        >
          <ZoneScene theme="overgrown-gate" />
          <div className="hero__body">
            <p className="eyebrow">A learning game · Python Fundamentals</p>
            <h1 id="landing-title">Learn to code by exploring the dungeon</h1>
            <p className="muted" style={{ fontSize: "var(--text-l)" }}>
              Five zones, real lessons and challenges checked on the server. Clear checkpoints,
              survive encounters, complete quests and keep every bit of progress.
            </p>
            <div className="row">
              <Link className="btn btn--primary btn--lg" href="/play">
                Begin your expedition <Icon name="arrow-right" size={20} />
              </Link>
            </div>
          </div>
        </section>

        <section className="ledger" aria-label="What is in the game today">
          <div className="ledger__item">
            <div className="ledger__value">{python?.published ?? 0}</div>
            <div className="ledger__label">playable levels in {python?.zones ?? 0} zones</div>
          </div>
          <div className="ledger__item">
            <div className="ledger__value">{python?.challengeFormats ?? 0}</div>
            <div className="ledger__label">challenge formats, judged on the server</div>
          </div>
          <div className="ledger__item">
            <div className="ledger__value">
              {python?.quests ?? 0} · {python?.achievements ?? 0}
            </div>
            <div className="ledger__label">quests · achievements</div>
          </div>
        </section>

        {python && python.awaitingHumanReview > 0 && (
          <p className="notice-box">
            <Icon name="info" size={18} />
            <span>
              In development. {python.awaitingHumanReview} of {python.published} levels were checked
              by an AI agent and automated tests (every example was run with real Python); human
              review is still pending.
            </span>
          </p>
        )}
      </main>
    </>
  );
}
