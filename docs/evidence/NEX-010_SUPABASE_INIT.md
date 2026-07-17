# Evidência — NEX-010 Inicializar Supabase local

**Data:** 17 de julho de 2026
**Estado:** concluído (com desvio de ambiente documentado em `ADR-007`)

## Bloqueio de ambiente

Docker e WSL2 indisponíveis nesta sessão de execução (detalhe completo na conversa da tarefa e em `ADR-007`). Instalação de WSL2 tentada pelo owner, sem sucesso reprodutível. Decisão confirmada com o owner: usar um projeto Supabase cloud gratuito como ambiente de desenvolvimento interativo, mantendo `supabase/config.toml` pronto para `supabase start` assim que Docker estiver disponível.

## Ações executadas

1. `npx supabase init --yes` → criado `supabase/config.toml` e `supabase/.gitignore`; `major_version` corrigido de `17` (default) para `14` (versão real do Postgres do projeto, confirmada via PostgREST OpenAPI `info.version`).
2. `npx supabase db push --db-url "postgresql://...pooler.supabase.com:5432/postgres" --dry-run` → confirmou 1 migração pendente (`0001_initial.sql`).
3. `npx supabase db push --db-url "..." --yes` → migração aplicada com sucesso.
4. `npx supabase migration list --db-url "..."` → confirma histórico local/remoto sincronizado (`0001`/`0001`).
5. `npx supabase db push --db-url "..." --include-seed --yes` → `supabase/seed.sql` aplicado (tenant demo, categorias, serviços sintéticos).
6. Reexecução de `db push` (migração + seed) → `"Remote database is up to date"` / sem duplicados — idempotência confirmada.

## Testes de RLS (confirmação de isolamento)

- `GET /rest/v1/tenants` com chave `anon` → `[]` antes de existir tenant ativo (200, sem erro — RLS filtra, não bloqueia).
- Inserido via `service_role`: tenant A (`status=active`) e tenant B (`status=setup`).
- `GET /rest/v1/tenants` com chave `anon` → devolveu **apenas** tenant A. Tenant B (não ativo) corretamente invisível.
- `GET /rest/v1/clients` e `GET /rest/v1/audit_logs` com chave `anon` → `[]` (sem policy anónima nessas tabelas — RLS nega tudo, como esperado).
- Dados de teste apagados via `service_role` após validação (`DELETE ... slug in (...)`).
- `GET /rest/v1/services` com chave `anon` após seed → devolveu os 2 serviços sintéticos (`Verniz gel`, `Pedicure`), confirmando a policy pública de catálogo.

## Resultado

- `npm run verify`: aprovado.
- Migração e seed aplicados e verificados num Postgres real (Supabase cloud, projeto dev dedicado).
- Isolamento multi-tenant e políticas RLS existentes comprovadamente funcionais nesta fase inicial.
- Risco residual: reset completo (`supabase db reset`) não testado localmente; mitigação via CI com Docker prevista em `NEX-015`.
- Próxima tarefa desbloqueada: `NEX-011`.
