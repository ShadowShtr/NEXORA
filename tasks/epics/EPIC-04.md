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

- Nome, preço, duração, categoria, ativo.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Cêntimos, duração e duplicados.
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

- Nome, itens, preço e duração derivada.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Sem item duplicado; preço válido.
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
