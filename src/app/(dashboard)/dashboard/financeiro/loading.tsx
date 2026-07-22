// Next.js route-level Suspense fallback, shown automatically while FinanceiroPage's
// data load is in flight (period change, first navigation) — "Carregamento: Skeletons
// com o mesmo tamanho dos cartões", sized to match RevenueHeroCard/PaymentBreakdown/
// FinanceSummaryCard/FinanceKpisGrid so nothing jumps when the real content replaces it.
export default function FinanceiroLoading() {
  return (
    <div className="shell finance-page">
      <div className="finance-skeleton-header" />
      <div className="finance-skeleton-block" style={{ height: 36, width: '60%', marginTop: 14 }} />
      <div className="finance-skeleton-block" style={{ height: 44, marginTop: 14 }} />
      <div
        className="finance-skeleton-block"
        style={{ height: 168, marginTop: 16, borderRadius: 22 }}
      />
      <div
        className="finance-skeleton-block"
        style={{ height: 72, marginTop: 16, borderRadius: 18 }}
      />
      <div
        className="finance-skeleton-block"
        style={{ height: 72, marginTop: 10, borderRadius: 18 }}
      />
      <div
        className="finance-skeleton-block"
        style={{ height: 72, marginTop: 10, borderRadius: 18 }}
      />
      <div
        className="finance-skeleton-block"
        style={{ height: 176, marginTop: 16, borderRadius: 20 }}
      />
      <div className="finance-kpis-grid" style={{ marginTop: 16 }}>
        <div className="finance-skeleton-block" style={{ height: 86, borderRadius: 17 }} />
        <div className="finance-skeleton-block" style={{ height: 86, borderRadius: 17 }} />
        <div className="finance-skeleton-block" style={{ height: 86, borderRadius: 17 }} />
        <div className="finance-skeleton-block" style={{ height: 86, borderRadius: 17 }} />
      </div>
    </div>
  );
}
