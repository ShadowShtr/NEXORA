# NEX-123 — Editar escopo da série

## Implementação

- `supabase/migrations/0033_cancel_recurring_series_scope.sql` (novo): `cancel_recurring_series(p_appointment_id, p_scope)`, `p_scope in ('this_and_future', 'all')`. "Apenas ocorrência" já existe (`cancel_appointment`, NEX-084) e fica inalterado — esta RPC só cobre os dois escopos multi-linha.
  - `this_and_future`: cancela a marcação-gatilho e todas as marcações ainda canceláveis (`status in ('confirmed', 'presence_confirmed')`) da mesma `recurring_series_id` com `start_at >= ` a da marcação-gatilho.
  - `all`: cancela todas as marcações ainda canceláveis da série, independentemente da data (inclui ocorrências anteriores à marcação-gatilho, mas nunca as já concluídas/canceladas/em falta).
  - Implementado como uma única instrução `update ... returning id` dentro de um CTE — `select ... for update` não é compatível com `array_agg` (limite do Postgres para `FOR UPDATE` com funções de agregação), por isso o próprio `UPDATE` faz o locking das linhas e o `RETURNING` recolhe os ids afetados na mesma instrução. Atómico pela mesma razão que `create_recurring_series` (NEX-122): qualquer erro a meio aborta a instrução inteira.
  - Um único `audit_logs` ao nível da série (`recurring_series.cancelled`, não um por marcação) com `scope`, `triggered_from_appointment_id`, `cancelled_appointment_ids` e `cancelled_count` — auditável sem gerar dezenas de linhas quase idênticas.
- `src/features/appointments/detail-actions.ts`: `cancelRecurringSeries`, liga a RPC ao formulário — devolve `{ cancelledCount }` para a UI poder mostrar quantas marcações foram afetadas.
- `src/features/appointments/AppointmentDetailActions.tsx`: quando a marcação pertence a uma série (`recurringSeriesId`), o botão "Cancelar marcação" revela três opções — "Só esta marcação" (chama `cancelAppointment`, inalterado), "Esta e as próximas" e "Toda a série" (`cancelRecurringSeries` com o escopo correspondente) — em vez do único "Sim, cancelar" que as marcações avulsas continuam a ter.
- `src/app/(dashboard)/dashboard/agenda/[id]/page.tsx`: passa `recurring_series_id` à página de detalhe.

## Testes

- `tests/integration/cancel-recurring-series.test.ts` (novo, 7/7 ✅): anon bloqueado (`42501`); escopo inválido (`'this'`, que não é aceite por esta RPC) rejeitado; marcação doutro tenant rejeitada sem alterar o estado; marcação sem série rejeitada; marcação já concluída/cancelada/em falta rejeitada; `this_and_future` cancela a gatilho + futuras, preserva uma ocorrência anterior já concluída e não conta uma já cancelada; `all` cancela todas as ocorrências ainda canceláveis, incluindo uma anterior à gatilho.
- `npm run verify` (format, lint, typecheck, 359 testes, build) — ✅.

## Resultado

Fecha o bloco de recorrência (`EPIC-12`, `NEX-120` a `NEX-123`): gerar ocorrências, detetar conflitos, criar a série atomicamente e agora editar o seu escopo (cancelar esta/futuras/toda a série), tudo com UI integrada nos ecrãs já existentes (formulário de marcação manual e detalhe da marcação) em vez de ecrãs novos.

## Riscos residuais

- Só cobre cancelamento com escopo — "editar" no sentido de reagendar múltiplas ocorrências de uma vez (mover toda a série) não está no âmbito: o PRD não especifica essa necessidade e reagendar já implica escolher um único novo horário, que não generaliza trivialmente para "todas as futuras". Se vier a ser pedido, é uma tarefa nova.
- UI não testada num browser real (mesma limitação das tarefas anteriores — sem staging Supabase separado, `ADR-007`). Validado por typecheck/lint/build e revisão do JSX.

## Próxima tarefa desbloqueada

Nenhuma dentro do `EPIC-12` — `NEX-124`/`NEX-125` dependem de `NEX-060`/`NEX-082` (já concluídas), não de `NEX-123`. Backlog livre para seguir por ordem em `TASKS.md`.
