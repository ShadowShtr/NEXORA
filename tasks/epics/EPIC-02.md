# EPIC-02 — Autenticação e sessão da dona

## Objetivo do épico

Entregar **autenticação e sessão da dona** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-020 — Implementar login e logout

**Dependências:** NEX-013

**Objetivo**

Implementar implementar login e logout sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Login por e-mail/password, erros genéricos e redirect seguro. `signInWithPassword` via server action; mensagem de erro única e genérica independentemente da causa (não revela se o e-mail existe); redirect fixo para `/dashboard` (sem parâmetro `next`, sem superfície de open redirect).
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Um ecrã, uma decisão (entrar), erro inline com `role="alert"`.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- E2E sucesso/falha. `tests/e2e/login.spec.ts`: credenciais inválidas → erro genérico visível, sem navegação; credenciais válidas → login, redirect para `/dashboard`, logout → redirect para `/login`. Corrido em `chromium` e `webkit-mobile` contra o projeto Supabase dev, com utilizador provisionado real (`tests/e2e/support/provisioned-user.ts`, reutilizável pelas próximas tarefas do épico).
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária. E2E ainda não corre em CI (`ci.yml` não tem step `test:e2e`; exigiria instalar browsers e configurar `NEXT_PUBLIC_SUPABASE_*`/`SUPABASE_SERVICE_ROLE_KEY` como secrets do GitHub Actions apontando ao projeto dev). Decisão de infraestrutura não tomada sem confirmação do owner — ver evidência.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-021 — Implementar recuperação de palavra-passe

**Dependências:** NEX-020

**Objetivo**

Implementar implementar recuperação de palavra-passe sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Fluxo seguro, token único, expiry e redirect allowlist. Token único/expiry geridos nativamente pelo Supabase Auth (não reinventado); `redirectTo` é sempre um caminho interno fixo (`/definir-password`), nunca derivado de input — a forma mais forte de allowlist (tamanho 1). Confirmado empiricamente que reutilizar o mesmo link falha.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Ecrã de pedido → mensagem de confirmação neutra → ecrã de nova palavra-passe.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- E2E e abuso básico. `tests/e2e/password-recovery.spec.ts`: (1) pedir recuperação para e-mail inexistente não revela isso (mesma mensagem genérica — teste de abuso básico/anti-enumeração); (2) fluxo completo com link real gerado via Admin API, define nova password, confirma redirect para `/dashboard`, confirma que **reutilizar o mesmo link falha** (token único), confirma login com a nova password. Corrido em `chromium` e `webkit-mobile`.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária. Descoberta técnica registada em `ADR-009`: `@supabase/ssr` força `flowType: "pkce"` de forma não substituível, mas os links de e-mail do Supabase usam o fluxo implícito (tokens no fragmento da URL) — a deteção automática de sessão nunca funcionaria; corrigido com parsing manual do fragmento + `setSession()` explícito. Padrão a repetir em qualquer fluxo futuro baseado em link de e-mail.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-022 — Proteger rotas privadas

**Dependências:** NEX-020

**Objetivo**

Implementar proteger rotas privadas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Claims validadas no servidor; utilizador sem profile bloqueado.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de sessão falsificada.
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

### NEX-023 — Implementar shell responsivo autenticado

**Dependências:** NEX-022

**Objetivo**

Implementar implementar shell responsivo autenticado sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Menu mobile/desktop conforme especificação; foco e teclado.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Axe + Playwright mobile/desktop.
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
