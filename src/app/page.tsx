import { getPathOverviews } from "@/services/content-overview";

export default function Home() {
  const paths = getPathOverviews();

  return (
    <main>
      <h1>Code Dungeon</h1>
      <p className="muted">
        A learning platform experienced as an illustrated fantasy game world. Python Fundamentals is
        the first path.
      </p>

      <section className="panel" aria-labelledby="status-heading">
        <h2 id="status-heading">Under construction</h2>
        <p>
          Code Dungeon is in early development. The learning engine and the first lesson content
          exist, but there is no way to play them here yet: no game interface, accounts, saved
          progress or leaderboards.
        </p>
        <h3>Learning paths in the repository</h3>
        {paths.length === 0 ? (
          <p className="muted">No content packs found.</p>
        ) : (
          <ul>
            {paths.map((p) => (
              <li key={p.id}>
                <strong>{p.title}</strong>: {p.published} of {p.levels} levels written and
                automatically checked, across {p.zones} zones
                {p.valid ? "" : " (content has validation errors)"}.
                {p.awaitingHumanReview > 0 &&
                  ` ${p.awaitingHumanReview} level(s) are awaiting human review.`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
