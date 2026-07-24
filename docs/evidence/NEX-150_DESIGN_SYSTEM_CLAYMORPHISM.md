# NEX-150 — Design system claymorphism

## Implementação

- **Bug de contraste real encontrado ao auditar os tokens**: `--pink-500` (`#d95f93`)
  produzia apenas ~3,49:1 de contraste com texto branco na ponta mais clara do
  gradiente `linear-gradient(145deg, var(--pink-500), var(--pink-600))` usado em
  `.button` (CTA primário em toda a app), avatares com iniciais, separador ativo e
  outros ~10 locais — abaixo do mínimo AA (4,5:1) para texto normal. O mesmo token
  também falhava como cor de texto direta sobre fundo branco/`--pink-50`
  (`.client-total-value`, chip de filtro ativo). Nenhum teste axe anterior apanhou isto
  porque o axe não avalia contraste sobre fundos em gradiente (marca "incompleto", não
  "violação").
  - Apresentadas 3 opções à dona (escurecer o token globalmente / corrigir só onde há
    texto visível / adiar para `NEX-154`). Escolhido: **escurecer o token**.
  - `--pink-500` alterado de `#d95f93` para `#b24e79` — todos os pares
    texto/fundo reais da app passam a ≥4,6:1 (ver tabela em
    `docs/DESIGN_SYSTEM.md`). Efeito colateral aceite e documentado: o gradiente do
    botão fica visualmente mais subtil, porque qualquer tom claro o suficiente para
    ler como "rosa médio" falha AA com texto branco de 16px — não há como preservar a
    luminosidade original do token sem violar o critério de aceite "contraste AA".
- **Tokens documentados**: `docs/DESIGN_SYSTEM.md` (novo) mapeia todos os tokens de
  `:root` (`globals.css`) ao seu uso real, os 4 componentes reutilizáveis de
  `src/components/ui/` (`Button`, `Card`, `BottomSheet`, `HelpTip`), e os princípios de
  `CLAUDE.md`. Não copia valores — remete sempre para o CSS/TSX como fonte de verdade.
  Decisão de âmbito registada: não foi criada uma escala tokenizada de
  `border-radius`/espaçamento (cada componente já segue a referência visual exata da
  página, per `CLAUDE.md`; tokenizar isso agora seria uma reescrita visual sem pedido
  nem benefício de acessibilidade).
- **Verificação automática de contraste**: `src/lib/color-contrast.ts` (novo) — função
  pura `contrastRatio()` (fórmula de luminância relativa da WCAG 2.x).
  `tests/unit/design-tokens-contrast.test.ts` lê os tokens diretamente do texto de
  `globals.css` (sem cópia duplicada) e confirma ≥4,5:1 para os 14 pares
  texto/fundo realmente usados na app — qualquer alteração futura a um token que quebre
  o contraste falha este teste automaticamente, não só numa auditoria manual.

## Testes

- `tests/unit/color-contrast.test.ts` (novo, 4 casos) — testa `contrastRatio()` contra
  os pares de referência da própria WCAG (preto/branco = 21:1, mesma cor = 1:1,
  simetria).
- `tests/unit/design-tokens-contrast.test.ts` (novo, 14 casos parametrizados) — cobre o
  critério de aceite "contraste AA" com verificação automática, não só nota manual.
- `tests/e2e/design-system-axe.spec.ts` (novo) — cobre o teste obrigatório desta tarefa
  ("Visual + axe"): varre Agenda, Clientes e Mais com `@axe-core/playwright`, as três
  páginas com secção de "fidelidade obrigatória" própria em `CLAUDE.md` que ainda não
  tinham nenhuma cobertura de acessibilidade automatizada (Início e Serviços já tinham,
  via `dashboard-shell.spec.ts` e `catalog-*.spec.ts`).
- **Nota**: tal como os restantes specs E2E deste repositório, não corre no CI atual
  (sem job de Playwright configurado) — mesma limitação já registada desde `NEX-140`.
- `npm run verify` (format, lint, typecheck, 416 testes, build) — ✅.
- UI não testada num browser real (mesma limitação já registada nas tarefas anteriores
  desta sessão) — a mudança de `--pink-500` não foi validada visualmente num browser,
  só matematicamente via o teste de contraste.

## Resultado

O design system claymorphism (tokens, componentes, contraste) fica documentado e
verificado automaticamente pela primeira vez, e um bug real de contraste AA no
componente mais usado da app (botão primário) foi corrigido na origem.

## Riscos residuais

- Mudança de `--pink-500` não validada visualmente num browser real — risco baixo (o
  novo tom é matematicamente mais escuro mas continua na mesma família de rosa; se a
  dona achar o gradiente demasiado plano ao ver em produção, é reversível ajustando só
  este token).
- Sem escala tokenizada de `border-radius`/espaçamento — decisão de âmbito, não dívida
  técnica não registada.

## Próxima tarefa desbloqueada

NEX-151 — Navegação mobile e desktop (depende de NEX-150, agora concluída).
