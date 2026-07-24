# NEX-120 — Gerador de recorrências

## Implementação

- `src/features/appointments/domain/recurrence.ts` (novo): `generateRecurrenceOccurrences`, função pura sem I/O — mesmo padrão de `domain/availability.ts` (`generateTimezoneAwareSlots`) e `domain/daily-schedule.ts`: aritmética de calendário via um âncora UTC-meio-dia (nunca um instante real por si só), recombinada com a hora local original e resolvida para o instante UTC correto via `fromZonedTime`. Isto garante DST-safety por construção — cada ocorrência preserva a hora local (ex.: "09:00"), e é o `fromZonedTime` que escolhe o offset UTC certo para essa data futura especifica, não uma soma ingénua de milissegundos.
- Frequências (`weekly`/`biweekly`/`three_weeks`/`monthly`/`custom`) copiadas verbatim do `check` constraint de `recurring_series.frequency` (`supabase/migrations/0001_initial.sql`, tabela já existente desde a migração inicial, ainda não usada por nenhuma tarefa) — mapeiam diretamente para "semanal, quinzenal, a cada 3 semanas, mensal ou intervalo personalizado" (`docs/01_PRODUCT_REQUIREMENTS.md` §7).
- `occurrenceCount` limitado a 2-52 — mesmo bound do `check` de `recurring_series.occurrence_count`, para que uma tarefa futura que persista a série (`NEX-122`) escreva o valor diretamente na coluna sem tradução. Mínimo 2 porque uma "série" de 1 ocorrência é só o fluxo de marcação normal, não uma recorrência.
- `customIntervalDays` (só para `frequency='custom'`) é uma decisão própria desta tarefa: o produto não especifica a unidade de "intervalo personalizado", e dias é a leitura mais literal e genérica (em vez de inventar implicitamente "semanas"). Limitado 1-52 para reutilizar o mesmo bound de `recurring_series.interval_value`.
- Mensal usa `addMonths` (date-fns) sobre o âncora — herda o clamping de fim de mês da própria biblioteca (31 Jan → 28/29 Fev) sem lógica própria. Cada ocorrência é calculada a partir da **primeira** ocorrência (não da anterior), por isso um mês clampado (Jun 30) não "contamina" o mês seguinte (Jul volta a 31) — testado explicitamente.

## Testes

- `tests/unit/recurrence.test.ts` (novo, 15/15 ✅): primeira ocorrência = input exato; passo de 7/14/21/N dias para weekly/biweekly/three_weeks/custom; fim de mês (clamping não cumulativo + dia do meio do mês sem clamping); DST spring-forward (2026-03-29) e fall-back (2026-10-25) — hora local preservada, instante UTC desloca 1h; validação de `occurrenceCount` (2-52, inteiro) e `customIntervalDays` (obrigatório e 1-52 só quando `frequency='custom'`).
- `npm run verify` (format, lint, typecheck, test — 353 passed, build) — ✅.

## Resultado

Gerador puro de datas de recorrência, sem UI nem escrita em base de dados — âmbito da tarefa é só "Frequências aprovadas e quantidade" (critério de aceite do `EPIC-12.md`). Deteção de conflitos (`NEX-121`), criação atómica da série (`NEX-122`) e UI de configuração ficam para as tarefas seguintes, que já dependem explicitamente desta.

## Riscos residuais

- **Unidade de `customIntervalDays` (dias) não confirmada com produto/UI** — é a leitura mais literal do "intervalo personalizado" do PRD, mas não há especificação explícita. Quando `NEX-122` desenhar a UI de criação de série, confirmar se "personalizado" deve mesmo ser em dias antes de mapear para `recurring_series.interval_value`.
- Nenhuma superfície nova de escrita nem acesso a dados de outro tenant — função pura, sem argumento tenant-scoped.

## Próxima tarefa desbloqueada

NEX-121 — Detetar conflitos e alternativas (depende de NEX-120, concluída).
