# NEX-216 — Motor de disponibilidade multi-recurso

## Objetivo

Estender o motor de disponibilidade (`generateTimezoneAwareSlots`, NEX-061) para
suportar prestador opcional e recurso (sala/equipamento), sem duplicar a lógica de
geração de slots já testada e sem quebrar nenhum chamador existente.

## O que foi feito

1. `src/features/appointments/domain/availability.ts` — `generateTimezoneAwareSlots`
   passou a aceitar um parâmetro opcional `resolveHours`, com default
   `resolveDayHours` (o comportamento anterior, inalterado para todos os chamadores
   existentes). Isto permite que um chamador com contexto de prestador injete a sua
   própria resolução diária de horários sem duplicar o walk-day-by-day/DST-safety já
   existente.
2. `src/features/appointments/domain/multi-resource-availability.ts` (novo):
   - `generateMultiResourceSlots()` — usa `resolveProviderDayHours` (NEX-213) como
     `resolveHours`, com fallback automático para o horário do negócio quando não há
     horário específico do prestador nesse dia. O `busy` continua a ser
     responsabilidade do chamador (mesma convenção de `computeAvailableSlotsMs`,
     `src/lib/availability-lookup.ts`): mesclar bloqueios tenant-wide + do prestador +
     do recurso antes de invocar esta função.
   - `isWithinOpenHours()` — verifica se um candidato específico (já calculado) cai
     dentro do horário efetivo (prestador, com fallback ao negócio), para
     classificação `LOCATION_CLOSED` antes de sequer tentar uma escrita na BD.
   - `classifyOverlapConstraintViolation()` — mapeia o nome da constraint de exclusão
     do Postgres (ADR-012, `0043_resources_and_multi_resource_conflicts.sql`) para um
     código de conflito (`PROVIDER_TAKEN`/`RESOURCE_TAKEN`/`SLOT_TAKEN`), espelhando a
     distinção que o fluxo de marcação pública já faz para o caso tenant-wide único
     (`SLOT_TAKEN`).

## Testes

`tests/unit/multi-resource-availability.test.ts` (10 testes, todos reais e a passar):

- `generateMultiResourceSlots`: sem prestador reproduz o comportamento simples do
  motor base; com prestador de horário mais estreito, respeita esse horário; exclui
  slots sobre intervalos ocupados mesclados pelo chamador.
- `isWithinOpenHours`: verdadeiro dentro do horário do negócio; falso fora dele
  (caso `LOCATION_CLOSED`); respeita um horário de prestador mais estreito mesmo
  quando o negócio está aberto.
- `classifyOverlapConstraintViolation`: mapeia corretamente as três constraints reais
  criadas em `0043_resources_and_multi_resource_conflicts.sql`
  (`appointments_no_overlap_provider`/`_resource`/`_tenant_wide`) e devolve `null`
  para um nome desconhecido.

Também reconfirmados sem regressão (mudança em `availability.ts` é aditiva e
backward-compatible): `tests/unit/availability.test.ts`,
`tests/unit/timezone-aware-slots.test.ts`.

`npm run verify` completo (format, lint, typecheck, 635 testes unitários/integração
passados + 224 skipped por falta de credenciais reais, build, bundle budget) —
tudo verde.

## Riscos residuais

- `classifyOverlapConstraintViolation` mapeia os nomes das constraints tal como
  definidos na migração NEX-215; se essa migração for alterada sem atualizar esta
  função, a classificação de conflito fica dessincronizada silenciosamente (devolve
  `null` em vez do código certo). Não há teste de integração real contra a exclusão
  do Postgres nesta tarefa — a migração já tem essa cobertura própria em
  `tests/integration/resources-and-overlap.test.ts` (NEX-215).
- A junção de `busy` (tenant + prestador + recurso) continua a ser responsabilidade
  do chamador (rota de API que ainda não foi escrita); esta tarefa cobre apenas o
  motor de domínio puro, não a integração com `availability-lookup.ts` nem com a rota
  pública/painel — isso é o próximo passo natural quando a UI (NEX-217/218) precisar
  de consumir isto.

## Estado

`[~]` parcial — domínio puro implementado e testado de forma real; falta a
integração na API/rota que efetivamente usa `busy` mesclado de várias fontes e
que classifica o erro 23P01 devolvido pelo Postgres.
