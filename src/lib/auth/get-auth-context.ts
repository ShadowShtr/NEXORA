import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// PR3 (docs/audits/NEXORA_PERFORMANCE_AUDIT.md secção 0 — atualização PR3): centraliza
// a resolução de identidade + perfil que requireProfile()/getOptionalProfile()
// duplicavam ficheiro a ficheiro. A dashboard layout e cada page.tsx sob ela chamavam
// requireProfile() de forma independente — mesma claims lookup, mesma query a
// `profiles`, uma vez por componente, dentro do mesmo request.
export type AuthProfile = {
  userId: string;
  tenantId: string;
  // Resolvido aqui via `profiles.tenant_id -> tenants.slug` (join na mesma query, não
  // uma segunda ida à base) precisamente porque duas rotas (dashboard/page.tsx,
  // dashboard/mais/page.tsx) já faziam essa mesma segunda query redundantemente — ver
  // PR3, secção "duplicações removidas" do relatório.
  tenantSlug: string;
  displayName: string;
  email: string | null;
};

export type AuthContextResult =
  | { status: 'unauthenticated' }
  | { status: 'no_profile'; userId: string }
  | { status: 'ok'; profile: AuthProfile };

// `cache()` do React memoiza por render/request (Server Components) ou por uma única
// invocação de Server Action / Route Handler (é assim que o Next.js implementa a API
// `cache()` do React) — nunca entre pedidos diferentes, nunca entre utilizadores
// diferentes (cada memoização vive presa à árvore de render/execução daquele pedido
// específico; um novo pedido começa com uma cache vazia). Não é `unstable_cache` nem
// qualquer outra forma de cache persistente/partilhada — não guarda nada em memória
// entre requests.
//
// Deliberadamente puro: sem `redirect()`, sem `signOut()`, sem qualquer efeito
// secundário aqui dentro. Um resultado memoizado por `cache()` pode, em teoria, ser
// devolvido de novo sem a função voltar a correr — reexecutar um `redirect()`/
// `signOut()` nesse replay seria surpreendente e incorreto. Os efeitos ficam nos
// consumidores (requireProfile/getOptionalProfile), que decidem o que fazer com o
// resultado.
export const getAuthContext = cache(async (): Promise<AuthContextResult> => {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return { status: 'unauthenticated' };
  }

  const userId = claimsData.claims.sub;
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('user_id, tenant_id, display_name, tenants(slug)')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profileRow) {
    return { status: 'no_profile', userId };
  }

  // Embedded resource — PostgREST returns an object for a to-one FK relationship, but
  // the generated type is technically `T | T[]`; normalize the same way every other
  // embedded-relation read in this codebase already does (e.g.
  // src/app/(dashboard)/dashboard/page.tsx's `row.clients`).
  const tenant = Array.isArray(profileRow.tenants) ? profileRow.tenants[0] : profileRow.tenants;

  return {
    status: 'ok',
    profile: {
      userId,
      tenantId: profileRow.tenant_id,
      tenantSlug: tenant?.slug ?? '',
      displayName: profileRow.display_name ?? '',
      email: claimsData.claims.email ?? null,
    },
  };
});
