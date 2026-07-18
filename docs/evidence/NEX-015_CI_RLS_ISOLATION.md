# NEX-015 — Criar testes automatizados de isolamento

## Contexto

A suite de isolamento tenant-scoped (`tests/integration/*.test.ts`, 8 ficheiros/45 testes: `rls-tenant-isolation`, `catalog-rls`, `services-rls`, `packages-rls`, `provision-tenant-owner`, `publish-business`, `audit-log-immutability`, `schema-invariants`) já existia desde `NEX-012`/`NEX-013`/`NEX-040`-`043`, cobrindo SELECT/INSERT/UPDATE/DELETE cruzado entre tenants contra o boundary real (PostgREST + RLS, não mocks). O problema: cada ficheiro faz `describe.runIf(canUseSupabase())`/`test.skip(...)`, exigindo `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (ou `TEST_DATABASE_URL`) reais — e `.github/workflows/ci.yml` nunca definia estas variáveis (só valores fictícios para o `next build`). Resultado: a suite inteira ficava sempre `skip` em CI, nunca corria de facto em lado nenhum a não ser manualmente, na máquina de um developer com credenciais cloud exportadas. Esta tarefa não escreveu testes novos — tornou os já existentes executáveis a sério.

## Implementação

- `.github/workflows/ci.yml`: novo job `integration`, paralelo ao `verify` existente:
  1. `supabase/setup-cli@v3` + `supabase start` — sobe a stack local completa (Postgres, GoTrue/Auth, PostgREST/Kong) via Docker nativo do runner `ubuntu-latest` (a máquina de dev local não tem Docker/WSL2, `ADR-007` — por isso a suite nunca correu localmente com Supabase local; o runner de CI tem).
  2. `supabase start` aplica automaticamente as migrations `supabase/migrations/0001`-`0005` e o `seed.sql` (sintético, `demo-nails`) contra a instância fresca.
  3. `supabase status -o env --override-name ...` exporta as credenciais reais da instância local (URL, publishable/secret key, connection string Postgres) para as variáveis que a app e os testes esperam — via `eval "$(...)" ` sob `set -a`/`set +a` no mesmo passo, em vez de round-tripping por `$GITHUB_ENV` (o output vem citado no formato `dotenv`; escrever isso diretamente em `$GITHUB_ENV` bakearia os carateres de aspas no valor).
  4. `npm run test:integration` (novo script, `vitest run tests/integration`) corre a suite com as credenciais reais — pela primeira vez, de facto, em CI.
- `package.json`: `test:integration` (`vitest run tests/integration`) — reaproveitável localmente por quem tiver Docker.
- `supabase/config.toml`: dois bloqueadores reais encontrados e corrigidos (ver "Bugs encontrados" abaixo) — `storage.vector.enabled = false` e `auto_expose_new_tables = true` reativado.

## Bugs encontrados e corrigidos durante a validação

Sem Docker local, cada iteração exigiu um push + `gh run watch` real — três falhas genuínas encontradas e corrigidas nesta ordem:

1. **`supabase start` falhava a aplicar a migration `init`**: `could not open extension control file ".../vector.control"`. `supabase/config.toml` tinha `storage.vector.enabled = true` (default do scaffold, nunca revisto por falta de Docker local) — a imagem Postgres do CLI local não inclui a extensão `pgvector`, e a NEXORA não usa vector storage. Corrigido: `enabled = false`, comentário a explicar porquê (para uma tarefa futura que precise mesmo disto não repetir a descoberta do zero).
2. **Toda a suite falhava com `permission denied for table tenants`** (afetando 5 dos 8 ficheiros, incluindo o `service_role` "admin" client): nenhuma das migrations `0001`-`0005` tem `GRANT`s explícitos — todas dependem do comportamento legacy "auto-expose" (tabelas novas em `public` ficam automaticamente acessíveis a `anon`/`authenticated`/`service_role`). O projeto cloud usado como "Local" (`ADR-007`) tem esse comportamento por ser um projeto antigo; uma instância local fresca do CLI usa por omissão o novo default mais estrito (sem auto-expose, exige `GRANT`s explícitos). Corrigido: `auto_expose_new_tables = true` em `config.toml`, para a instância local corresponder ao projeto cloud existente — ver "Riscos residuais" abaixo, esta flag tem prazo de validade.
3. **`provision-tenant-owner.test.ts` falhava com `expected undefined to be 'setup'`**: sintoma do mesmo bug nº2 (a query `admin.from('tenants').select('status')` devolvia `data: null` por falta de `GRANT`, e o teste só verifica `.data?.status` sem primeiro afirmar `.error` como os outros ficheiros) — resolvido pela mesma correção.

## Testes

- `npm run test:integration` (local, sem Docker): 8 ficheiros / 45 testes — todos `skip` (comportamento correto e documentado: sem credenciais reais, a suite não falha, só não corre).
- CI (job `integration`, `ubuntu-latest`, Docker nativo): **8/8 ficheiros, 45/45 testes passam** contra uma instância Supabase local genuína — confirmado em execução real, não simulado (`gh run watch`, run [29641792412](https://github.com/ShadowShtr/NEXORA/actions/runs/29641792412)).
- `npm run verify` (job `verify`, inalterado) — ✅.

## Resultado

A suite de isolamento tenant-scoped que já existia passa a correr a sério em todo PR e push para `main`, contra uma instância Supabase local descartável (nunca a shared cloud dev, nunca dados reais) — uma regressão de RLS deixa de poder passar despercebida por a suite estar silenciosamente sempre skip.

## Riscos residuais

- **`auto_expose_new_tables` tem prazo de validade**: o próprio CLI documenta a remoção desta flag a 2026-10-30 ("once the always-revoked behaviour is permanent"). Nessa altura, tanto a instância local como (presumivelmente) o projeto cloud vão exigir `GRANT`s explícitos por tabela/role nas migrations — nenhuma das `0001`-`0005` os tem hoje. Não corrigido nesta tarefa (fora do escopo declarado, "criar testes automatizados de isolamento" não é "auditar/corrigir grants de todas as migrations") — deixado registado aqui para uma tarefa futura antes dessa data.
- O job `integration` não corre `supabase stop` no fim — aceitável por o runner ser efémero (destruído no fim do job), sem persistência entre execuções.

## Próxima tarefa desbloqueada

Nenhuma tarefa depende diretamente de `NEX-015`. Próxima tarefa não bloqueada por ordem de `TASKS.md`.
