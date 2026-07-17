# Evidência — NEX-012 Implementar RLS tenant-scoped

**Data:** 17 de julho de 2026
**Estado:** concluído

## Contexto

RLS já vinha ativa e com políticas mínimas desde `0001_initial.sql` (tenant-scoped select/insert/update/delete para `authenticated`, catálogo público limitado para `anon`, sem policy alguma para `clients`/`appointments`/`payments`/`audit_logs` a `anon`). `NEX-011` acrescentou a camada de FKs compostas como defesa adicional. O que faltava para esta tarefa era a **auditoria sistemática** de cobertura e o **teste com sessões `authenticated` reais** de dois tenants — até aqui só se tinha testado `anon` vs. `service_role` (`NEX-010`).

## Auditoria de cobertura

Query a `pg_class.relrowsecurity` + `pg_policies` no projeto Supabase dev confirmou **18/18 tabelas** em `public` com RLS ativa e pelo menos 1 política (`audit_logs`, `booking_drafts` e `profiles` têm 1 política cada — leitura restrita, sem mutação direta por `authenticated`, escrita reservada a `service_role`/funções `security definer`; as restantes têm 4–5, cobrindo select/insert/update/delete e, quando aplicável, leitura pública).

## Teste com tenant A/B, anon e authenticated

Novo `tests/integration/rls-tenant-isolation.test.ts` (Vitest + `@supabase/supabase-js`), gated pelas mesmas env vars reais da app (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — sem configuração, os testes fazem skip limpo. Fluxo:

1. Cria dois tenants (`service_role`) e dois utilizadores Auth reais (`admin.auth.admin.createUser`, confirmados), cada um com `profile` a ligá-lo ao seu tenant.
2. Inicia sessão como cada utilizador (`signInWithPassword`) — passa a usar o JWT real, exatamente como a app faria.
3. Cria um registo `clients` privado no tenant A.

7 testes, todos passados contra o projeto Supabase dev real:

- dono autenticado vê o próprio registo;
- dono de outro tenant **não** vê (RLS filtra, `data.length === 0`, sem erro);
- `anon` também não vê;
- dono de outro tenant tenta `insert` a reclamar `tenant_id` alheio → rejeitado (`42501`, violação de RLS);
- dono de outro tenant tenta `update`/`delete` no registo alheio → 0 linhas afetadas, sem erro (RLS filtra antes do efeito);
- dono legítimo consegue atualizar o próprio registo.

Limpeza confirmada após o teste: tenants, profiles (cascade) e utilizadores Auth de teste removidos — verificado via API que não ficaram resíduos.

## Resultado

- `npm run verify`: aprovado.
- Cobertura de RLS auditada sistematicamente (não só lida no código).
- Isolamento entre tenants comprovado com sessões `authenticated` reais, cobrindo SELECT/INSERT/UPDATE/DELETE cruzado — este é o mesmo padrão que `NEX-015` vai formalizar como suite completa em CI.
- Próxima tarefa desbloqueada: `NEX-013`.
