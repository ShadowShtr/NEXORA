// Shown while the agenda's Server Component data (appointments, free slots) is
// fetching — skeletons sized like the real timeline rows/cards so the layout doesn't
// jump once the real content arrives.
export default function Loading() {
  return (
    <div className="shell agenda-page">
      <div className="skeleton agenda-skeleton-title" aria-hidden="true" />
      <div className="skeleton agenda-skeleton-line" aria-hidden="true" />
      <div className="skeleton agenda-skeleton-tabs" aria-hidden="true" />
      <div className="skeleton agenda-skeleton-banner" aria-hidden="true" />
      <ul className="agenda-skeleton-list" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <li key={index} className="skeleton agenda-skeleton-card" />
        ))}
      </ul>
      <p className="sr-only" role="status">
        A carregar agenda…
      </p>
    </div>
  );
}
