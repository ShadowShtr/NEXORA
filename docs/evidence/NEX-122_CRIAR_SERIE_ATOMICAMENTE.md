# NEX-122 — Criar série atomicamente

## Implementação

- `supabase/migrations/0032_create_recurring_series.sql` (novo): `create_recurring_series`, RPC `security definer` que insere a linha `recurring_series` (tabela já existente desde `0001_initial.sql`, nunca usada até agora) e uma marcação por ocorrência, tudo dentro da mesma invocação — Postgres executa o corpo da função como uma única transação, por isso uma exceção não tratada em qualquer ocorrência (o caso mais comum: `appointments_no_overlap`, `23P01`, a mesma exclusion constraint de qualquer outra marcação) aborta a chamada inteira, revertendo a série e todas as marcações já inseridas nesse loop. Nenhuma lógica de rollback explícita — é o comportamento transacional normal do Postgres, só que agora deliberadamente aproveitado para uma escrita multi-linha.
  - `p_occurrence_starts_at` é tratado como já resolvido: quem gera as datas candidatas é `generateRecurrenceOccurrences` (NEX-120) e quem deteta conflitos é `checkRecurrenceConflicts` (NEX-121), ambos no cliente — esta função nunca recalcula datas a partir de `p_frequency`/`p_interval_value`; esses dois só ficam guardados em `recurring_series` como metadados descritivos (para exibição/edição futura, `NEX-123`). `appointments_no_overlap` continua a apanhar qualquer sobreposição não vista antes (incluindo ocorrências a sobreporem-se entre si).
  - Resolução de cliente, preço/duração de serviços/pacote e a forma de `appointments`/`appointment_items`/`reminders` por ocorrência espelham `create_manual_booking` (`0028_fix_create_manual_booking_insert_order.sql`) exactamente — mesma ordem validar-depois-escrever, aplicada em loop. Um único `audit_logs` ao nível da série (não um por marcação) para não gerar até 52 linhas quase idênticas por uma ação da dona.
- `src/features/appointments/recurring-series-actions.ts` (novo): `createRecurringSeries`, liga a RPC ao formulário — mesma validação de contacto de cliente novo que `createManualBooking` (`clientContactSchema`), `23P01` mapeado para `SLOT_TAKEN` com mensagem a pedir para rever os conflitos.
- `src/features/appointments/ManualBookingForm.tsx`: estende o formulário existente de marcação manual (não cria um ecrã novo) com uma secção "Repetição" — checkbox + frequência + número de marcações (+ intervalo personalizado quando aplicável). Ativar a recorrência troca o botão final por "Rever ocorrências": gera as datas candidatas no cliente (`generateRecurrenceOccurrences`, sem pedido ao servidor — função pura), verifica-as contra a disponibilidade real (`checkRecurrenceConflicts`) e muda para um passo de revisão — um segundo formulário, separado, com um item por ocorrência mostrando conflito (se houver) e até 3 alternativas mais próximas para escolher, ou um botão para remover essa ocorrência da série. "Confirmar" só fica ativo com pelo menos 2 ocorrências e nenhum conflito por resolver; submete para `createRecurringSeries`.
- `src/app/globals.css`: `.recurrence-occurrence-removed` (risco visual para uma ocorrência removida da revisão).

## Testes

- `tests/integration/create-recurring-series.test.ts` (novo, 7/7 ✅): anon bloqueado (`42501`); menos de 2 ocorrências rejeitado; frequência inválida rejeitada; `interval_value` fora de 1-52 rejeitado; cliente doutro tenant rejeitado; criação completa (série + 4 marcações + itens + lembretes + auditoria única, tudo verificado); **rollback**: uma marcação já existente a sobrepor-se à 3ª ocorrência faz a RPC falhar com `23P01` e confirma, por contagem antes/depois, que **nenhuma** `recurring_series` nem marcação nova sobrevive — nem sequer as ocorrências 1 e 2, que teriam sido inseridas com sucesso antes da 3ª falhar.
- `npm run verify` (format, lint, typecheck, 359 testes, build) — ✅.
- **UI não testada num browser real** — este projeto não tem staging Supabase separado (sem Docker/WSL2 nesta máquina, `ADR-007`); tanto `npm run dev` local como os deploys de preview do Vercel apontam para o mesmo projeto Supabase de produção (confirmado via `vercel env ls`), por isso testar o fluxo manualmente criaria dados reais. Validado por typecheck + lint + build (que teria falhado com props/tipos errados) e revisão cuidadosa do JSX; recomendo à dona experimentar no preview do PR antes de mesclar.

## Resultado

Fluxo completo de criação de série recorrente, integrado no formulário de marcação manual já existente em vez de um ecrã novo — cliente, serviços, primeira data e recorrência escolhidos num único sítio, com revisão de conflitos antes de confirmar. Nenhuma série parcial: ou tudo é criado, ou nada é.

## Riscos residuais

- Unidade de `customIntervalDays`/`interval_value` para `frequency='custom'` (dias) — decisão já registada em `NEX-120`, agora também persistida em `recurring_series.interval_value`. Confirmar com a dona se corresponde ao que ela espera ao usar "intervalo personalizado" pela primeira vez.
- UI não validada num browser real (ver secção de Testes acima) — só verificação estática (types/lint/build).

## Próxima tarefa desbloqueada

NEX-123 — Editar escopo da série (depende de NEX-122, concluída).
