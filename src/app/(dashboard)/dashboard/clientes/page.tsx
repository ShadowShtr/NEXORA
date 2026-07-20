import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 20;

function escapeIlikePattern(value: string): string {
  // PostgREST's or()/ilike syntax treats ",", ")" and "%"/"_" specially — a raw search
  // term containing any of them would otherwise break out of the filter expression or
  // be misinterpreted as a wildcard. Escaping keeps the search literal.
  return value.replace(/[%_,()]/g, (char) => `\\${char}`);
}

function pageHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const queryString = params.toString();
  return `/dashboard/clientes${queryString ? `?${queryString}` : ''}`;
}

// NEX-090: "Busca por nome/telefone, paginação e empty state" (docs/01_PRODUCT_REQUIREMENTS.md
// §10). requireProfile() (dashboard layout) gates this page to an authenticated,
// provisioned owner and derives tenantId from their session — the query below filters
// by it (RLS via createClient() enforces this too, as defense in depth), so a search
// can never surface another tenant's clients regardless of what the query string says.
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { tenantId } = await requireProfile();
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const supabase = await createClient();

  let request = supabase
    .from('clients')
    .select('id, name, phone_e164, first_seen_at', { count: 'exact' })
    .eq('tenant_id', tenantId);

  if (query) {
    const pattern = `%${escapeIlikePattern(query)}%`;
    request = request.or(`name.ilike.${pattern},phone_e164.ilike.${pattern}`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: clients, count } = await request.order('name').range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="shell">
      <p className="eyebrow">Clientes</p>
      <h1>Clientes</h1>

      <Card>
        <form className="clients-search-form" method="get">
          <label>
            Pesquisar por nome ou telemóvel
            <input type="search" name="q" defaultValue={query} placeholder="Ana ou 9XX XXX XXX" />
          </label>
          <Button type="submit">Pesquisar</Button>
        </form>
      </Card>

      {!clients || clients.length === 0 ? (
        <Card>
          <p>
            {query
              ? 'Nenhuma cliente encontrada para essa pesquisa.'
              : 'Ainda não tem clientes registadas.'}
          </p>
        </Card>
      ) : (
        <>
          <ul className="clients-list">
            {clients.map((client) => (
              <li key={client.id} className="clients-list-item">
                <a className="clients-list-link" href={`/dashboard/clientes/${client.id}`}>
                  <span className="clients-list-name">{client.name}</span>
                  <span className="clients-list-phone">{client.phone_e164}</span>
                </a>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <nav className="agenda-date-nav" aria-label="Paginação de clientes">
              {page > 1 ? (
                <a href={pageHref(query, page - 1)} className="button-secondary button">
                  Anterior
                </a>
              ) : (
                <span className="button-secondary button link-disabled" aria-disabled="true">
                  Anterior
                </span>
              )}
              <span className="agenda-range-label">
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <a href={pageHref(query, page + 1)} className="button-secondary button">
                  Seguinte
                </a>
              ) : (
                <span className="button-secondary button link-disabled" aria-disabled="true">
                  Seguinte
                </span>
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
