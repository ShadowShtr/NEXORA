# NEX-054 — Criar carrinho fixo

## Implementação

- `src/app/b/[slug]/domain/booking-selection.ts`: novo `itemCountLabel(count)` (pluralização simples, "1 item" vs "N itens") — movido para o domínio puro em vez de viver dentro do componente, para ser testável sem montar React. Comentário acrescentado a `cartTotals` a documentar explicitamente por que nunca produz float (soma de inteiros — cêntimos/minutos — permanece inteiro; `CLAUDE.md`).
- `src/app/b/[slug]/PublicBookingCart.tsx`: o conteúdo (registo, categorias, pacotes, resumo "Passo 3 · Confirmar") passa a viver dentro de `<div className="public-booking-content">`, e uma nova barra (`<div className="public-cart-bar">`) fica fora dessa `div`, como irmã — sempre visível, independente do scroll (PRD 01 §3.6: "Barra fixa mostra quantidade, duração e valor do carrinho"). Mostra `{itemCountLabel(lines.length)} · {totalMinutes} min · {formatEuros(totalCents)}` num `<span role="status">` (anuncia a mudança a leitores de ecrã) e um botão "Continuar" — desativado com o carrinho vazio, e que faz `scrollIntoView` até ao cartão "Passo 3 · Confirmar" (agora com `id="confirmar"`) em vez de inventar um passo novo que ainda não existe (escolha de dia/hora depende do motor de disponibilidade, `EPIC-06`).
- `src/app/globals.css`: `.public-cart-bar` (`position: fixed`, `bottom: 0`, `env(safe-area-inset-bottom)` para não ficar por baixo da barra de gestos do iOS), `.public-cart-bar-summary`, `.public-booking-content` (`padding-bottom` para o conteúdo não ficar escondido atrás da barra fixa).

## Testes

- `tests/unit/booking-selection.test.ts` (+4 testes, agora 16/16 ✅): `itemCountLabel` — "0 itens", "1 item", "N itens"; novo teste explícito "nunca produz um total não inteiro" (`Number.isInteger`) com preços/durações "ímpares" nos cêntimos, formalizando o critério "sem float" como regressão automatizada em vez de uma propriedade só implícita.
- `tests/e2e/public-cart-bar.spec.ts` (novo, 4/4 ✅ em `chromium` e `webkit-mobile`): sem overflow horizontal num viewport estreito com a barra visível (mesmo padrão de `catalog-mobile-layout.spec.ts`, `NEX-044`); quantidade/duração/total atualizam ao vivo e "Continuar" fica desativado com o carrinho vazio; a barra mantém a mesma posição no viewport ao fazer scroll da página (prova real de `position: fixed`, não só "cabe tudo no ecrã"); "Continuar" leva mesmo o cartão de confirmação (e o link do WhatsApp lá dentro) para dentro do viewport.
- Regressão completa da página pública (NEX-050/051/052/053) — 54/54 ✅ em `chromium` e `webkit-mobile` nesta ronda, incluindo `catalog-mobile-layout` (NEX-044).
- `npm run verify` — ✅ (format, lint, typecheck, `vitest run` — 120 testes passados, `next build`).

## Nota de correção durante os testes

O teste inicial de "a barra mantém-se fixa ao fazer scroll" usava `page.mouse.wheel(0, 600)`, que falha em WebKit móvel ("Mouse wheel is not supported in mobile WebKit"). Substituído por `page.evaluate(() => window.scrollBy(0, 600))`, que funciona de forma idêntica em todos os motores/projetos.

## Resultado

O visitante já não precisa de percorrer a página até ao fim para saber quantos itens escolheu, quanto tempo e quanto vai pagar — essa informação fica sempre visível numa barra fixa, com um "Continuar" que o leva diretamente à confirmação. `docs/02_UX_FLOWS.md` (`NEX-053`) já referenciava esta tarefa; sem alterações adicionais necessárias aí.

## Riscos residuais

Nenhum identificado.

## Próxima tarefa desbloqueada

EPIC-05 concluído (NEX-050 a NEX-054). Próxima tarefa não bloqueada nesta epic — seguir para `EPIC-06` (motor de disponibilidade) por ordem de `TASKS.md`.
