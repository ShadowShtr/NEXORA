# NEX-124 — Bloqueios completos

## Implementação

- `src/features/appointments/domain/availability-blocks.ts` (novo): três funções puras que os cinco tipos pedidos ("pontual, semanal, dia, intervalo e férias") reduzem a — `availability_blocks` já é só um intervalo `[starts_at, ends_at)` (`0001_initial.sql`), sem coluna de "tipo":
  - `timedBlockRange` — pontual (um período de horas num dia) e a base de cada ocorrência do semanal.
  - `allDayBlockRange` — dia inteiro (`firstDateKey === lastDateKey`), intervalo e férias, todos o mesmo intervalo de dias inteiros, fim exclusivo à meia-noite local do dia seguinte ao último.
  - `weeklyRecurringBlockRanges` — semanal recorrente, `occurrenceCount` (2-52, mesmo bound de `generateRecurrenceOccurrences`, NEX-120) intervalos semanais a partir da mesma data/hora local, DST-safe pelo mesmo padrão de âncora UTC-meio-dia + `fromZonedTime`.
  - "Férias" é implementada como um alias de "Intervalo" com motivo fixo `'Férias'`, não um mecanismo próprio — mesma forma de dados, só a UI/ação trata o motivo de forma diferente.
- `src/features/settings/availability-blocks-actions.ts` (novo): `createAvailabilityBlock` (um `.insert([...])` — uma única instrução SQL, atómica mesmo para os N registos do "semanal", sem precisar de RPC) e `deleteAvailabilityBlock` (`hasAffectedRows` após o `.delete()`, `ADR-010`). Nenhuma migração nova — `availability_blocks` já tinha RLS CRUD completo desde `0001_initial.sql`, só nunca tinha sido usada.
- `src/features/settings/AvailabilityBlocksManager.tsx` (novo): um formulário com seletor "Tipo" que revela só os campos de cada tipo (mesmo padrão da secção de recorrência do `ManualBookingForm.tsx`, NEX-122), mais a lista dos bloqueios futuros com remoção.
- `src/app/(dashboard)/dashboard/definicoes/page.tsx`: novo cartão "Bloqueios de agenda", a par dos já existentes (política de faltas, mensagem do lembrete).

## Testes

- `tests/unit/availability-blocks.test.ts` (novo, 9/9 ✅): pontual (intervalo correto, hora de fim ≤ início rejeitada); dia inteiro; intervalo multi-dia (fim exclusivo); intervalo através da transição de DST (2026-03-29); data de fim anterior à de início rejeitada; semanal recorrente (hora local preservada, incluindo através de DST); `occurrenceCount` fora de 2-52 rejeitado.
- `tests/integration/availability-blocks-impact.test.ts` (novo, 2/2 ✅) — **"Impacto em slots"**, o teste obrigatório desta tarefa: cobre exatamente os dois tipos que o teste já existente de NEX-062 (bloqueio de dia inteiro) não cobria — um bloqueio pontual parcial (10h-12h) remove só os slots sobrepostos desse dia, não o dia inteiro; um bloqueio semanal recorrente (3 ocorrências) remove a mesma janela em cada uma das 3 datas e em mais nenhuma (a semana antes do início do padrão fica intacta).
- `npm run verify` (format, lint, typecheck, 368 testes, build) — ✅.
- UI não testada num browser real (mesma limitação das tarefas anteriores desta sessão — sem staging Supabase separado, `ADR-007`).

## Resultado

A dona pode agora criar e remover os 5 tipos de bloqueio pedidos a partir de Definições, sem precisar de nenhuma tabela ou RPC nova — `availability_blocks` já estava pronta desde o modelo de dados inicial, só sem UI. O motor de disponibilidade (`computeAvailableSlotsMs`, NEX-083) já lia esta tabela desde sempre, por isso o "impacto nos slots" já era garantido pelo desenho existente; esta tarefa só prova que os tipos novos (pontual parcial, semanal) também funcionam.

## Riscos residuais

- "Férias" é um alias de "Intervalo" — se no futuro a dona precisar de tratar férias de forma distinta (ex.: mostrar isso publicamente de forma diferente), é preciso adicionar uma coluna própria; não inventado aqui sem necessidade demonstrada.
- UI não validada num browser real — só verificação estática.

## Próxima tarefa desbloqueada

NEX-125 — Horários especiais (depende de NEX-124, concluída).
