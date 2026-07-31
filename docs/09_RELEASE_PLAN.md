# 09 — Plano de lançamento

## Fase 0 — Fundação

Repositório, CI, ambientes, docs, schema e RLS.

## Fase 1 — Vertical de marcação

Onboarding, catálogo, disponibilidade, booking público e agenda da dona.

## Fase 2 — Operação diária

Clientes, lembretes WhatsApp, conclusão, pagamentos e pendências.

## Fase 3 — Gestão

Recorrência, bloqueios avançados, relatórios e exportações.

## Fase 4 — Hardening

PWA, acessibilidade, performance, privacy workflows, observabilidade, restore, pentest.

## Beta privado

Critérios:

- uma dona real consegue concluir onboarding sem ajuda técnica;
- cinco fluxos de marcação consecutivos sem erro;
- sem dupla reserva em teste concorrente;
- RLS validada;
- export financeiro reconciliado;
- backup/restore verificado;
- política de privacidade e contratos revistos externamente.

## Produção comercial

- Vercel/Supabase em planos compatíveis com uso comercial e necessidades de backup;
- domínio e e-mail configurados;
- monitorização e budget alerts;
- DPA/subprocessadores documentados;
- pentest proporcional;
- suporte e incident owner definidos.

## Lançamento inicial e monitorização (NEX-177)

> Checklist de prontidão avaliada em `docs/BETA_CHECKLIST.md` (`NEX-176`) —
> conclusão atual **NO-GO** para clientes reais (backup real, política de
> privacidade e suporte ainda por resolver). Esta secção prepara o
> acompanhamento para quando esses bloqueadores forem fechados, não substitui
> a decisão de avançar.

### Lista de métricas a acompanhar

Reaproveita a instrumentação já real de `docs/08_OPERATIONS.md` →
Observabilidade (`src/lib/logger.ts`/`src/lib/metrics.ts`, `NEX-170`/`NEX-171`)
— não inventa métricas novas sem uma fonte de dados real:

- reservas públicas criadas/falhadas (`booking.public.created`/`.failed`);
- conflitos de slot (`booking.public.slot_conflict`);
- falhas de login/rate limit (`auth.login.failed`/`.rate_limited`);
- falhas de exportação (`finance.export.failed`/`clients.export.failed`);
- lembretes pendentes em atraso (visível na página Lembretes ao abrir, sem cron dedicado);
- diferenças de caixa e pagamentos pendentes, quando `EPIC-22` existir.

### Dashboard de logs

Sem serviço de observabilidade externo contratado ainda (`OBSERVABILITY_DSN`
planeado, não provisionado) — os logs estruturados JSON já chegam ao
dashboard nativo da Vercel (Functions → Logs), filtráveis por `level` e pelo
nome do evento. É o "dashboard" real disponível hoje.

### Rotina diária de revisão (primeiras 2 semanas de qualquer beta real)

1. Abrir o dashboard de logs da Vercel, filtrar `level: error` do último dia.
2. Abrir `/dashboard/lembretes` — confirmar que não há lembretes pendentes acumulados.
3. Abrir `/dashboard/financeiro/pendentes` — confirmar que nenhuma dívida ficou esquecida.
4. Confirmar que o deployment de produção continua "Ready" no Vercel.
5. Perguntar diretamente à dona (WhatsApp/chamada) se algo pareceu estranho — nesta fase, sem instrumentação de satisfação automática, a pergunta direta é o mecanismo de feedback real.

### Critérios de rollback

- Qualquer SEV1 (ver `docs/RUNBOOKS.md`) sem contenção rápida: reverter para
  o deployment de produção anterior conhecido-bom via "Instant Rollback" no
  Vercel.
- Bug de concorrência ou dupla marcação suspeitado: tratar como SEV1
  imediatamente (runbook 6/9 de `docs/RUNBOOKS.md`), não esperar confirmação
  completa antes de agir.
- Nenhum rollback de dados (restore de backup) sem confirmar primeiro o RPO
  real disponível (`docs/evidence/NEX-173_BACKUPS_RESTORE_TEST.md`).

### Contacto de suporte

**Gap conhecido, não escondido** (mesmo achado de `NEX-176`): não existe
ainda um canal de suporte formal (`EPIC-30`). Para uma beta inicial, o canal
mínimo real é contacto direto da dona (WhatsApp/e-mail pessoal) — deve ser
combinado explicitamente com quem participar na beta antes de começar, não
assumido.

### Recolha de feedback estruturada

Sem formulário de feedback implementado ainda (`NEX-323`, `EPIC-30`). Até lá,
recolha manual: a rotina diária acima (item 5) mais um registo simples (nota
partilhada ou ficheiro) do que a dona reportar, para não perder contexto
entre conversas.
