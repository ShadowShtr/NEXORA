# NEX-133 — Exportar Excel

## Implementação

- `src/features/finance/transactions-lookup.ts` (novo): `loadFinanceTransactions` — extraído da rota de CSV (`NEX-132`), agora partilhado por todos os formatos de exportação (CSV, Excel, e futuramente PDF) para nunca resolverem uma lista de transações diferente para o mesmo período. `FinanceTransactionRow` também vive aqui agora (movido de `csv-export.ts`).
- `src/features/finance/domain/formula-injection-guard.ts` (novo): `guardFormulaInjection`, extraído de `csv-export.ts` — a mesma proteção contra fórmulas maliciosas (`=`, `+`, `-`, `@`, tab) aplicada aos nomes de cliente/descrições de serviço, partilhada entre CSV e Excel.
- `src/features/finance/domain/xlsx-export.ts` (novo): `buildFinanceWorkbook` (usa `exceljs`, nova dependência — não há forma de gerar um `.xlsx` real sem uma biblioteca) — mesmas colunas do CSV, cabeçalho a negrito, e uma **linha de totais a negrito** no fim (soma de Valor/Extras/Desconto) — o critério de aceite "workbook legível e totais". Colunas de moeda com formato numérico real (`#,##0.00`), não texto.
- `src/app/api/financeiro/export-excel/route.ts` (novo): mesma forma da rota de CSV — `GET`, `requireProfile()`, período resolvido de `resolvePeriod`.
- `src/app/(dashboard)/dashboard/financeiro/page.tsx`: novo link "Exportar Excel", ao lado do "Exportar CSV".

## Testes

- `tests/unit/xlsx-export.test.ts` (novo, 6/6 ✅) — cobre o teste obrigatório desta tarefa:
  - **Reconciliação**: o workbook gerado é escrito para um buffer real e recarregado como um novo workbook (não inspeciona o modelo em memória do builder) — soma independentemente os valores das linhas de dados efetivamente escritas no ficheiro e confirma que batem certo com a linha de totais, célula a célula, incluindo os valores exatos esperados (67.50/3.50/6.00 EUR para o caso de 3 transações).
  - Cabeçalho a negrito com as colunas certas; uma linha por transação com os valores certos; linha de totais a negrito; proteção contra fórmula num nome de cliente.
- `npm run verify` (format, lint, typecheck, 386 testes, build) — ✅.
- UI não testada num browser real (mesma limitação já registada nas tarefas anteriores desta sessão).

## Resultado

A dona pode exportar as mesmas transações do período visível no dashboard financeiro para um workbook Excel real, com totais já calculados, sem precisar de os somar manualmente.

## Riscos residuais

`npm audit` sinaliza uma vulnerabilidade moderada transitiva (`uuid <11.1.1`) via `exceljs`, usada internamente só para nomear partes do ficheiro `.xlsx`, sem uso criptográfico/de segurança nesta aplicação — risco residual baixo. A rever quando o `exceljs` publicar uma versão sem essa dependência.

## Próxima tarefa desbloqueada

NEX-134 — Exportar PDF (depende de NEX-131, já concluída — não bloqueada por esta tarefa, mas relacionada).
