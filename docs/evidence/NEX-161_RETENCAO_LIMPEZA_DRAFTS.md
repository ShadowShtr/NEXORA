# NEX-161 — Retenção e limpeza de drafts

## Implementação

- **Gap real encontrado**: `booking_drafts` (`NEX-052`) já tinha `expires_at` (≤24h) e
  limpeza _reativa_: `resumeBookingDraft` apaga um rascunho expirado só quando alguém
  tenta mesmo retomá-lo. O caso comum — a visitante nunca volta — nunca era limpo; o
  rascunho ficava expirado-mas-presente na tabela indefinidamente, ao contrário do que
  `CLAUDE.md` já pedia ("não guardar rascunhos abandonados indefinidamente").
- **`supabase/migrations/0035_cleanup_expired_booking_drafts.sql`** (novo) — RPC
  `cleanup_expired_booking_drafts()` (`security definer`) apaga todas as linhas com
  `expires_at < now()` e devolve a contagem apagada. Revogada de `anon`/`authenticated`,
  concedida só a `service_role` — mesmo padrão de `provision_tenant_owner` (`NEX-013`):
  uma operação de manutenção sem sessão de tenant, nunca invocável por um utilizador
  normal.
- **`src/app/api/cron/cleanup-booking-drafts/route.ts`** (novo) — chama a RPC via
  `createAdminClient()`, protegido por `CRON_SECRET` (novo, opcional — sem ele, o
  endpoint aceita qualquer chamada, risco baixo porque só apaga o que já expirou).
  Falhas ficam registadas via `console.error` e devolvem `500`, que a própria Vercel
  regista como invocação falhada no seu painel de Cron Jobs — é aí que fica a "auditoria
  de falhas" pedida pelo critério de aceite, não em `audit_logs` (essa tabela é sempre
  por tenant; uma limpeza global não é um evento atribuível a um tenant específico).
- **`vercel.json`** (novo) — agenda o endpoint para correr diariamente às 04:00 UTC
  (`0 4 * * *`), dentro do limite de uma execução/dia do plano Hobby da Vercel.
- **`src/lib/cron-auth.ts`** (novo) — `isAuthorizedCronRequest()`, lógica pura extraída
  para ser testável sem simular um pedido HTTP.
- `docs/ENVIRONMENTS_AND_SECRETS.md` e `.env.example` atualizados com `CRON_SECRET`,
  conforme a própria regra do documento ("cada nova variável... atualiza esta tabela").

## Testes

- `tests/unit/cron-auth.test.ts` (novo, 2 casos) — sem `CRON_SECRET`, aceita qualquer
  chamada; com `CRON_SECRET`, exige o bearer token exato.
- `tests/integration/cleanup-expired-booking-drafts.test.ts` (novo) — cobre o teste
  obrigatório desta tarefa ("Teste de expiração"): confirma que `anon` recebe `42501`
  (mesmo padrão de teste de grant já usado em `create-public-booking-grant.test.ts`),
  e que a RPC apaga só o rascunho expirado, mantendo o ativo.
- **Não foi possível correr localmente** — sem Docker/WSL2 (`ADR-007`), e a migração
  0035 ainda não foi aplicada ao projeto Supabase de dev usado localmente (sem CLI
  autenticado nesta sessão para a aplicar com segurança). Verificado só via CI
  (`integration`, que corre `supabase start` com Docker e aplica todas as migrações de
  raiz a cada execução).
- `npm run verify` (format, lint, typecheck, 441 testes, build, budget) — ✅.

## Resultado

Rascunhos de marcação abandonados (o caso comum, não o caso de retoma) passam a ser
removidos ativamente todos os dias, não só na rara ocasião em que alguém tenta
retomar um link expirado. Falhas do job ficam visíveis no painel de Cron Jobs da
Vercel.

## Riscos residuais

- Migração 0035 não testada localmente antes do push — só via CI. Consistente com o
  que já acontece com todas as outras migrações desta sessão (mesma limitação de
  ambiente, `ADR-007`).
- `CRON_SECRET` ainda não está provisionado em produção — o endpoint fica acessível
  sem autenticação até a dona o configurar na Vercel; risco aceite e documentado (só
  apaga rascunhos já expirados, nenhum dado de negócio).
- Job corre uma vez por dia (limite do plano Hobby da Vercel) — um rascunho pode ficar
  até ~24h além do seu `expires_at` antes de ser fisicamente apagado; não é um problema
  de acesso (a app já trata qualquer rascunho expirado como inexistente ao tentar
  retomá-lo), só de limpeza física adiada.

## Próxima tarefa desbloqueada

NEX-162 — Exportar dados da cliente (depende de NEX-091, já concluída).
