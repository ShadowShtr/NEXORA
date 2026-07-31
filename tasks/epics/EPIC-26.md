# EPIC-26 — Fichas técnicas, anamnese e consentimentos

## Objetivo do épico

Entregar **fichas técnicas, anamnese e consentimentos** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-280 — Modelos de ficha

**Dependências:** NEX-013

**Objetivo**

Implementar modelos de ficha sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Tipos de campo suportados: texto curto, texto longo, número, data, seleção única, múltipla, sim/não, assinatura, fotografia/anexo, aviso informativo.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Criação de modelo com cada tipo de campo.
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

### NEX-281 — Versão de modelo

**Dependências:** NEX-280

**Objetivo**

Implementar versão de modelo sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Cada alteração relevante ao modelo cria nova versão; resposta mantém modelo, versão, data, autor, cliente, estado e assinatura.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Resposta antiga preserva a versão do modelo em que foi preenchida.
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

### NEX-282 — Ficha da cliente — novas tabs

**Dependências:** NEX-091,NEX-281

**Objetivo**

Implementar ficha da cliente — novas tabs sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Tabs adicionadas: Resumo, Histórico, Notas e fotos, Packs, Fichas, Consentimentos, Financeiro (conforme permissão).
- Card de ficha com nome, estado, última atualização, validade, responsável, badge protegido e seta.
- Fichas sensíveis exigem role específica e ficam com badge protegido visível.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Tab Financeiro oculta/mostra conforme permissão; badge protegido presente em ficha sensível.
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

### NEX-283 — Preenchimento de ficha

**Dependências:** NEX-282

**Objetivo**

Implementar preenchimento de ficha sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Fluxo guiado no mobile: uma secção por ecrã, progresso, guardar rascunho, revisão, assinatura e confirmação.
- Fichas sensíveis exigem role específica e acesso auditado, alinhado com a proteção adicional da NEX-284.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Guardar rascunho e retomar preenchimento; assinatura obrigatória antes da confirmação.
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

### NEX-284 — Proteção adicional para fichas sensíveis

**Dependências:** NEX-282

**Objetivo**

Implementar proteção adicional para fichas sensíveis sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Acesso restrito a role específica, com reautenticação ou PIN local com hash forte, timeout de sessão e auditoria de abertura registada.
- PIN nunca guardado em texto e conteúdo protegido nunca exposto em notificações.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Teste negativo de acesso sem role/PIN; verificação de que o PIN nunca é persistido em texto simples.
- Auditoria de abertura registada em cada acesso à ficha sensível.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Tarefa introduz dado de saúde (anamnese) — threat model tem de ser atualizado explicitamente para este novo tipo de dado sensível.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. A reautenticação/PIN é um controlo adicional sobre RLS, nunca um substituto — autorização server-side continua obrigatória mesmo com PIN válido.
- Registar risco residual ou decisão temporária.

**Definition of Done**

- [ ] Implementação concluída
- [ ] Testes concluídos
- [ ] Documentação atualizada
- [ ] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md`

### NEX-285 — Consentimentos

**Dependências:** NEX-280

**Objetivo**

Implementar consentimentos sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Consentimento com finalidade, texto/versionamento, data, aceite/recusa, canal, assinatura, revogação e prova.
- Consentimentos associados a dados sensíveis seguem o mesmo tratamento reforçado (auditoria de abertura) exigido para fichas sensíveis na NEX-284.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Revogação de consentimento registada com prova e data.
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

### NEX-286 — UI Definições — Fichas e consentimentos

**Dependências:** NEX-140,NEX-281,NEX-285

**Objetivo**

Implementar UI definições — fichas e consentimentos sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Cards: Modelos de ficha, Consentimentos, Preferências de comunicação, Retenção, Acessos.
- Editor de modelo desktop com coluna esquerda de campos, canvas central e painel direito de propriedades; mobile com lista de campos, editor em página secundária e preview separado (não replicar o desktop em miniatura).
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Editor mobile não replica o layout desktop (verificação visual/estrutural).
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

### NEX-287 — Exportação e eliminação de fichas

**Dependências:** NEX-162,NEX-163,NEX-283

**Objetivo**

Implementar exportação e eliminação de fichas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Respostas de ficha incluídas no export da cliente; retenção respeitada; anonimização quando obrigação histórica exigir; anexos tratados como privados.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Export inclui respostas de ficha; anonimização preserva histórico sem expor dados pessoais.
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

### NEX-288 — Avisos legais de fichas

**Dependências:** NEX-286

**Objetivo**

Implementar avisos legais de fichas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- UI apresenta o texto: "A NEXORA organiza os registos. A definição do conteúdo e da base legal é responsabilidade do negócio."
- Não apresenta assessoria jurídica automática.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Texto do aviso presente e inalterado na UI correspondente.
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

### NEX-289 — Testes e métricas de fichas/consentimentos

**Dependências:** NEX-283,NEX-284,NEX-285,NEX-287

**Objetivo**

Implementar testes e métricas de fichas/consentimentos sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Cobertura de versão, assinatura, permissão, PIN, expiração, exportação, eliminação, cross-tenant e acessibilidade.
- Testes de PIN/reautenticação e de auditoria de abertura de fichas sensíveis obrigatórios e explícitos, não apenas implícitos na cobertura geral.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Teste cross-tenant negativo e teste de acessibilidade automatizada.
- Teste específico de PIN/reautenticação e de auditoria de abertura para fichas sensíveis.
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
