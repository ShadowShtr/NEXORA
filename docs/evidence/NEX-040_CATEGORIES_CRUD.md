# NEX-040 — CRUD de categorias

## Implementação

- `src/features/catalog/domain/category.ts`: `categoryNameSchema` (Zod, 1–80 carateres, alinhado com o check constraint de `service_categories.name`), schemas para criar/renomear/mover, e `findSwapTarget()` — função pura que, dada a lista de categorias e uma direção (`up`/`down`), devolve a categoria atual e o vizinho imediato cujos `sort_order` devem ser trocados (ou `null` se já estiver numa ponta).
- `src/features/catalog/actions.ts`: `createCategory` (novo `sort_order` = máximo + 1), `renameCategory`, `toggleCategoryVisibility` (inverte `is_visible`), `moveCategory` (troca `sort_order` com o vizinho via `findSwapTarget`). Todas derivam `tenant_id` de `requireProfile()` e mapeiam `23505` (nome duplicado) para uma mensagem amigável.
- `src/features/catalog/CategoriesManager.tsx`: lista de categorias ordenada por `sort_order`, cada linha com nome editável (guardar inline), botões ↑/↓ (desativados nas pontas) e ocultar/mostrar; formulário para criar categoria. Sem eliminar — não pedido nos critérios de aceite, e `services.category_id` é `on delete restrict`, pelo que ocultar é a operação não destrutiva correta.
- `src/app/(dashboard)/dashboard/servicos/page.tsx`: substituído o placeholder "próxima atualização" — Server Component busca as categorias do tenant e renderiza `<CategoriesManager>`.
- `src/app/globals.css`: `.catalog-list`, `.catalog-row`, `.catalog-row-name`, `.catalog-row-actions`, `.catalog-hidden-badge`.

## Testes

- `tests/unit/category.test.ts` (11/11 ✅): validação do nome (vazio, 80/81 carateres, trim); `findSwapTarget` (subir/descer, extremos sem vizinho, id desconhecido, ordena por `sort_order` independentemente da ordem de entrada).
- `tests/integration/catalog-rls.test.ts` (6/6 ✅, contra a BD real): dono vê a própria categoria; dono de outro tenant não vê; **`anon` vê uma categoria visível através da política pública de catálogo mas não uma oculta** (confirma que "ocultar" tem o efeito de segurança/privacidade esperado, não só visual); dono não consegue inserir com `tenant_id` de outro tenant (`42501`); dono não consegue renomear categoria de outro tenant (0 linhas afetadas); nome duplicado no mesmo tenant rejeitado (`23505`).
- `tests/e2e/catalog-categories.spec.ts` (6/6 ✅ em `chromium` e `webkit-mobile`): Axe 0 violações; criar categoria (persistida, verificada via `user.admin`); nome duplicado mostra erro amigável; renomear; ocultar/mostrar; reordenar com os botões ↑/↓.
- Regressão: `npm run verify` completo (89 testes unit/integration, 4 E2E de `dashboard-shell`) sem quebras.

## Nota de correção durante os testes

O primeiro rascunho do teste de RLS assumia que `anon` nunca deveria ver nenhuma categoria — falhou porque `service_categories` tem uma política pública deliberada (`public_categories ... using (is_visible = true)`, `NEX-012`) para alimentar o catálogo público futuro (`EPIC-05`). Corrigido para testar a fronteira real: `anon` vê categorias visíveis, não vê ocultas — o que também passou a validar diretamente a funcionalidade "ocultar" desta tarefa.

## Resultado

`/dashboard/servicos` deixa de ser um placeholder: a dona já consegue criar, renomear, reordenar e ocultar categorias, base para os serviços (`NEX-041`) e pacotes (`NEX-042`) que se seguem.

## Riscos residuais

Nenhum identificado.

## Próxima tarefa desbloqueada

NEX-041 — CRUD de serviços (depende de NEX-040, concluída).
