# NEX-171 — Métricas e alertas

## Implementação

- **`src/lib/metrics.ts`** (novo) — `severityForErrorCode(code: AppErrorCode):
'warn' | 'error'`. Esta função pequena e pura **é** a definição de alerta desta
  tarefa: como não há serviço externo de alertas a provisionar (`CLAUDE.md`), a única
  coisa que distingue "isto devia acordar alguém" de "resultado de negócio já
  esperado" é o `level` da linha de log. `INTERNAL_ERROR` → `error`; todos os outros
  códigos partilhados de `src/lib/result.ts` (`VALIDATION_ERROR`, `UNAUTHENTICATED`,
  `NOT_FOUND`, `SLOT_TAKEN`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`) → `warn`. Um
  futuro alerta baseado em log-drain (Vercel ou outro) só precisa de filtrar por
  `level: error` para cobrir "aumento de 5xx"/"falha contínua de booking" sem lógica
  adicional no código.
- **Booking público** (`src/app/b/[slug]/booking-actions.ts`) — `booking.public.created`
  (info), `booking.public.slot_conflict` (warn, a métrica "conflict rate"),
  `booking.public.idempotency_conflict`/`tenant_not_published`/`rate_limited` (warn),
  `booking.public.failed` (error, tudo o resto).
- **Login** (`src/features/auth/actions.ts`) — `auth.login.rate_limited` (warn, com
  `ipLimited`/`emailLimited` como booleanos separados, nunca o e-mail em si),
  `auth.login.failed` (warn), `auth.login.succeeded` (info).
- **Exportações** — as três rotas `api/financeiro/export*` e `api/clientes/[id]/export`
  **não tinham nenhum try/catch antes desta tarefa** — qualquer falha (query,
  geração de CSV/Excel/PDF) resultava num 500 silencioso do próprio Next.js, sem
  nenhuma linha de log. Agora: `finance.export.succeeded`/`clients.export.succeeded`
  (info), `finance.export.failed`/`clients.export.failed` (error). `requireProfile()`
  fica deliberadamente **fora** do bloco `try/catch` em cada rota — internamente faz
  `redirect()`, que o Next.js implementa como uma exceção especial; capturá-la aqui
  reportaria incorretamente um redirecionamento normal como falha de exportação.
- **`src/features/finance/log-export.ts`** (achado durante a implementação) — o
  `try/catch` à volta da chamada RPC nunca desestruturava `{ error }`, só a exceção
  de rede — uma resposta de erro genuína do Postgrest (não uma exceção) passava
  completamente despercebida. Agora ambos os casos emitem
  `finance.export.audit_log_failed` (warn) sem nunca bloquear o download em si
  (continua best-effort, tal como antes).
- **Reminders** (`src/app/(dashboard)/dashboard/lembretes/page.tsx`) —
  `reminders.page_loaded`, `warn` quando há lembretes atrasados (`lateTotal > 0`),
  `info` caso contrário. Só é emitido quando a dona abre a página — não existe (nem
  foi criado nesta tarefa) um mecanismo periódico/cron independente disso, ver
  "Riscos residuais".
- **`docs/08_OPERATIONS.md`** — a secção "Observabilidade" deixou de ser só uma lista
  aspiracional e passa a mapear cada métrica/alerta ao nome de evento e nível
  concretos onde é emitido (ou à razão de ainda não estar instrumentado).

## Testes

- `tests/unit/metrics.test.ts` (novo) — cobre o teste obrigatório desta tarefa
  ("Alert test"): cada um dos 8 `AppErrorCode` existentes tem a sua classificação
  `warn`/`error` testada explicitamente, para que uma futura adição ao union não
  passe despercebida sem classificação.
- Verificação manual contra um servidor de produção real (`next build && next
start`), reutilizando specs E2E já existentes (`reminders-list.spec.ts`,
  `client-export.spec.ts`) mais um script de verificação pontual (não commitado)
  para a exportação CSV financeira — confirmou, inspecionando o log real: `auth.login.succeeded`,
  `reminders.page_loaded` (com `level: warn` corretamente quando havia lembretes
  atrasados), `clients.export.succeeded`, `finance.export.succeeded`, e — achado
  relevante — `finance.export.audit_log_failed` a aparecer de verdade, porque o
  projeto Supabase de dev partilhado ainda não tem a migração `0034_log_finance_export.sql`
  aplicada (mesma limitação já documentada na `NEX-167`, não um bug novo).
- `npm run verify` (format, lint, typecheck, 493 testes, build, budget) — ✅.

## Resultado

As seis áreas exigidas pelos critérios de aceite (booking, conflitos, 5xx, auth,
reminders, exports) têm agora eventos estruturados e pesquisáveis no log da Vercel,
com uma única regra de severidade partilhada e testada a decidir o que é
"alerta-worthy". As quatro rotas de exportação, que não tinham nenhum tratamento de
erro antes desta tarefa, ganharam observabilidade real de falhas — não só a métrica
pedida, mas uma lacuna de robustez genuína fechada de caminho.

## Riscos residuais

- **Reminders "pending overdue"** só é medido quando a dona abre a página
  `/dashboard/lembretes` — não há um cron/job periódico independente disso (ao
  contrário de `cleanup-booking-drafts`). Um mecanismo assim é uma tarefa própria,
  fora do âmbito desta.
- **Payments pending** e **e-mail provider degradado** (da lista original de
  `docs/08_OPERATIONS.md`) continuam sem instrumentação — não fazem parte dos seis
  critérios de aceite explícitos desta tarefa ("Booking, conflitos, 5xx, auth,
  reminders, exports"); ficam registados como candidatos a uma iteração futura.
- **RLS denials/anomalias** também não fazem parte dos critérios de aceite
  explícitos desta tarefa. Investigação confirmou que não existe hoje nenhum
  caminho de código que alcance genuinamente um `42501` de RLS — o único `42501`
  existente no repositório é uma exceção de negócio explícita ("tenant não
  publicado"), não uma RLS denial real. Instrumentar isto exigiria um wrapper
  central novo à volta das chamadas Supabase (mudança estrutural maior, não uma
  simples chamada a `logEvent()`) — fica para tarefa própria se/quando fizer
  sentido.
- **p50/p95/p99** não são medidos no código da app — usar o dashboard de
  performance da própria Vercel.

## Próxima tarefa desbloqueada

NEX-172 — Deploy Vercel e Supabase separados (depende de NEX-003, NEX-010).
