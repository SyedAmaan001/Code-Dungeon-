export default function Loading() {
  return (
    <div className="stack-l" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="skeleton" style={{ height: 220 }} />
      <div className="skeleton" style={{ height: 84 }} />
      <div className="split">
        <div className="skeleton" style={{ height: 240 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    </div>
  );
}
