# NEX-144 — Ajuda contextual curta

## Implementação

- **Componente reutilizável `HelpTip`** (`src/components/ui/HelpTip.tsx`) — generaliza o padrão já existente em `RevenueInfoButton` (NEX-130, dashboard financeiro): um ícone "?" (`HelpCircle`), fechado por defeito, que ao ser clicado revela um popover com uma frase curta e volta a fechar num segundo clique. Sem passos, sem tour obrigatório, sem estado persistido — cumpre literalmente o critério de aceite "Explicação sob demanda, sem tour obrigatório".
  - Correção aplicada durante a implementação: como o botão fica dentro de um `<label>` que também envolve o `<select>` associado, um clique no botão seria reencaminhado pelo browser para o `<select>` (comportamento padrão de `<label>`: qualquer clique que não seja no próprio controlo é reencaminhado para ele). Corrigido com `event.stopPropagation()` no `onClick` do botão — sem isso, tocar no "?" também abriria o dropdown do campo ao lado.
- **Aplicado aos 5 campos técnicos de `BookingRulesForm`** (`src/features/settings/BookingRulesForm.tsx`): "Intervalo da agenda", "Intervalo entre clientes", "Antecedência mínima para marcar", "Janela de marcação no futuro", "Aviso mínimo para cancelar". Estes são os únicos rótulos de definições sem nenhuma explicação já visível na aplicação — nem na página de definições (NEX-141) nem no wizard de onboarding (NEX-034) — ao contrário de `NoShowPolicyForm` e `ReminderTemplateForm`, que já têm texto de apoio sempre visível (`text-support`). Por isso não foi necessário nem justificado tocar nesses outros formulários.
- **CSS partilhado** (`src/app/globals.css`): `.help-tip-wrapper/-button/-popover` (visual idêntico ao `.revenue-info-*` já existente, generalizado para reutilização) e `.field-label-row` (rótulo + ícone lado a lado dentro do `<label>` existente, sem alterar o grid vertical rótulo/campo já usado em todo o formulário).

## Testes

- `tests/e2e/settings-contextual-help.spec.ts` (novo) — cobre o teste obrigatório desta tarefa ("Usabilidade"): confirma que o texto de ajuda está escondido por defeito, que um clique no "?" revela o texto e um segundo clique esconde, que o `<select>` ao lado não recebe foco/abre com esse clique (a regressão que o `stopPropagation` corrige), e que os 5 ícones de ajuda estão presentes no formulário de regras da agenda.
- **Nota**: tal como os restantes specs E2E deste repositório, não corre no CI atual (sem job de Playwright configurado) — mesma limitação já registada em `NEX-140`/`NEX-141`/`NEX-143`.
- `npm run verify` (format, lint, typecheck, 399 testes, build) — ✅.
- UI não testada num browser real (mesma limitação já registada nas tarefas anteriores desta sessão).

## Resultado

`BookingRulesForm` passa a explicar os seus 5 termos técnicos sob demanda, sem adicionar ruído visual permanente ao formulário nem exigir um tour. O componente `HelpTip` fica disponível para reutilização em qualquer outro rótulo técnico futuro.

## Riscos residuais

Nenhum novo. `RevenueInfoButton` (NEX-130) não foi refatorado para usar `HelpTip` — já está testado e em produção; refatorá-lo sem necessidade expandiria o escopo desta tarefa.

## Próxima tarefa desbloqueada

Nenhuma dependente direta dentro do EPIC-14 (que fica assim concluído, com `NEX-142` deliberadamente por fazer, por decisão da dona). Próximo épico não iniciado: EPIC-15 — PWA, design e acessibilidade (`NEX-150`, depende de `NEX-023`, já concluída).
