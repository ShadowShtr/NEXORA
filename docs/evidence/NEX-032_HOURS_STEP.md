# Evidência — NEX-032 Passo horários de trabalho

**Data:** 17 de julho de 2026
**Estado:** concluído

## Implementação

- `src/features/onboarding/domain/hours-step.ts`: `DEFAULT_HOURS` (dias úteis 09:00–19:00 com almoço 13:00–14:00, sábado 09:00–13:00 sem almoço, domingo fechado); `hoursStepSchema` (Zod, `superRefine` por dia: hora de fim depois da de início, almoço só válido com ambos os limites presentes e coerentes); `mergeHoursWithDefaults` (junta linhas guardadas com os defaults, truncando `HH:MM:SS` do Postgres para `HH:MM` do `<input type="time">`); `parseHoursFormData` (desserializa os 7×4 campos do formulário).
- `src/features/onboarding/actions.ts` → `submitHoursStep`: valida, faz `upsert` das 7 linhas em `business_hours` (`onConflict: tenant_id,day_of_week`) e avança o passo.
- `src/features/onboarding/HoursStep.tsx`: um `<fieldset>` por dia, checkbox "Aberto" mostra/esconde os campos de hora (estado local React); botão "Voltar" via `formAction` no próprio botão (não é possível aninhar `<form>` dentro do formulário principal, ao contrário do placeholder genérico de `NEX-030`).
- **Convenção documentada:** `day_of_week` segue `Date.getDay()` (0=domingo..6=sábado) — não estava especificada em lado nenhum; registada em `docs/04_DATA_MODEL.md` para as tarefas futuras de disponibilidade (`NEX-060`/`061`).

## Testes

**Unitários** (`tests/unit/hours-step.test.ts`, 10 testes): defaults recomendados válidos; fim antes/igual ao início rejeitado; dia fechado com campos vazios aceite independentemente do formato; só um limite de almoço preenchido rejeitado; fim de almoço antes do início rejeitado; dia aberto sem almoço nenhum aceite; limites `00:00`/`23:59` aceites; exige exatamente 7 dias; `mergeHoursWithDefaults` cai nos defaults quando não há linha guardada; trunca corretamente `HH:MM:SS`→`HH:MM`.

**E2E** (`tests/e2e/onboarding-hours-step.spec.ts`, 6 testes, `chromium` + `webkit-mobile`):

1. 0 violações Axe.
2. Ecrã carrega com os defaults corretos visíveis (segunda 09:00–19:00, domingo fechado).
3. Aceitar os defaults avança para o passo 3 **e** persiste as 7 linhas em `business_hours` (confirmado via `service_role`).
4. Hora de fim antes da de início → erro visível, permanece no passo 2.
5. Só um limite de almoço preenchido → erro visível.
6. "Voltar" funciona mesmo com dados inválidos no formulário (não valida ao recuar).

## Resultado

- `npm run verify`: aprovado.
- 51/52 testes E2E aprovados (1 skip esperado por design). 29 testes unitários no total do projeto.
- Próxima tarefa desbloqueada: `NEX-033`.
