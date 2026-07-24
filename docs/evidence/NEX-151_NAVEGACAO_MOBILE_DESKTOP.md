# NEX-151 — Navegação mobile e desktop

## Implementação

- **Inconsistência real encontrada entre bottom nav e sidebar**: o estado ativo da
  bottom nav (`.mobile-nav-item[aria-current='page']`, texto + ponto indicador) usava
  uma cor `#ed3f79` fora da escala de tokens, enquanto a sidebar desktop
  (`.desktop-nav a[aria-current='page']`) já usava `var(--pink-600)`. Além de não
  coerentes entre si (critério de aceite desta tarefa), `#ed3f79` só tinha 3,76:1 de
  contraste sobre fundo branco — abaixo do mínimo AA (4,5:1) para o texto de 10px a
  negrito da aba ativa. Corrigido para `var(--pink-600)` nos dois locais (texto e
  ponto), que já cumpre AA (5,0:1, confirmado em `NEX-150`) e alinha as duas
  navegações ao mesmo token.
  - `#ed3f79` aparece em mais ~15 locais de `globals.css`, fora do que é "navegação"
    (ex.: página Início, cartões de marcação). Não foi tocado — trocar uma cor usada em
    tantos sítios sem rever cada contexto individualmente expandiria o escopo desta
    tarefa para uma auditoria de cor app-wide; registado como risco residual.
- **Teste obsoleto corrigido**: `tests/e2e/dashboard-shell.spec.ts` (escrito em
  `NEX-023`) ainda testava um "Mais" como botão que abria um painel
  (`.mobile-nav-more`, `aria-expanded`) — comportamento substituído por uma página
  própria em `#70`, seguindo a regra obrigatória de `CLAUDE.md` ("Ao abrir Mais... a
  página anterior deve desaparecer... nunca um painel sobre a página anterior"). Como
  os specs E2E não correm no CI, esta divergência nunca foi apanhada. Corrigido para
  testar o comportamento real: `Link` direto para `/dashboard/mais`, sem painel, e
  `aria-current` da aba "Mais" a refletir corretamente visitas a qualquer sub-página
  (`Financeiro`, `Lembretes`, `Relatórios`, `Definições`).
- Sem outras mudanças de implementação — a estrutura de navegação em si
  (`src/features/shell/AppShell.tsx`) já estava coerente: mesmos 4 itens primários +
  "Mais"/"Gestão" em ambos os layouts, `aria-current`, `aria-label`, skip-link.

## Testes

- `tests/e2e/dashboard-shell.spec.ts` — testes do "Mais" reescritos (ver acima); os
  restantes (violações axe, nav correta por viewport, skip-link, `aria-current` em
  ambos os layouts) mantidos sem alteração, continuam válidos.
- `tests/e2e/navigation-breakpoints-keyboard.spec.ts` (novo) — cobre os dois testes
  obrigatórios desta tarefa:
  - **Breakpoints**: verifica o corte exato de `globals.css`
    (`@media (min-width: 761px)`) com `setViewportSize` a 760px e 761px, independente
    do viewport por omissão do projeto Playwright que corre o teste.
  - **Teclado**: foca um link da bottom nav (mobile) ou da sidebar (desktop) e confirma
    que `Enter` navega; testa também um link da secção "Gestão" da sidebar (desktop).
- **Nota**: tal como os restantes specs E2E deste repositório, não corre no CI atual
  (sem job de Playwright configurado) — mesma limitação já registada desde `NEX-140`.
  Não foi possível correr localmente por falta de Docker/WSL2 (`ADR-007`) — revisão só
  por leitura cuidada do código real de `AppShell.tsx`/`globals.css` contra cada
  asserção.
- `npm run verify` (format, lint, typecheck, 416 testes, build) — ✅.

## Resultado

Bottom nav e sidebar usam agora o mesmo token de cor no estado ativo (coerentes e AA),
e a suite de testes da navegação deixa de afirmar um comportamento que não existe há
várias tarefas. Cobertura nova de breakpoint exato e operabilidade por teclado.

## Riscos residuais

- `#ed3f79` continua a existir em ~15 locais de `globals.css` fora do âmbito de
  navegação, alguns dos quais podem ter o mesmo problema de contraste — candidato a
  `NEX-154` (auditoria WCAG dedicada).
- Testes E2E novos/corrigidos não foram executados (sem Docker/WSL2 local, sem job de
  Playwright no CI) — verificados só por leitura cuidada do código real.

## Próxima tarefa desbloqueada

NEX-152 — Manifest e instalação PWA (depende de NEX-150, já concluída — não bloqueada
por esta tarefa, mas relacionada).
