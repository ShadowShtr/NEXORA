# NEX-213 — Horários por prestador

## Objetivo

`provider_business_hours` com exceções, bloqueios, férias e intervalo
individual; prestador sem horário próprio herda o horário do negócio por
omissão.

## Implementação

`supabase/migrations/0041_provider_business_hours.sql`:

- `provider_business_hours` — mesma forma/constraints de `business_hours`
  (`0001_initial.sql`), agora por `service_providers.id`. Intervalo
  individual já coberto pelas colunas `lunch_starts_at`/`lunch_ends_at`
  (o mesmo mecanismo do horário do negócio, não uma coisa nova).
- `provider_business_hours_exceptions` — mesma forma de
  `business_hours_exceptions` (`0006_business_hours_exceptions.sql`), por
  prestador.
- `availability_blocks.provider_id` (coluna nova, opcional) — "bloqueios,
  férias" por prestador reaproveita a tabela já existente em vez de criar
  uma nova: `NULL` continua a bloquear o tenant inteiro (comportamento
  inalterado); preenchido restringe o bloqueio à agenda desse prestador.
- RLS tenant-scoped padrão nas duas tabelas novas.

`src/features/appointments/domain/provider-schedule.ts` —
`resolveProviderDayHours`: a herança é resolvida **por dia da semana**, não
tudo-ou-nada — um prestador pode definir horário só para um dia específico
(ex.: um sábado especial) e continuar a herdar o horário do negócio em
todos os outros dias. Uma exceção do próprio prestador (mesmo sem linha
semanal configurada nesse dia) tem sempre prioridade sobre herdar o horário
do negócio.

## Testes

- `tests/unit/provider-schedule.test.ts` (5/5, sem BD, **corridos e a
  passar de facto nesta sessão**): herança completa quando o prestador não
  tem horário próprio; herança da exceção do negócio também; horário
  próprio só num dia, com herança nos restantes; exceção do prestador tem
  prioridade sobre o horário semanal do prestador; exceção do prestador
  vence mesmo sem linha semanal correspondente.
- `tests/integration/provider-business-hours.test.ts` (5 testes, mesma
  limitação de execução real do `NEX-210`/`212` — corre no CI): aceita
  horário semanal único por dia (`unique(provider_id, day_of_week)`);
  rejeita `opens_at >= closes_at`; aceita exceção pontual; bloqueio
  (`availability_blocks`) pode ser restrito a um prestador via
  `provider_id`; bloqueio de tenant inteiro (`provider_id` nulo) continua a
  funcionar sem alteração.

## Estado real

A lógica de herança (o coração desta tarefa) está **verificada de facto,
localmente, sem depender de Docker/BD** — diferente de `NEX-210`/`212`,
onde só o schema fica por confirmar em CI. O schema/RLS seguem a mesma
limitação já documentada (sem Docker/DB direta nesta sessão).

## Definition of Done

- [x] Implementação concluída
- [ ] Testes concluídos — lógica de herança 5/5 real; testes de schema/RLS escritos, execução real pendente do CI
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
