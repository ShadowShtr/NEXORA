// Next.js route-level Suspense fallback, shown automatically while LembretesPage's data
// load is in flight — "Loading: Usar skeleton cards", sized to match the summary grid
// and .reminder-card so nothing jumps when the real content replaces it.
export default function LembretesLoading() {
  return (
    <div className="shell reminders-page">
      <div className="finance-skeleton-header" />
      <div className="reminders-summary">
        <div className="finance-skeleton-block" style={{ height: 88, borderRadius: 17 }} />
        <div className="finance-skeleton-block" style={{ height: 88, borderRadius: 17 }} />
        <div className="finance-skeleton-block" style={{ height: 88, borderRadius: 17 }} />
      </div>
      <div
        className="finance-skeleton-block"
        style={{ height: 40, width: '70%', marginTop: 16, borderRadius: 999 }}
      />
      <div className="reminder-skeleton" style={{ marginTop: 22 }} />
      <div className="reminder-skeleton" />
      <div className="reminder-skeleton" />
    </div>
  );
}
