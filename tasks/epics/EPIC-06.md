# EPIC-06 — Motor de disponibilidade

## Objetivo do épico

Entregar **motor de disponibilidade** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-060 — Modelar horários e exceções

**Dependências:** NEX-011,NEX-032

**Objetivo**

Implementar modelar horários e exceções sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Normal, almoço, bloqueios, férias e especial. Normal+almoço: `business_hours` (já existia, `NEX-032`). Bloqueios+férias: `availability_blocks` (já existia, cobre ambos genericamente via `reason`/`is_all_day`). Especial: `business_hours_exceptions` (novo, `0006_business_hours_exceptions.sql`) — uma `exception_date` substitui o padrão semanal só nessa data.
- Nenhum dado de outro tenant pode ser acedido. RLS tenant-scoped idêntica às restantes tabelas de horário; sem política `anon` (a agenda em bruto nunca é exposta ao público, só slots computados numa RPC futura).
- A interface mantém linguagem simples e fluxo guiado quando houver UI. N/A — tarefa é só modelo de dados.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Integração DB. `tests/integration/business-hours-exceptions.test.ts` (11 testes): RLS cruzada (leitura/insert/update/delete, incluindo anon bloqueado), `exception_date` duplicada rejeitada, `is_open=true` com `opens_at >= closes_at` rejeitado, `is_open=false` com horas nulas aceite, almoço invertido rejeitado. Corrido contra Supabase local real em CI (`NEX-015`) — 9/9 ficheiros, 56/56 testes.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova tabela, mesmo padrão de RLS das restantes — sem privilégio novo.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Confirmado pelos 11 testes de integração.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-061 — Implementar gerador de slots timezone-aware

**Dependências:** NEX-060

**Objetivo**

Implementar implementar gerador de slots timezone-aware sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Slots respeitam step, duração, buffer, notice e window. Implementado em `generateTimezoneAwareSlots` (`src/features/appointments/domain/availability.ts`): itera dia a dia dentro de `[now + min_notice_hours, now + booking_window_days]`, resolve o horário do dia via `resolveDayHours` (exceção tem prioridade sobre `business_hours`, `src/features/appointments/domain/daily-schedule.ts`) e delega step/duração/buffer/sobreposição ao gerador já existente `generateAvailableSlots`.
- Nenhum dado de outro tenant pode ser acedido. N/A — função de domínio pura, sem acesso a dados; os inputs (horários, exceções, `busy`) já vêm filtrados por tenant pelo chamador (RLS nas tabelas de origem).
- A interface mantém linguagem simples e fluxo guiado quando houver UI. N/A — tarefa é só motor de cálculo, sem UI.
- Logs não contêm segredos nem PII desnecessária. N/A — função pura sem logging.

**Testes obrigatórios**

- DST Europe/Lisbon. `tests/unit/timezone-aware-slots.test.ts`: transição de primavera (2026-03-29, WET→WEST) e de outono (2026-10-25, WEST→WET) — confirma que a hora local de abertura mapeia para o offset UTC correto em cada lado da transição, e que uma janela local fixa (09:00–19:00) produz a mesma contagem de slots em ambos os lados. Também cobre notice, window, buffer/step, dias fechados e prioridade de `business_hours_exceptions`.
- `tests/unit/daily-schedule.test.ts`: resolução de horário (exceção vs. semanal vs. fechado) e conversão para intervalos abertos em UTC, incluindo o corte pelo almoço.
- `npm run verify` passa (17 ficheiros, 136 testes; build local requer `.env.local` com os placeholders de `.env.example`, não commitado).

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhum privilégio novo — função de domínio pura, sem acesso a BD.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A nesta tarefa; aplicável quando `NEX-062` ligar isto a uma RPC pública.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-062 — Implementar consulta pública de disponibilidade

**Dependências:** NEX-061,NEX-054

**Objetivo**

Implementar implementar consulta pública de disponibilidade sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- API retorna apenas slots válidos e limites de intervalo.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Validação/rate limit contract.
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

### NEX-063 — Implementar constraint de não sobreposição

**Dependências:** NEX-011

**Objetivo**

Implementar implementar constraint de não sobreposição sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- GiST impede dupla reserva em estados ativos.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Teste concorrente SQL.
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

### NEX-064 — Implementar booking transacional/idempotente

**Dependências:** NEX-063,NEX-051

**Objetivo**

Implementar implementar booking transacional/idempotente sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Cliente upsert, snapshots, appointment, reminder e token em transação.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Concorrência, rollback e idempotência.
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

### NEX-065 — Tratar SLOT_TAKEN na UX

**Dependências:** NEX-064

**Objetivo**

Implementar tratar slot_taken na ux sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Mensagem clara, refresh de slots e carrinho preservado.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- E2E corrida de reservas.
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

### NEX-066 — Rate limit e bot protection

**Dependências:** NEX-064

**Objetivo**

Implementar rate limit e bot protection sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Rate limit distribuído e proteção escalonável sem memória local.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Teste 429 e bypass legítimo.
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
