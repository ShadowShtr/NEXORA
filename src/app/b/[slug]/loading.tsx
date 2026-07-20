// Next.js shows this the instant a navigation into /b/[slug] (or any nested step —
// /servicos, /horario, /dados, /resumo) starts, while that route's Server Component
// fetches its data — the gap that made "Continuar" feel "travado" (nothing visibly
// happening between the click and the next page appearing).
export default function Loading() {
  return (
    <div className="public-loading">
      <div className="public-loading-spinner" aria-hidden="true" />
    </div>
  );
}
