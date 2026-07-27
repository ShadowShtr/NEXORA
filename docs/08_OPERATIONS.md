# 08 — Produção e operação

> Matriz detalhada de ambientes, segredos, owners e rotação: `docs/ENVIRONMENTS_AND_SECRETS.md`.

## Ambientes

- Local: Supabase local e dados sintéticos.
- Preview: Vercel por PR, Supabase de desenvolvimento/preview quando viável.
- Produção: projeto Vercel e Supabase separados, credenciais próprias.

Nunca reutilizar service role de produção em preview.

## Deploy

1. PR aprovado.
2. CI verde.
3. Preview validado.
4. Migration revista.
5. Merge em `main`.
6. Deploy Vercel.
7. Smoke test automatizado.
8. Monitorização inicial.

## Migrações

- forward-only por padrão;
- transacionais quando suportado;
- alterações destrutivas em duas fases;
- backup/checkpoint antes de mudança de alto risco;
- nunca editar migration já aplicada.

## Observabilidade

Base: `src/lib/logger.ts` (`NEX-170`) — cada linha é JSON estruturado em stdout/stderr,
capturado pela Vercel sem serviço externo. `src/lib/metrics.ts`
(`severityForErrorCode`, `NEX-171`) define a única regra de severidade que importa
para alertas: **`error` é o que deveria acordar alguém; `warn` é um resultado de
negócio já esperado e tratado** (password errada, slot já ocupado, rate limit) —
configurar qualquer ferramenta de log-drain/alerta futura para disparar em `level:
error` já cobre "falha contínua", sem precisar de lógica adicional no código.

Métricas (evento → onde é emitido):

- booking success/failure — `booking.public.created` (info) /
  `booking.public.failed` (error) — `src/app/b/[slug]/booking-actions.ts`.
- slot conflict rate — `booking.public.slot_conflict` (warn) — mesmo ficheiro.
- p50/p95/p99 — não instrumentado no código da app; usar o próprio dashboard de
  performance da Vercel (tempo de resposta por rota).
- login failures — `auth.login.rate_limited` / `auth.login.failed` (warn),
  `auth.login.succeeded` (info) — `src/features/auth/actions.ts`.
- reminders pending overdue — `reminders.page_loaded` (warn quando `lateTotal > 0`,
  info caso contrário) — `src/app/(dashboard)/dashboard/lembretes/page.tsx`. Só emite
  quando a dona abre a página (sem cron dedicado, ver "Riscos residuais" da
  `NEX-171`).
- payments pending — ainda não instrumentado; candidato natural a uma futura
  iteração desta mesma página/consulta.
- export failures — `finance.export.succeeded` / `finance.export.failed` (error) —
  as três rotas `api/financeiro/export*`; `clients.export.succeeded` /
  `clients.export.failed` (error) — `api/clientes/[id]/export`;
  `finance.export.audit_log_failed` (warn, best-effort, nunca bloqueia o download) —
  `src/features/finance/log-export.ts`.
- RLS denials/anomalias sem PII — não instrumentado nesta tarefa (âmbito da
  `NEX-171` cobria só booking/conflitos/5xx/auth/reminders/exports); não existe hoje
  nenhum caminho de código que alcance um `42501` de RLS genuína (o único `42501`
  existente é uma exceção de negócio explícita, "tenant não publicado", não uma RLS
  denial) — ver `docs/evidence/NEX-171_METRICAS_ALERTAS.md`.

Alertas iniciais:

- aumento de 5xx — filtrar `level: error` nos eventos acima (`booking.public.failed`,
  `finance.export.failed`, `clients.export.failed`).
- falha contínua de booking — volume de `booking.public.failed` (error) ou
  `booking.public.slot_conflict` (warn) acima do baseline num dado tenant/período.
- migrations/deploy falho — fora do código da app (GitHub Actions/Vercel).
- e-mail provider degradado — não instrumentado (o envio de confirmação de
  marcação é fire-and-forget, `booking-actions.ts`); candidato a futura iteração.
- erros de autenticação acima do baseline — volume de `auth.login.rate_limited`/
  `auth.login.failed` (warn) acima do baseline.

## Backups

- usar backups geridos do Supabase conforme plano;
- documentar frequência e retenção real;
- testar restore trimestralmente no MVP;
- RPO alvo inicial 24 h, RTO 4 h;
- aumentar proteção conforme clientes/receita.

## Incidentes

Severidades:

- SEV1: indisponibilidade ampla, acesso indevido confirmado, perda de dados.
- SEV2: booking/financeiro degradado sem workaround adequado.
- SEV3: falha limitada com workaround.
- SEV4: bug menor.

Cada incidente deve ter timeline, impacto, contenção, recuperação, comunicação e postmortem.

## Custos

Monitorizar:

- Vercel functions/bandwidth;
- Supabase DB/storage/egress;
- e-mail;
- observabilidade;
- geração de relatórios.

Definir alertas de budget antes do lançamento comercial.

## Runbooks mínimos

- booking indisponível;
- conflito elevado;
- auth indisponível;
- service role comprometida;
- restauração de backup;
- falha de e-mail;
- fotografia exposta;
- tenant access incident.
