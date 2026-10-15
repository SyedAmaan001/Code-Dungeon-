export default function LevelLoading() {
  return (
    <div role="status" aria-live="polite" className="stack">
      <span className="sr-only">Opening the room…</span>
      <div className="skeleton" style={{ height: 210 }} />
      <div className="skeleton" style={{ height: 72 }} />
      <div className="room-layout">
        <div className="skeleton" style={{ height: 520 }} />
        <div className="skeleton" style={{ height: 520 }} />
      </div>
    </div>
  );
}
