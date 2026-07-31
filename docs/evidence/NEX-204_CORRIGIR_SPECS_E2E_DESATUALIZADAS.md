# NEX-204 — Corrigir specs E2E não críticas desatualizadas

## Objetivo

Corrigir `appointment-completion-discount.spec.ts`, `appointment-completion-extras.spec.ts`
e `appointment-card.spec.ts` — identificadas em `NEX-178` como assumindo a UI inline
antiga (pré-redesenho da agenda para bottom sheet), o mesmo padrão já corrigido em
`appointment-completion.spec.ts` (NEX-110) nessa tarefa.

## Correções de seletor/estrutura (as 3 specs)

Todas as três assumiam que o formulário de conclusão expandia **dentro do próprio
cartão** (`card.getByRole(...)` para campos do formulário) e que a conclusão mostrava
o texto "Atendimento concluído." inline. Desde o redesenho (`CompletionSheet.tsx`), o
formulário abre num bottom sheet separado (`role="dialog"`, `aria-label` "Concluir
atendimento de {cliente}"), e o sucesso fecha o sheet em vez de mostrar texto — o
mesmo padrão já usado em `appointment-completion.spec.ts` foi replicado:

- `card = page.locator('.appointment-timeline-card')` (não `.appointment-card`, que já
  não existe como classe própria no cartão — só como prefixo de `.appointment-card-{status}`,
  que o seletor CSS `.appointment-card` **não** corresponde).
- `sheet = page.getByRole('dialog', { name: 'Concluir atendimento' })`; todas as
  interações do formulário passaram a usar `sheet.getByRole/getByLabel(...)`.
- Sucesso passou a ser `await expect(sheet).toBeHidden()`, não mais `getByText('Atendimento concluído.')`.

### `appointment-card.spec.ts` — reescrita mais profunda

Além do seletor, o teste original assumia **duas ações lado a lado** (WhatsApp +
Concluir) e um **total/estado sempre visíveis** no cartão — nenhum dos dois é
verdade no redesenho: só uma ação contextual aparece por linha (WhatsApp antes do
horário chegar, "Concluir" só depois — nunca ambas ao mesmo tempo), e o valor/estado
textual só renderiza para marcações inativas (canceladas/concluídas/faltou), não para
uma confirmada a decorrer. Dividido em dois testes (marcação futura → WhatsApp visível,
Concluir ausente; marcação já decorrida → Concluir visível, WhatsApp ausente) em vez de
um único teste com uma asserção que já não é verdadeira.

## Bug real encontrado ao correr os testes corrigidos (não um problema dos testes)

Ao correr `appointment-completion-discount.spec.ts` corrigido contra a app real, os
testes de desconto **fixo** falhavam com valores errados (`24.95` em vez de `20.00`
para um desconto de €5 sobre €25; `15.01` em vez de `0.00` para um desconto de €999) —
consistentemente **1/100 do valor esperado**. Investigação confirmou um bug real em
`AppointmentCompletionPanel.tsx`: tanto `currentDiscount()` como o cálculo duplicado em
`updateDiscount()` liam o campo "Valor (€)" do desconto fixo com `Number(input)` — ou
seja, tratavam "5.00" (5 euros) como o número `5` sem converter para cêntimos — antes
de passar a `computeDiscountCents`, que (confirmado em
`supabase/migrations/0017_complete_appointment_discount.sql`, a autoridade real:
`v_discount_cents := round(p_discount_value)`) **espera cêntimos** para o tipo `fixed`,
tal como a RPC e o próprio ficheiro `domain/discount.ts` já documentavam no comentário
("Discount.value" tratado como cêntimos). Na prática: uma dona a aplicar "desconto fixo
de €5" estaria a descontar apenas 5 cêntimos, não 5 euros — uma promessa de desconto ao
cliente silenciosamente quebrada.

Corrigido nos dois locais (`currentDiscount()` e `updateDiscount()`) usando o mesmo
`parseEurosToCents()` já usado para o campo "Valor final (€)", em vez de `Number()` cru.
O desconto percentual nunca teve este problema (é adimensional, `value` já é a
percentagem em ambos os lados). A suite de integração
`tests/integration/complete-appointment-discount.test.ts` testa a RPC diretamente
(bypassa o componente React) — por isso nunca teria apanhado este bug, que só existia
na camada de conversão euro→cêntimos do formulário; o teste unitário
`tests/unit/discount.test.ts` testa `domain/discount.ts` isoladamente, que estava
sempre correto (o bug era só na chamada, não na função). Confirma, mais uma vez, o
valor de o E2E correr de facto (o motivo desta própria tarefa existir).

## Testes obrigatórios

- Os 3 specs corrigidos a passar de forma estável contra a app real (Supabase de
  dev/preview, `supabase status`/`.env.local`): `appointment-card.spec.ts` (5/5),
  `appointment-completion-discount.spec.ts` (4/4), `appointment-completion-extras.spec.ts`
  (3/3).
- `appointment-completion.spec.ts` (`@critical`, NEX-110/178) corrido de novo para
  confirmar que a correção do bug de desconto não regrediu o fluxo principal (5/5).
- `tests/unit/discount.test.ts` (18/18) e `npm run verify` completo (ver fecho do lote).

## Definition of Done

- [x] Implementação concluída — 3 specs corrigidas + bug real de desconto fixo corrigido em `AppointmentCompletionPanel.tsx`
- [x] Testes concluídos — todos os specs relevantes a passar contra a app real
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
