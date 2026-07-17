# NEX-041 — CRUD de serviços

## Implementação

- `src/lib/validation/money.ts` (novo, partilhado): `priceEurosSchema` — extrai o parser "25,00"/"25.00" → cêntimos inteiros que já existia só no passo de serviços do onboarding, para não duplicar a lógica de conversão monetária (`CLAUDE.md`: valores monetários são sempre inteiros em cêntimos). `src/features/onboarding/domain/services-step.ts` refatorado para reutilizar este schema (comportamento idêntico, testes existentes continuam a passar).
- `src/features/catalog/domain/service.ts`: `createServiceSchema`/`updateServiceSchema` (nome 1–120, preço via `priceEurosSchema`, duração 5–720, `categoryId` UUID), alinhados com os check constraints de `services` (`0001_initial.sql`).
- `src/features/catalog/actions.ts`: `createService`, `updateService`, `toggleServiceActive` — todas tenant-scoped via `requireProfile()`, mapeiam `23505` (nome duplicado) para mensagem amigável.
- `src/features/catalog/ServicesManager.tsx`: lista de serviços com edição inline (nome, preço, duração, categoria — `<select>` com todas as categorias do tenant, incluindo ocultas) e ativar/desativar; formulário para criar serviço. Mostra uma mensagem a pedir para criar uma categoria primeiro quando não existe nenhuma (`category_id` é obrigatório e `not null`).
- `src/app/(dashboard)/dashboard/servicos/page.tsx`: busca categorias e serviços em paralelo, renderiza `<ServicesManager>` a seguir a `<CategoriesManager>`.
- `src/app/globals.css`: `.catalog-service-form`, `.catalog-service-summary`.

## Testes

- `tests/unit/service.test.ts` (9/9 ✅): conversão euros→cêntimos (vírgula e ponto); nome vazio, preço negativo/inválido, duração fora de 5–720 (incl. limites aceites), `categoryId` não-UUID — todos rejeitados corretamente.
- `tests/integration/services-rls.test.ts` (7/7 ✅, contra a BD real): dono vê os próprios serviços; dono de outro tenant não vê; `anon` vê serviço ativo via política pública mas não um inativo; dono não insere com `tenant_id` de outro tenant (`42501`); nome duplicado no mesmo tenant (`23505`); duração fora do intervalo (`23514` × 2); preço negativo (`23514`).
- `tests/e2e/catalog-services.spec.ts` (6/6 ✅ em `chromium` e `webkit-mobile`): Axe; mensagem de ajuda sem categorias; criar serviço (preço confirmado em cêntimos via `user.admin`); nome duplicado com erro amigável (sem criar segunda linha); editar nome/preço/categoria; ativar/desativar.
- Regressão: `npm run verify` completo (106 testes unit/integration) e `tests/e2e/onboarding-services-step.spec.ts` (6/6) + `tests/e2e/catalog-categories.spec.ts` (6/6) sem quebras após o refactor de `money.ts`.

## Nota sobre os testes E2E

Linhas de categoria e de serviço partilham a classe `.catalog-row` — os primeiros testes falharam por ambiguidade entre o formulário de criação e as linhas existentes (labels repetidos, e o `<form aria-label="Novo serviço">` também correspondia a `getByLabel`). Corrigido escopando cada locator explicitamente ao formulário de criação (`form[aria-label="Novo serviço"]`) ou à secção "Serviços" (`section[aria-label="Serviços"] .catalog-row`), em vez de depender de posição no DOM.

## Resultado

`/dashboard/servicos` já suporta o catálogo completo de serviços: criar, editar todos os campos, ativar/desativar — base para os pacotes (`NEX-042`).

## Riscos residuais

Nenhum identificado.

## Próxima tarefa desbloqueada

NEX-042 — CRUD de pacotes (depende de NEX-041, concluída).
