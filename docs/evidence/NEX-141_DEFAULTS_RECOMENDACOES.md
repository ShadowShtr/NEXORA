# NEX-141 — Defaults e "usar recomendações"

## Implementação

- `src/features/settings/booking-rules-actions.ts` (novo): `updateBookingRules`, reutiliza `rulesStepSchema`/os conjuntos de opções válidas de `features/onboarding/domain/rules-step.ts` (NEX-034) — as mesmas 5 regras (intervalo da agenda, intervalo entre clientes, antecedência mínima, janela de marcação, aviso de cancelamento), agora editáveis depois do onboarding, não só uma vez. Sem tocar em `onboarding_step` (só relevante durante o assistente).
- `src/features/settings/BookingRulesForm.tsx` (novo): mesmos rótulos, opções e funções de formatação (`formatDays`/`formatHours`) do `RulesStep.tsx` do onboarding, para a linguagem se manter idêntica ("Configuração rápida sem termos técnicos").
  - **"Usar recomendações"**: preenche os 5 campos com `RECOMMENDED_RULES` (a mesma constante do onboarding).
  - **"Desfazer"**: só aparece depois de "Usar recomendações" ser clicado — guarda os valores de antes do reset e permite voltar a eles, tudo no lado do cliente, antes de "Guardar". Ao contrário do assistente (onde um reset indesejado se desfaz só saindo do passo), aqui não há "passo" para abandonar, por isso o desfazer é uma ação explícita.
- `src/app/(dashboard)/dashboard/definicoes/marcacoes/page.tsx`: novo cartão "Regras da agenda", antes de "Política de faltas".

## Testes

- `tests/e2e/booking-rules-reset.spec.ts` (novo) — cobre o teste obrigatório desta tarefa ("Reset/undo"): muda um valor manualmente, confirma que "Desfazer" não aparece antes de nenhum reset; clica "Usar recomendações" e confirma que os campos voltam ao valor recomendado; clica "Desfazer" e confirma que volta exatamente ao valor manual anterior (não ao original da base de dados); e um segundo teste confirma que "Guardar" persiste os valores através de um reload.
- **Nota**: tal como os restantes specs E2E deste repositório (incluindo `definicoes-hub.spec.ts`, NEX-140), não corre no CI atual (sem job de Playwright configurado) — mesma limitação de infraestrutura já registada, não uma lacuna nova.
- `npm run verify` (format, lint, typecheck, 399 testes, build) — ✅.
- UI não testada num browser real (mesma limitação já registada nas tarefas anteriores desta sessão).

## Resultado

A dona pode agora rever e ajustar as regras da agenda (que antes só se definiam uma vez, no onboarding) a partir de Definições → Marcações, com um botão para voltar rapidamente às recomendações e desfazer esse reset antes de guardar.

## Riscos residuais

Nenhum.

## Próxima tarefa desbloqueada

NEX-142 — Pré-visualização da página pública (depende de NEX-140, já concluída — não bloqueada por esta tarefa, mas relacionada).
