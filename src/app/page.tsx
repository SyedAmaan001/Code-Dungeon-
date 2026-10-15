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
          Code Dungeon is in early development. There are no accounts, playable levels, scores or
          leaderboards yet, and nothing you do here is saved.
        </p>
        <h3>Learning paths in the repository</h3>
        {paths.length === 0 ? (
          <p className="muted">No content packs found.</p>
        ) : (
          <ul>
            {paths.map((p) => (
              <li key={p.id}>
                <strong>{p.title}</strong>: {p.levels} levels outlined across {p.zones} zones,{" "}
                {p.published} published{p.valid ? "" : " (content has validation errors)"}.
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
