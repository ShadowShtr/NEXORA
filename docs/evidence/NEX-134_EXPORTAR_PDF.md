# NEX-134 — Exportar PDF

## Implementação

- `src/features/finance/domain/pdf-layout.ts` (novo): `computeFinancePdfLayout`, função pura sem I/O — calcula a página e a posição Y de cada linha (dados + totais), com altura de linha fixa (sem _word-wrap_ por célula: texto longo é truncado com reticências em vez de quebrar linha, ver `pdf-export.ts`) — é essa altura fixa que torna a posição de cada linha exatamente previsível e garante, por construção, que nunca há sobreposição. Quando uma página enche, as linhas seguintes passam para a próxima; a linha de totais só avança de página se não couber a seguir à última linha de dados.
- `src/features/finance/domain/pdf-export.ts` (novo): `buildFinancePdf` (usa `pdfkit`, nova dependência — não há forma de gerar um `.pdf` real sem uma biblioteca). A4 retrato, 5 colunas (Data/Cliente/Serviços/Método/Valor) — Extras/Desconto ficam resumidos numa linha de totais em vez de colunas próprias, para manter cada coluna suficientemente larga sem quebra de texto. Trunca texto longo com reticências, medido com `doc.widthOfString()` (medição real, não uma contagem de carateres aproximada).
- `src/app/api/financeiro/export-pdf/route.ts` (novo): mesma forma das rotas de CSV/Excel.
- `src/app/(dashboard)/dashboard/financeiro/page.tsx`: novo link "Exportar PDF".

## Testes

- **"Testes obrigatórios: Visual regression"** — este projeto não tem infraestrutura de comparação visual pixel a pixel (sem Percy/Chromatic/screenshots do Playwright). Interpretação pragmática, documentada aqui: testar o **invariante de layout** que uma suite de visual regression estaria, no fundo, a proteger — nenhuma linha sobrepõe outra, nada ultrapassa a margem inferior da página — como função pura totalmente testável, separada das chamadas de desenho do `pdfkit`.
  - `tests/unit/pdf-layout.test.ts` (novo, 6/6 ✅): tudo numa página quando cabe; sem sobreposições e todas as linhas dentro da página para 200 linhas; transição para nova página a meio; linha de totais empurrada para página própria quando a página de dados fica exatamente cheia; caso de zero linhas; `rowHeight` inválido rejeitado.
  - `tests/unit/pdf-export.test.ts` (novo, 4/4 ✅): PDF bem formado (assinatura `%PDF-`); zero linhas não rebenta; nome de cliente/descrição muito longos não rebentam (truncados, não quebrados); 120 linhas geram várias páginas sem rebentar.
- `npm run verify` (format, lint, typecheck, 396 testes, build) — ✅.
- UI não testada num browser real (mesma limitação já registada nas tarefas anteriores desta sessão).

## Resultado

A dona pode exportar um resumo em PDF, pronto a imprimir, das transações do período visível no dashboard financeiro, com totais no fim — sem risco de texto sobreposto mesmo com muitas transações ou nomes longos.

## Riscos residuais

- Sem infraestrutura de visual regression real neste projeto — a validação de layout é por invariante testado, não por comparação de imagem. Se no futuro se justificar (ex.: layouts mais complexos), avaliar Playwright screenshot testing.
- Texto muito longo é truncado, não seguido por wrap — decisão deliberada para manter a garantia de não-sobreposição simples e comprovável; o CSV/Excel já têm o texto completo sem truncar.

## Próxima tarefa desbloqueada

NEX-135 — Regras de retenção/exportação (depende de NEX-132, NEX-133 e NEX-134 — as três já concluídas).
