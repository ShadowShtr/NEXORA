# NEX-121 — Detetar conflitos e alternativas

## Implementação

- `src/features/appointments/domain/recurrence-conflicts.ts` (novo): `detectRecurrenceConflicts`, função pura sem I/O — para cada ocorrência gerada por `generateRecurrenceOccurrences` (NEX-120), verifica se o instante está no conjunto de slots livres (`Set` para lookup O(1)) e, se não estiver, sugere até `maxAlternatives` (default 3) slots livres mais próximos, ordenados por proximidade e depois re-ordenados cronologicamente para leitura.
- `src/features/appointments/recurrence-conflicts-actions.ts` (novo): `checkRecurrenceConflicts`, server action que liga a função pura aos dados reais do tenant — reutiliza `computeAvailableSlotsMs` (`src/lib/availability-lookup.ts`, NEX-083), a mesma função já usada pelo fluxo público (NEX-062) e pela marcação manual (`getManualBookingAvailability`, NEX-085), para que uma ocorrência recorrente seja avaliada exatamente pela mesma noção de "disponível" que o resto da aplicação já usa — sem duplicar a lógica de horários/exceções/bloqueios. `tenantId` vem só de `requireProfile()` (sessão), nunca do input, mesmo limite de autoridade de `manual-availability-actions.ts` — garante "nenhum dado de outro tenant pode ser acedido" por construção, sem precisar de nenhuma RPC/migração nova.

## Testes

- `tests/unit/recurrence-conflicts.test.ts` (novo, 6/6 ✅): sem conflitos quando todas as ocorrências estão no conjunto disponível; conflito detetado para ocorrência ausente; alternativas mais próximas primeiro (com desempate por ordem) depois reordenadas cronologicamente; limite `maxAlternatives` respeitado; lista de alternativas vazia quando não há nada disponível; validação de `maxAlternatives` inválido.
- `npm run verify` (format, lint, typecheck, test — 359 passed, build) — ✅.
- `checkRecurrenceConflicts` (a server action de ligação) não tem teste dedicado — mesmo padrão de `manual-availability-actions.ts`/`availability-actions.ts` (NEX-062/085): é apenas "cola" fina entre peças já testadas (`detectRecurrenceConflicts` aqui, `computeAvailableSlotsMs` em NEX-083), sem lógica própria para validar isoladamente.

## Resultado

Deteção de conflitos e sugestão de alternativas para uma série recorrente, reutilizando por completo o motor de disponibilidade já existente — nenhuma tabela, RPC ou política RLS nova. Ainda sem UI (critério "quando houver UI" não se aplica: a UI de configurar/rever uma série fica para `NEX-122`, que já depende explicitamente desta).

## Riscos residuais

Uma ocorrência gerada fora da grelha de slots configurada (`slot_interval_minutes`) seria sempre marcada como conflito, mesmo sem sobreposição real — não é um problema hoje porque a primeira ocorrência de qualquer série vem sempre de uma marcação já criada pela grelha normal (`create_manual_booking`/`create_public_booking`), nunca de um horário arbitrário.

## Próxima tarefa desbloqueada

NEX-122 — Criar série atomicamente (depende de NEX-121, concluída).
