# NEX-132 — Exportar CSV

## Implementação

- `src/features/finance/domain/csv-export.ts` (novo): `buildFinanceTransactionsCsv`, função pura sem I/O — gera o CSV completo (cabeçalho + linhas) a partir de uma lista de transações já resolvidas.
  - **UTF-8**: prefixo BOM (`U+FEFF`, via `String.fromCharCode`, nunca um carácter invisível literal na fonte) — sem ele o Excel no Windows assume a codepage do sistema em vez de UTF-8 e estraga acentos em nomes de clientes e nos cabeçalhos ("Método", "EUR").
  - **Colunas documentadas**: comentário no topo do ficheiro lista as 7 colunas e o significado exato de cada uma (Data, Cliente, Serviços, Método, Valor, Extras, Desconto).
  - **Proteção CSV injection**: qualquer campo a começar por `=`, `+`, `-`, `@`, tab ou CR (interpretado como fórmula pelo Excel/Sheets/LibreOffice) recebe um apóstrofo à frente — invisível na visualização normal, mas força interpretação como texto. Aplicado antes do escaping RFC4180 (aspas duplicadas, campo entre aspas se contiver vírgula/aspas/quebra de linha).
- `src/features/finance/domain/period.ts`: `resolvePeriod`/`isFinanceView` movidos para aqui desde `financeiro/page.tsx` (estavam duplicados só ali) — agora partilhados entre a página e a rota de exportação, para nunca resolverem um período diferente para os mesmos parâmetros.
- `src/app/api/financeiro/export/route.ts` (novo): `GET`, não uma Server Action — um link `<a>` simples de download não precisa de JS no cliente, mesmo formato do `calendar.ics` já existente (NEX-072). `tenantId` só de `requireProfile()` (nunca da query string); reutiliza `resolvePeriod` para exportar exatamente o período que está no ecrã.
- `src/app/(dashboard)/dashboard/financeiro/page.tsx`: novo link "Exportar CSV", com os parâmetros do período atual sempre explícitos (resolvidos a partir de `period`, não da query string em bruto — evita divergência entre o que se vê e o que se exporta).

## Testes

- `tests/unit/csv-export.test.ts` (novo, 12/12 ✅) — cobre os dois testes obrigatórios desta tarefa:
  - **Snapshot**: comparação exata (`toBe`) do CSV gerado para uma transação simples, incluindo o BOM.
  - **Excel import**: BOM presente no primeiro carácter; rótulos de método (Dinheiro/MB WAY/Pendente/Estornado); múltiplos serviços juntos com "; "; campo com vírgula entre aspas; aspas internas duplicadas; 5 casos de proteção CSV injection (`=`, `+`, `-`, `@`, tab) cada um a receber o apóstrofo de guarda; um campo normal não é alterado.
- `npm run verify` (format, lint, typecheck, 380 testes, build) — ✅.
- Sem teste de integração: a rota não introduz RLS/RPC nova, só lê tabelas já cobertas pelos testes de `NEX-130` (dashboard financeiro).
- UI não testada num browser real (mesma limitação já registada nas tarefas anteriores desta sessão — sem staging Supabase separado, `ADR-007`).

## Resultado

A dona pode exportar as transações do período que está a ver no dashboard financeiro para CSV, pronto a abrir no Excel sem corromper acentos e protegido contra fórmulas maliciosas caso o ficheiro seja partilhado.

## Riscos residuais

Nenhum.

## Próxima tarefa desbloqueada

NEX-133 — Exportar Excel (depende de NEX-131, já concluída — não bloqueada por esta tarefa, mas relacionada).
