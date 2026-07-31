# Correção do motor de disponibilidade — vaga de "hoje" fora da grelha (R13)

## Contexto

Ao escrever o E2E completo da criação manual (`NEX-205`), foi encontrado um
bug real em `generateTimezoneAwareSlots`
(`src/features/appointments/domain/availability.ts`, `NEX-061`): quando é
`min_notice_hours` (não o horário de abertura do negócio) que decide o
início da janela de um dia — o caso normal para "hoje", sempre que ainda
faltam horas de expediente — a primeira vaga desse dia ficava ancorada ao
milissegundo exato em que `Date.now()` foi chamado, sem arredondar à grelha
de `slot_interval_minutes`. Efeito confirmado: a verificação de conflitos de
recorrência (`NEX-121`) mostrava falsos "Este horário já está ocupado." em
todas as ocorrências de uma série cuja primeira marcação caísse em "hoje",
porque duas chamadas separadas a `computeAvailableSlotsMs` (a inicial e a de
verificação de conflitos, momentos depois) quase nunca produziam o mesmo
valor exato em milissegundos. Documentado inicialmente como risco `R13` em
`docs/10_RISK_REGISTER.md`, não corrigido no momento por alterar o motor
partilhado por todos os fluxos de marcação (pública, manual, recorrência,
resumo de horários livres) — um raio de impacto que pareceu maior do que a
tarefa `NEX-205` (corrigir specs E2E) justificava tocar sem revisão própria.

Corrigido nesta sessão a pedido explícito do dono.

## Correção

Em `generateTimezoneAwareSlots`, o cálculo do início da janela de cada
intervalo aberto passou de:

```ts
const windowStartMs = Math.max(interval.startMs, earliestMs);
```

para:

```ts
const stepMs = slotStepMinutes * 60_000;
const rawStartMs = Math.max(interval.startMs, earliestMs);
const stepsFromIntervalStart = Math.ceil((rawStartMs - interval.startMs) / stepMs);
const windowStartMs = interval.startMs + stepsFromIntervalStart * stepMs;
```

Efeito:

- **Sem alteração** para qualquer dia cuja janela já era decidida pelo
  horário de abertura (`interval.startMs >= earliestMs`) — `stepsFromIntervalStart`
  dá `0`, `windowStartMs` fica exatamente igual a `interval.startMs`, tal
  como antes. É o caso da maioria dos dias (todos os que não são "hoje", e
  "hoje" sempre que já passou tempo suficiente de expediente).
- **Corrigido** para o caso em que `earliestMs` decide a janela: em vez de
  começar exatamente em `earliestMs` (um valor que flutua com o milissegundo
  exato de `Date.now()`), a janela passa a começar na primeira marca da
  grelha de `slotStepMinutes` **a partir do horário de abertura** que seja
  `>= earliestMs` — a mesma grelha que qualquer outro dia já usa. Duas
  chamadas com `nowMs` diferente por poucos segundos ou minutos (sem
  atravessar uma marca de grelha) produzem agora exatamente o mesmo
  resultado.

## Testes

Dois testes unitários novos em `tests/unit/timezone-aware-slots.test.ts`:

1. Confirma que um `earliestMs` fora da grelha (`11:07 UTC`, não múltiplo de
   30 min a partir da abertura às `09:00 UTC`) é arredondado para cima até
   à marca seguinte (`11:30 UTC`), não fica em `11:07`.
2. Confirma que duas chamadas com `nowMs` diferente por 45 segundos, ambas
   ainda antes da próxima marca de grelha, produzem exatamente a mesma
   primeira vaga.

Os 10 testes já existentes de `generateTimezoneAwareSlots` continuam a
passar sem alteração (comportamento inalterado fora do caso corrigido).

O E2E de recorrência de `NEX-205`
(`tests/e2e/manual-booking-wizard-complete.spec.ts`) foi simplificado para
usar diretamente o horário de "hoje" (removido o contorno de navegar para o
mês seguinte) — corrido 3 vezes seguidas contra o Supabase de dev/preview
real, estável (uma falha isolada foi um timeout de login por recompilação a
frio do servidor de dev a seguir à alteração de ficheiro, não relacionada
com a correção — confirmado ao repetir imediatamente a seguir).

Também corrigida, ao correr a suite mais larga de E2E para confirmar
ausência de regressão no motor partilhado: `agenda-free-slots.spec.ts` tinha
uma asserção já desatualizada (`'0 horários livres neste período'`), que
nunca podia ter passado — o componente (`src/app/(dashboard)/dashboard/agenda/page.tsx`)
mostra sempre `'Agenda completa neste período'` para zero vagas livres, não
essa string. Não relacionado com esta correção — encontrado ao validar,
corrigido pela mesma razão que `NEX-204` corrigiu specs semelhantes.

Suite completa corrida para confirmar zero regressão no motor partilhado:

- `npx vitest run` — 536/536 (12/12 em `timezone-aware-slots.test.ts`, incl. os 2 novos).
- `tests/integration/public-availability.test.ts`, `availability-blocks-impact.test.ts` — sem regressão.
- `tests/e2e/agenda-free-slots.spec.ts`, `public-cart-bar.spec.ts` — sem regressão (após a correção da asserção desatualizada acima).
- `tests/e2e/manual-booking-wizard-complete.spec.ts` — estável, 3 corridas.
- `npm run verify` completo — verde.

## Definition of Done

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada (`docs/10_RISK_REGISTER.md` R13 marcado corrigido)
- [x] Critérios de aceite validados
- [x] Sem regressão confirmada na suite partilhada
