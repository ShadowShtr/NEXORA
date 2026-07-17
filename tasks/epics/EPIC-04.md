# EPIC-04 — Catálogo de serviços e pacotes

## Objetivo do épico

Entregar **catálogo de serviços e pacotes** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-040 — CRUD de categorias

**Dependências:** NEX-012,NEX-023

**Objetivo**

Implementar crud de categorias sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Criar, ordenar, ocultar, renomear e mover. Página `/dashboard/servicos` (`src/features/catalog/CategoriesManager.tsx`): criar categoria, renomear inline, ocultar/mostrar (`is_visible`, controla também a visibilidade no catálogo público — `NEX-012`), mover para cima/para baixo (troca `sort_order` com o vizinho, `src/features/catalog/domain/category.ts#findSwapTarget`). Sem eliminar (não pedido nos critérios; `services.category_id` é `on delete restrict`, pelo que ocultar é a operação não destrutiva correta em vez de apagar).
- Nenhum dado de outro tenant pode ser acedido. `service_categories` já coberta pela política RLS genérica tenant-scoped (`0001_initial.sql`) — sem migração nova nesta tarefa.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- RLS, validação, E2E. `tests/unit/category.test.ts` (11 testes): validação de nome, lógica de `findSwapTarget`. `tests/integration/catalog-rls.test.ts` (6 testes, contra BD real): dono vê a própria categoria; dono de outro tenant não vê; `anon` vê categoria visível (política pública de catálogo) mas não uma oculta; dono não consegue inserir/atualizar categoria de outro tenant (`42501`, 0 linhas); nome duplicado no mesmo tenant rejeitado (`23505`). `tests/e2e/catalog-categories.spec.ts` (6 testes, chromium + webkit-mobile): Axe; criar; nome duplicado com erro amigável; renomear; ocultar/mostrar; reordenar com os botões ↑/↓.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma nova superfície — reutiliza RLS existente.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Confirmado via `tests/integration/catalog-rls.test.ts`.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-041 — CRUD de serviços

**Dependências:** NEX-040

**Objetivo**

Implementar crud de serviços sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Nome, preço, duração, categoria, ativo. `src/features/catalog/ServicesManager.tsx`: criar e editar nome/preço/duração/categoria (select das categorias existentes, incluindo ocultas — ocultar é sobre visibilidade pública, não impede uso interno), ativar/desativar (`is_active`, controla também a visibilidade no catálogo público). Preço partilha o parser euros→cêntimos com o passo de serviços do onboarding (`src/lib/validation/money.ts#priceEurosSchema`, extraído nesta tarefa para não duplicar a lógica).
- Nenhum dado de outro tenant pode ser acedido. `services` já coberta pela política RLS genérica tenant-scoped — sem migração nova.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Cêntimos, duração e duplicados. `tests/unit/service.test.ts` (9 testes): conversão euros→cêntimos (vírgula e ponto), preço negativo/inválido rejeitado, duração fora de 5–720 rejeitada (incl. limites aceites), `categoryId` não-UUID rejeitado. `tests/integration/services-rls.test.ts` (7 testes, contra BD real): dono vê os próprios serviços; dono de outro tenant não vê; `anon` vê serviço ativo (catálogo público) mas não inativo; dono não insere com `tenant_id` de outro tenant (`42501`); nome duplicado no mesmo tenant (`23505`); duração fora do intervalo (`23514`); preço negativo (`23514`). `tests/e2e/catalog-services.spec.ts` (6 testes, chromium + webkit-mobile): Axe; mensagem de ajuda até existir categoria; criar (preço persistido em cêntimos); nome duplicado com erro amigável; editar nome/preço/categoria; ativar/desativar.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma nova superfície — reutiliza RLS existente.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Confirmado via `tests/integration/services-rls.test.ts`.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-042 — CRUD de pacotes

**Dependências:** NEX-041

**Objetivo**

Implementar crud de pacotes sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Nome, itens, preço e duração derivada. `src/features/catalog/PackagesManager.tsx`: criar/editar nome, preço (direto, tal como serviços) e itens (checkboxes dos serviços do tenant); duração **nunca guardada**, sempre calculada como soma das durações dos serviços incluídos (`docs/04_DATA_MODEL.md` #61 — `packages` não tem coluna de duração), via `derivePackageDurationMinutes()`. Ativar/desativar (`is_active`, controla visibilidade no catálogo público).
- Nenhum dado de outro tenant pode ser acedido. `packages`/`package_services` já cobertas pela política RLS genérica tenant-scoped — sem migração nova.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Sem item duplicado; preço válido. "Sem item duplicado" já garantido pela BD: `package_services` tem chave primária composta `(package_id, service_id)` (`0001_initial.sql`) — inserir o mesmo serviço duas vezes no mesmo pacote é fisicamente impossível via checkbox (cada valor só pode estar marcado uma vez), e confirmado a nível de API por teste direto. `tests/unit/package.test.ts` (8 testes): schema (nome, preço negativo, lista de serviços vazia rejeitada, id não-UUID) e `derivePackageDurationMinutes` (soma, lista vazia, id em falta ignorado). `tests/integration/packages-rls.test.ts` (7 testes, contra BD real): dono vê os próprios pacotes/itens; dono de outro tenant não vê; `anon` vê pacote ativo (catálogo público) mas não inativo; nome duplicado (`23505`); preço negativo (`23514`); item duplicado no mesmo pacote (`23505`, chave composta); item a referenciar serviço doutro tenant rejeitado pela FK composta tenant-scoped (`23503`, `NEX-011`). `tests/e2e/catalog-packages.spec.ts` (5 testes, chromium + webkit-mobile): Axe; mensagem de ajuda sem serviços; criar pacote com 2 serviços confirmando preço em cêntimos e duração somada (105 min = 60+45); nome duplicado com erro amigável; ativar/desativar.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma nova superfície — reutiliza RLS existente.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Confirmado via `tests/integration/packages-rls.test.ts`, incluindo a FK composta tenant-scoped de `NEX-011` a impedir referenciar serviços de outro tenant.
- Registar risco residual ou decisão temporária. `createPackage`/`updatePackage` fazem 2–3 escritas sequenciais (pacote + itens) sem transação — sem RPC dedicada disponível via cliente autenticado normal; em falha a meio, há compensação (apagar o pacote recém-criado) para `createPackage`, mas `updatePackage` pode, em falha rara a meio, deixar um pacote sem itens. Risco aceite para este MVP de dono único/baixa concorrência; registado para eventual RPC transacional se vier a ser um problema real.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-043 — Regras de combinação pacote/extras

**Dependências:** NEX-042

**Objetivo**

Implementar regras de combinação pacote/extras sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Carrinho bloqueia duplicações e recalcula.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Unitários de combinações.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Definition of Done**

- [ ] Implementação concluída
- [ ] Testes concluídos
- [ ] Documentação atualizada
- [ ] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md`

### NEX-044 — Interface extremamente simples de catálogo

**Dependências:** NEX-043

**Objetivo**

Implementar interface extremamente simples de catálogo sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Criação em poucos campos, feedback e estados vazios.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Axe + teste mobile.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Definition of Done**

- [ ] Implementação concluída
- [ ] Testes concluídos
- [ ] Documentação atualizada
- [ ] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md`
