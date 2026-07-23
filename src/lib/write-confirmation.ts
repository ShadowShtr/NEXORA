// ADR-010 / saas-foundation REVERSAL_PREVENTION.md #4: "Escopo e linhas afetadas — a
// mutation inclui id e tenant/company na query. O retorno é solicitado. Zero linhas
// afetadas produz erro visível." Every direct .update()/.delete() call in this codebase
// already scopes by id + tenant_id, but under RLS a stale id, a wrong tenant, or a
// concurrent delete makes Supabase report success with zero rows changed — not an
// error. Chaining .select() on the mutation and checking the result with this turns
// that silent no-op into a real, user-visible NOT_FOUND instead of a false "guardado
// com sucesso" (exactly the "gravei mas desapareceu" class of bug the standard exists
// to prevent). Mutations that go through a security-definer RPC (complete_appointment,
// mark_payment_paid, mark_reminder_sent, etc.) already get this guarantee at the
// database transaction boundary via `select ... for update` + `raise exception` — this
// helper is for the remaining direct-table mutations that don't.
export function hasAffectedRows<T>(rows: readonly T[] | null | undefined): boolean {
  return Array.isArray(rows) && rows.length > 0;
}
