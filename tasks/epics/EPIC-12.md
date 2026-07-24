# EPIC-12 — Recorrência e disponibilidade avançada

## Objetivo do épico

Entregar **recorrência e disponibilidade avançada** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-120 — Gerador de recorrências

**Dependências:** NEX-061,NEX-085

**Objetivo**

Implementar gerador de recorrências sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Frequências aprovadas e quantidade.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- DST e fim de mês.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Função pura de domínio, sem I/O — nenhuma entrada/dado/integração/privilégio novo.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A — não acede a nenhum recurso tenant-scoped, apenas calcula datas a partir dos parâmetros recebidos.
- Registar risco residual ou decisão temporária. Ver `docs/evidence/NEX-120_GERADOR_RECORRENCIAS.md`: a unidade de `customIntervalDays` (dias) para `frequency='custom'` é uma decisão própria, não confirmada com produto/UI — a confirmar quando `NEX-122` desenhar a criação da série.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-121 — Detetar conflitos e alternativas

**Dependências:** NEX-120

**Objetivo**

Implementar detetar conflitos e alternativas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Lista todas as colisões e slots próximos.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Casos múltiplos.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma nova tabela/coluna. `checkRecurrenceConflicts` é uma nova server action, mas só lê dados já expostos ao próprio dono (mesmas tabelas de `getManualBookingAvailability`, NEX-085).
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `tenantId` vem só de `requireProfile()` (sessão), nunca do input — mesmo padrão de `manual-availability-actions.ts`. RLS nas tabelas subjacentes (`business_settings`, `business_hours`, `business_hours_exceptions`, `availability_blocks`, `appointments`) já testado nas respetivas tarefas.
- Registar risco residual ou decisão temporária. Ver `docs/evidence/NEX-121_DETETAR_CONFLITOS.md`: os alertas de conflito comparam o instante exato da ocorrência contra o conjunto de slots livres (`computeAvailableSlotsMs`) — uma ocorrência gerada fora da grelha de slots (ex.: hora fora do intervalo configurado) seria sempre marcada como conflito; não é um problema real hoje porque a primeira ocorrência de uma série vem sempre de uma marcação já criada pela grelha normal.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-122 — Criar série atomicamente

**Dependências:** NEX-121

**Objetivo**

Implementar criar série atomicamente sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Nenhuma série parcial sem confirmação explícita.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Rollback.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova RPC `create_recurring_series`, mas escreve só nas tabelas já existentes (`recurring_series`, desde `0001_initial.sql`, e as mesmas `appointments`/`appointment_items`/`reminders` de `create_manual_booking`). `security definer` com `revoke`/`grant` explícito, mesmo padrão de todas as RPCs anteriores (`ADR-008`).
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `tenant_id` só de `current_tenant_id()` dentro da função (nunca de input); `client_id` validado contra o tenant do chamador antes de qualquer escrita. Testado em `tests/integration/create-recurring-series.test.ts` (anon bloqueado 42501; cliente doutro tenant rejeitado 22023).
- Registar risco residual ou decisão temporária. Ver `docs/evidence/NEX-122_CRIAR_SERIE_ATOMICAMENTE.md`: `frequency`/`interval_value` são guardados como metadados descritivos, não recalculados a partir das datas — a série guarda exatamente as datas que a dona confirmou (após resolver conflitos), não uma progressão estritamente aritmética.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-123 — Editar escopo da série

**Dependências:** NEX-122

**Objetivo**

Implementar editar escopo da série sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Esta, futuras ou toda a série.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Integridade/auditoria.
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

### NEX-124 — Bloqueios completos

**Dependências:** NEX-060,NEX-082

**Objetivo**

Implementar bloqueios completos sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Pontual, semanal, dia, intervalo e férias.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Impacto em slots.
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

### NEX-125 — Horários especiais

**Dependências:** NEX-124

**Objetivo**

Implementar horários especiais sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Abrir dia fechado/prolongar e mostrar publicamente.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Precedência de regras.
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
