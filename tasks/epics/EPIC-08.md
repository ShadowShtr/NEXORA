# EPIC-08 — Dashboard e agenda da dona

## Objetivo do épico

Entregar **dashboard e agenda da dona** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-080 — Dashboard combinado

**Dependências:** NEX-023,NEX-064

**Objetivo**

Implementar dashboard combinado sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Próxima cliente, cartões e lista do dia. `DashboardPage` (`src/app/(dashboard)/dashboard/page.tsx`) substitui os quatro cartões estáticos por dados reais: "Próxima cliente" (primeira marcação `confirmed`/`presence_confirmed` do dia ainda não terminada, com nome do cliente e itens), "Marcações" (contagem do dia), "Lembretes" (`reminders.status='pending'`) e "Recebido" (`payments.status='paid'` com `paid_at` hoje). Agregação isolada em `buildDashboardSummary` (`src/features/dashboard/domain/summary.ts`), função pura testável sem BD — decide "próxima" e a contagem a partir de uma lista de marcações e do instante atual, injetado como parâmetro. "Lista do dia" completa (múltiplos cartões de marcação) fica para `NEX-081`; esta tarefa entrega o resumo agregado do Fluxo C (`docs/02_UX_FLOWS.md`: "Dona abre o painel. Próxima cliente aparece em destaque.").
- Nenhum dado de outro tenant pode ser acedido. `requireProfile()` (já usado por todo o dashboard) deriva `tenantId` da sessão; toda query filtra por ele — nunca de input do cliente. Confirmado por teste e2e com dois tenants.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Mesmos quatro cartões já existentes, agora com dados reais; "Nenhuma marcação." quando não há próxima.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging novo.

**Testes obrigatórios**

- Queries tenant-scoped e timezone. `tests/unit/dashboard-summary.test.ts`: seleção da próxima marcação ativa (ignora `cancelled`/`no_show`/`completed`), marcação em curso ainda conta como "próxima", contagem do dia só inclui estados ativos. `tests/e2e/dashboard-summary.spec.ts` (dois tenants provisionados reais): confirma que os dados do próprio tenant aparecem e os de outro tenant nunca aparecem na mesma página, ecrã vazio mostra "Nenhuma marcação.", marcação cancelada não conta. Cálculo do "dia" usa `fromZonedTime`/`formatInTimeZone` no timezone do tenant (`business_settings.timezone`, mesmo helper do motor de disponibilidade, `NEX-061`), não o dia UTC.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhum privilégio novo — leitura autenticada de dados já tenant-scoped por RLS.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `createClient()` cookie-scoped (RLS ativa) mais filtro explícito por `tenantId` em cada query — dupla garantia, mesmo padrão de `servicos/page.tsx`.
- Registar risco residual ou decisão temporária. "Recebido"/"Lembretes" ficam sempre em 0 até `EPIC-11` (conclusão financeira) e `NEX-100+` (lembretes automáticos) existirem — as queries já estão corretas, só não há ainda dados reais a popular essas tabelas.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-081 — Cartões de marcação

**Dependências:** NEX-080

**Objetivo**

Implementar cartões de marcação sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Horário, cliente, itens, valor, estados e duas ações rápidas.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Axe/mobile.
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

### NEX-082 — Visualizações dia/semana/mês

**Dependências:** NEX-080

**Objetivo**

Implementar visualizações dia/semana/mês sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Navegação eficiente e responsiva.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- E2E datas e DST.
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

### NEX-083 — Resumo/lista de horários livres

**Dependências:** NEX-061,NEX-080

**Objetivo**

Implementar resumo/lista de horários livres sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Contagem e drawer/lista sem poluir agenda.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Consistência com motor.
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

### NEX-084 — Detalhes, cancelar e reagendar

**Dependências:** NEX-081

**Objetivo**

Implementar detalhes, cancelar e reagendar sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Ações internas com confirmação e auditoria.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Permissões e conflitos.
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

### NEX-085 — Marcação manual completa

**Dependências:** NEX-041,NEX-061,NEX-080

**Objetivo**

Implementar marcação manual completa sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Cliente, itens, slot, valor, observação.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Conflito e cliente existente.
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
