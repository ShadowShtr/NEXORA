# EPIC-13 — Financeiro e relatórios

## Objetivo do épico

Entregar **financeiro e relatórios** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-130 — Dashboard financeiro

**Dependências:** NEX-113

**Objetivo**

Implementar dashboard financeiro sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Dia/semana/mês, métodos, pendentes, extras, descontos, ticket.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Reconciliação.
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

### NEX-131 — Filtros por período

**Dependências:** NEX-130

**Objetivo**

Implementar filtros por período sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Hoje, semana, mês e personalizado com timezone.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Limites e DST.
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

### NEX-132 — Exportar CSV

**Dependências:** NEX-131

**Objetivo**

Implementar exportar csv sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- UTF-8, colunas documentadas, proteção CSV injection.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Snapshot e Excel import.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova rota `GET /api/financeiro/export`, mas só lê dados já expostos ao próprio dono no dashboard financeiro (NEX-130); nenhuma escrita, nenhum privilégio novo.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `tenantId` só de `requireProfile()` (sessão), nunca da query string — a rota redireciona para `/login` se não autenticado, mesmo padrão de qualquer página do dashboard. RLS nas tabelas subjacentes já testado noutras tarefas.
- Registar risco residual ou decisão temporária. Nenhum.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-133 — Exportar Excel

**Dependências:** NEX-131

**Objetivo**

Implementar exportar excel sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Workbook legível e totais.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Reconciliação.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova dependência `exceljs` (biblioteca de geração de .xlsx, sem alternativa viável sem uma lib) — sem escrita nova, só leitura já exposta ao dono (NEX-130).
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Mesmo padrão de `NEX-132`: `tenantId` só de `requireProfile()`.
- Registar risco residual ou decisão temporária. `npm audit` sinaliza uma vulnerabilidade moderada transitiva (`uuid <11.1.1` via `exceljs`) — usada internamente pelo `exceljs` só para nomear partes internas do ficheiro .xlsx, não para nada criptográfico/de segurança nesta aplicação; risco residual baixo, a rever se o `exceljs` publicar uma versão sem esta dependência.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-134 — Exportar PDF

**Dependências:** NEX-131

**Objetivo**

Implementar exportar pdf sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Layout sem sobreposição e totals.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Visual regression.
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

### NEX-135 — Regras de retenção/exportação

**Dependências:** NEX-132,NEX-133,NEX-134

**Objetivo**

Implementar regras de retenção/exportação sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Limites, logging e acesso seguro.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Large range/authorization.
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
