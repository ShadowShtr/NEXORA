# NEX-034 — Passo regras recomendadas

## Implementação

- `src/features/onboarding/domain/rules-step.ts`: define os conjuntos de valores permitidos para cada regra (`SLOT_INTERVAL_OPTIONS`, `BUFFER_MINUTES_OPTIONS`, `MIN_NOTICE_HOURS_OPTIONS`, `BOOKING_WINDOW_DAYS_OPTIONS`, `CANCELLATION_NOTICE_HOURS_OPTIONS`), a constante `RECOMMENDED_RULES` (alinhada 1:1 com os defaults das colunas de `business_settings` em `0001_initial.sql`, aplicados automaticamente desde NEX-013) e `rulesStepSchema` (Zod, cada campo validado via helper `oneOf()` contra o conjunto exato permitido — rejeita qualquer número fora do conjunto, mesmo que seja um número válido, e rejeita valores não numéricos).
- `src/features/onboarding/RulesStep.tsx`: componente client com 5 `<select>` (inputs não controlados, via `ref`, seguindo a convenção já usada nos passos anteriores), botão "Usar recomendações" (`type="button"`) que repõe os 5 selects para `RECOMMENDED_RULES` no cliente sem submeter o formulário, e navegação Voltar/Seguinte via `formAction`.
- `src/features/onboarding/actions.ts`: nova action `submitRulesStep`, valida com `rulesStepSchema`, atualiza `business_settings` (`slot_interval_minutes`, `buffer_minutes`, `min_notice_hours`, `booking_window_days`, `cancellation_notice_hours`) e avança `onboarding_step`.
- `src/app/(onboarding)/onboarding/page.tsx`: novo ramo `step === 4` a renderizar `<RulesStep>`, com `initialValues` a partir das colunas existentes em `business_settings`, com fallback para `RECOMMENDED_RULES` quando ainda não definidas.
- `src/app/globals.css`: `select` adicionado ao bloco de estilo partilhado `input, select` e à regra `font: inherit`.

## Testes

- `tests/unit/rules-step.test.ts` (4/4 ✅): aceita os defaults recomendados; aceita cada valor permitido de cada campo; rejeita valor fora do conjunto mesmo sendo numérico; rejeita valor não numérico (defesa contra submissão adulterada).
- `tests/e2e/onboarding-rules-step.spec.ts` (5/5 ✅ em `chromium` e `webkit-mobile`):
  - Axe: 0 violações.
  - Carrega pré-preenchido com os valores recomendados.
  - Editar valores e submeter persiste corretamente em `business_settings` (verificado via `user.admin`, service role).
  - **"Usar recomendações" repõe campos editados com um único toque**, sem submeter o formulário — critério de aceite central da tarefa.
  - "Voltar" regressa ao passo 3.
- `tests/e2e/support/onboarding.ts`: adicionado helper `completeRulesStep(page)`.
- `npm run format:write`, `npm run lint`, `npm run typecheck`, `npm run verify` — todos ✅.

## Resultado

Passo 4/5 do onboarding funcional: defaults inteligentes pré-aplicados, edição livre, reposição num toque, validação server-side robusta contra adulteração do formulário (defesa em profundidade, já que o `<select>` nativo já restringe no cliente).

## Riscos residuais

- Nenhum identificado. Execução isolada dos testes (não a suite completa de ~64 testes E2E) para evitar o rate-limit transitório do Supabase Auth já documentado em NEX-033 — risco de infraestrutura conhecido, não defeito do produto.

## Próxima tarefa desbloqueada

NEX-035 — Passo publicar link e QR Code (depende de NEX-031, NEX-033, NEX-034 — todas concluídas).
