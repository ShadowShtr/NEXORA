# NEX-042 — CRUD de pacotes

## Implementação

- `src/features/catalog/domain/package.ts`: `createPackageSchema`/`updatePackageSchema` (nome, preço via `priceEurosSchema`, lista de `serviceIds` — pelo menos 1). `derivePackageDurationMinutes()` — a duração de um pacote **nunca é guardada**, é sempre a soma das durações dos serviços incluídos (`docs/04_DATA_MODEL.md` #61; a tabela `packages` não tem coluna de duração, só `price_cents`).
- `src/features/catalog/actions.ts`: `createPackage` (insere o pacote, depois os itens em `package_services`; se os itens falharem, apaga o pacote recém-criado em vez de deixar um pacote vazio — sem transação disponível via cliente autenticado normal), `updatePackage` (atualiza nome/preço, substitui todos os itens — apaga e reinsere), `togglePackageActive`.
- `src/features/catalog/PackagesManager.tsx`: lista de pacotes com edição inline (nome, preço, checkboxes de serviços) e ativar/desativar; mostra a duração derivada e o preço formatado; formulário para criar pacote. Mostra mensagem de ajuda até existir pelo menos um serviço.
- `src/app/(dashboard)/dashboard/servicos/page.tsx`: busca `packages` + `package_services` em paralelo com categorias/serviços, monta o mapa `package_id → serviceIds[]`, renderiza `<PackagesManager>`.
- `src/app/globals.css`: `.catalog-package-items`, `.catalog-package-item`.

## Testes

- `tests/unit/package.test.ts` (8/8 ✅): schema (nome vazio, preço negativo, lista de serviços vazia, id não-UUID — todos rejeitados); `derivePackageDurationMinutes` (soma correta, lista vazia → 0, id em falta no mapa ignorado sem rebentar).
- `tests/integration/packages-rls.test.ts` (7/7 ✅, contra a BD real): dono vê os próprios pacotes e itens; dono de outro tenant não vê; `anon` vê pacote ativo via política pública mas não um inativo; nome de pacote duplicado (`23505`); preço negativo (`23514`); **item duplicado no mesmo pacote rejeitado pela chave primária composta `(package_id, service_id)`** (`23505` — "sem item duplicado" garantido ao nível da BD, não só da UI); item a referenciar um serviço de outro tenant rejeitado pela FK composta tenant-scoped introduzida em `NEX-011` (`23503`).
- `tests/e2e/catalog-packages.spec.ts` (5/5 ✅ em `chromium` e `webkit-mobile`): Axe; mensagem de ajuda sem serviços; criar pacote com 2 serviços (60 + 45 min) confirmando preço em cêntimos (4500) e **duração derivada correta (105 min)** mostrada na interface; nome duplicado com erro amigável (sem criar segunda linha); ativar/desativar.
- Regressão: `npm run verify` completo (121 testes unit/integration) e `tests/e2e/catalog-categories.spec.ts` + `tests/e2e/catalog-services.spec.ts` (12/12) sem quebras após acrescentar pacotes à página.

## Resultado

`/dashboard/servicos` já cobre o catálogo completo: categorias, serviços e pacotes — base para as regras de combinação (`NEX-043`) e a interface simplificada final (`NEX-044`).

## Riscos residuais

- `createPackage`/`updatePackage` fazem 2–3 escritas sequenciais (pacote + itens) sem transação, por não haver RPC dedicada nem transações multi-tabela via o cliente autenticado normal. `createPackage` compensa uma falha nos itens apagando o pacote; `updatePackage`, numa falha rara a meio da substituição de itens, pode deixar um pacote sem nenhum item. Risco aceite para este MVP de dona única/baixa concorrência — registar para uma eventual função `security definer` transacional se vier a ser um problema real em uso.

## Próxima tarefa desbloqueada

NEX-043 — Regras de combinação pacote/extras (depende de NEX-042, concluída).
