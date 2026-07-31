# EPIC-19 — Equipas, prestadores, salas e equipamentos

## Objetivo do épico

Entregar **equipas, prestadores, salas e equipamentos** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-210 — Modelo de membros, prestadores e roles

**Dependências:** NEX-012,NEX-013

**Objetivo**

Implementar modelo de membros, prestadores e roles sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `tenant_members` e `service_providers` criados com roles iniciais (owner, manager, receptionist, provider, viewer) e campos `provider_status`, `provider_color`, `provider_booking_enabled`, `provider_display_order`.
- Membro pode existir sem ser prestador; rececionista não conta como prestador; conta desativada perde sessão; owner único não pode remover-se a si próprio.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de integração para cada role e para a regra do owner único.
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

### NEX-211 — Matriz de permissões

**Dependências:** NEX-210

**Objetivo**

Implementar matriz de permissões sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `docs/PERMISSION_MATRIX.md` documenta, por role, as permissões de agenda, marcações, valores, clientes, notas privadas, fichas sensíveis, serviços, equipa, stock, relatórios, exportação e definições.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de autorização confirmam a matriz documentada para cada role.
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

### NEX-212 — Provisionamento de colaborador

**Dependências:** NEX-211

**Objetivo**

Implementar provisionamento de colaborador sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Fluxo de convite (nome, e-mail, role, prestador, serviços, horários) gera link/token para partilha manual pelo owner.
- Token de convite armazenado como hash, validade curta, uso único, com rate limit e sem expor existência de e-mail.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de segurança do token (hash, expiração, uso único, rate limit, não enumeração de e-mail).
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

### NEX-213 — Horários por prestador

**Dependências:** NEX-210,NEX-060

**Objetivo**

Implementar horários por prestador sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `provider_business_hours` suporta exceções, bloqueios, férias e intervalo individual.
- Prestador sem horário próprio herda o horário do negócio por omissão.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de integração para herança de horário e para exceções/bloqueios por prestador.
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

### NEX-214 — Serviços por prestador

**Dependências:** NEX-210

**Objetivo**

Implementar serviços por prestador sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Relação N:N prestador-serviço com preço opcional, duração opcional, ativo e prioridade.
- Preço/duração específicos ficam ocultos atrás de "Personalizar para esta pessoa" no primeiro lançamento.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de integração da relação N:N e do fallback para preço/duração do serviço base.
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

### NEX-215 — Salas e equipamentos

**Dependências:** NEX-210

**Objetivo**

Implementar salas e equipamentos sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `resources` suporta tipo (sala/equipamento/cadeira/outro), capacidade, cor, localização e serviços compatíveis.
- Marcação pode exigir prestador, recurso ou ambos; a reserva impede conflito de prestador e de recurso.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de conflito de recurso e de prestador sob concorrência.
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

### NEX-216 — Motor de disponibilidade multi-recurso

**Dependências:** NEX-061,NEX-213,NEX-214,NEX-215

**Objetivo**

Implementar motor de disponibilidade multi-recurso sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Ordem de avaliação: serviço, localização, prestador opcional, recursos necessários, horários de negócio, horários do prestador, bloqueios, marcações, buffer.
- Conflitos devolvem códigos distintos: `PROVIDER_TAKEN`, `RESOURCE_TAKEN`, `SLOT_TAKEN`, `LOCATION_CLOSED`.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes unitários e de integração para cada código de conflito.
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

### NEX-217 — UI da página Equipa e Recursos

**Dependências:** NEX-212,NEX-213,NEX-214,NEX-215

**Objetivo**

Implementar ui da página equipa e recursos sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Página acessível em Mais → Gestão (mobile) e Sidebar → Gestão (desktop), com tabs Pessoas, Salas e equipamentos, Permissões.
- Card de pessoa não expõe e-mail completo; editor de pessoa é wizard de 4 passos (Dados, Acesso, Serviços, Horários); estado vazio segue o texto definido.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Verificação visual mobile/tablet/desktop e axe na nova página.
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

### NEX-218 — Integração visual na Agenda

**Dependências:** NEX-082,NEX-216

**Objetivo**

Implementar integração visual na agenda sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Agenda ganha filtros horizontais Todos/Eu/prestador/Recursos; cor do prestador aparece como faixa lateral de 4px, nunca como fundo saturado completo.
- Vista de mês usa indicador por quantidade e filtro de prestador, sem listar dezenas de nomes no dia.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Verificação visual das vistas Dia/Semana/Mês com filtro de prestador ativo.
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

### NEX-219 — Testes e métricas de equipas/recursos

**Dependências:** NEX-216,NEX-217,NEX-218

**Objetivo**

Implementar testes e métricas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Cobertura de isolamento tenant, matriz de permissões, conflitos de prestador/recurso, rececionista sem financeiro, provider com acesso restrito e desativação de membro.
- Métricas de prestadores ativos, utilização por prestador, horas disponíveis/ocupadas e conflitos evitados disponíveis.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes negativos de autorização e regressão de timezone por prestador.
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
