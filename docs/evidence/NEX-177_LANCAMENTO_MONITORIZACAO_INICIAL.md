# NEX-177 — Lançamento e monitorização inicial

## Objetivo

Preparar a lista de métricas, o dashboard de logs, a rotina diária de
revisão, os critérios de rollback, o contacto de suporte e a recolha de
feedback estruturada para um lançamento inicial em beta.

## Implementação

Adicionada a secção "Lançamento inicial e monitorização (NEX-177)" a
`docs/09_RELEASE_PLAN.md`, reaproveitando integralmente a instrumentação real
já existente (`src/lib/logger.ts`/`src/lib/metrics.ts`, `NEX-170`/`NEX-171`,
documentada em `docs/08_OPERATIONS.md`) em vez de inventar métricas ou
dashboards que não existem. Referencia diretamente `docs/RUNBOOKS.md`
(`NEX-174`) para os critérios de rollback e `docs/BETA_CHECKLIST.md`
(`NEX-176`) para o estado real de prontidão.

## Gaps assumidos, não escondidos

- **Dashboard de logs**: não há serviço de observabilidade externo
  provisionado (`OBSERVABILITY_DSN` só planeado) — o "dashboard" real hoje é
  o painel nativo de logs da Vercel. Registado como tal, não apresentado como
  mais do que é.
- **Contacto de suporte**: mesmo gap já identificado em `NEX-176` —
  `EPIC-30` (centro de ajuda/feedback) não existe ainda. O canal mínimo para
  uma beta é contacto direto da dona, que deve ser combinado explicitamente
  com quem participar, não assumido.
- **Recolha de feedback estruturada**: sem formulário implementado
  (`NEX-323`), a recolha é manual (rotina diária + registo simples).

## Testes obrigatórios

- Revisão cruzada de cada métrica/evento citado contra o código real
  (`src/lib/logger.ts`/`src/lib/metrics.ts`) — confirmados, não inventados.
- `npm run verify` (ver fecho do lote).

## Definition of Done

- [x] Implementação concluída — secção em `docs/09_RELEASE_PLAN.md`
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
