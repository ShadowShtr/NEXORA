# EPIC-03 — Onboarding guiado da dona

## Objetivo do épico

Entregar **onboarding guiado da dona** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-030 — Criar motor de wizard persistente

**Dependências:** NEX-022

**Objetivo**

Implementar criar motor de wizard persistente sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Passos guardam progresso e permitem voltar. Progresso persistido em `business_settings.onboarding_step` (coluna já existia desde `NEX-001`) — sobrevive a refresh e a reentrada a partir de outra navegação, não é estado só de cliente.
- Nenhum dado de outro tenant pode ser acedido. Leitura/escrita via cliente autenticado normal (RLS `tenant_id = current_tenant_id()`), sem `service_role` — isolamento garantido pela política já existente, sem código extra.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Um passo de cada vez, "Voltar" só aparece a partir do passo 2, "Seguinte" desaparece no último passo.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Unit + E2E refresh/reentrada. `tests/unit/wizard.test.ts` (6 testes: avançar, não ultrapassar o limite, recuar, não recuar antes do passo 1, clamping de valores arbitrários, contagem de títulos). `tests/e2e/onboarding-wizard.spec.ts` (3 testes): tenant novo começa no passo 1 sem "Voltar"; avançar persiste através de `reload()` **e** de reentrada por navegação separada (`/dashboard` → `/onboarding`); "Voltar" funciona. Chromium + webkit-mobile.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária. Conteúdo real de cada passo (negócio/morada, horários, serviços, regras, publicar) fica para `NEX-031`–`NEX-035`; esta tarefa entrega só o motor — passos mostram um título e um placeholder "em breve". Extraído `requireProfile()` partilhado (`src/lib/auth/require-profile.ts`) entre o layout do dashboard e o do onboarding, evitando duplicar a verificação de claims+profile.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-031 — Passo negócio e morada fixa

**Dependências:** NEX-030

**Objetivo**

Implementar passo negócio e morada fixa sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Validação simples, telefone normalizado e Maps URL segura.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Validação e acessibilidade.
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

### NEX-032 — Passo horários de trabalho

**Dependências:** NEX-030

**Objetivo**

Implementar passo horários de trabalho sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Dias, início/fim e almoço com defaults.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Casos inválidos e limites.
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

### NEX-033 — Passo serviços iniciais

**Dependências:** NEX-030

**Objetivo**

Implementar passo serviços iniciais sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Criação repetida de nome/preço/duração/categoria.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Persistência e duplicados.
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

### NEX-034 — Passo regras recomendadas

**Dependências:** NEX-030

**Objetivo**

Implementar passo regras recomendadas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Aplicar defaults com um toque e permitir edição.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- E2E recomendações.
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

### NEX-035 — Passo publicar link e QR Code

**Dependências:** NEX-031,NEX-033,NEX-034

**Objetivo**

Implementar passo publicar link e qr code sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Slug único, preview, publicar e QR local.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Slug collision e QR decode.
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

### NEX-036 — Teste de usabilidade do onboarding

**Dependências:** NEX-035

**Objetivo**

Implementar teste de usabilidade do onboarding sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Fluxo concluído sem linguagem técnica e em tempo alvo definido.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Sessão observada/documentada.
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
