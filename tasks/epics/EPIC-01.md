# EPIC-01 — Supabase, dados e isolamento

## Objetivo do épico

Entregar **supabase, dados e isolamento** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-010 — Inicializar Supabase local

**Dependências:** NEX-001

**Objetivo**

Implementar inicializar supabase local sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- CLI/configuração local, migration aplicada e seed sintético. _Nota: Docker/WSL2 indisponíveis neste ambiente — substituído por projeto Supabase cloud dedicado a dev, ver `ADR-007`. `supabase/config.toml` criado e pronto para `supabase start` assim que Docker estiver disponível._
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Reset local repetível. _Parcial: idempotência de `db push`/seed validada (reaplicação sem duplicar/erro); reset completo (`supabase db reset`) não exercitado por falta de Docker — coberto de forma mais rigorosa em `NEX-015` via CI com Docker nativo._
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-011 — Rever e endurecer schema inicial

**Dependências:** NEX-010

**Objetivo**

Implementar rever e endurecer schema inicial sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Constraints, FK, índices e tipos revistos; migration imutável após aceite. `0001_initial.sql` não foi editada — reforços entraram em `0002_harden_tenant_fk_integrity.sql`.
- Nenhum dado de outro tenant pode ser acedido. FKs entre tabelas tenant-scoped passaram a compostas `(tenant_id, id)`, fechando uma lacuna onde a integridade cross-tenant dependia só de RLS.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes SQL de invariantes. `tests/integration/schema-invariants.test.ts` (7 testes), gated por `TEST_DATABASE_URL` — skip limpo sem BD (não quebra `npm run verify` sem Postgres disponível).
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-012 — Implementar RLS tenant-scoped

**Dependências:** NEX-010

**Objetivo**

Implementar implementar rls tenant-scoped sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Todas as tabelas privadas têm RLS e políticas mínimas. Auditado via `pg_class.relrowsecurity` + `pg_policies`: 18/18 tabelas com RLS ativa e ≥1 política.
- Nenhum dado de outro tenant pode ser acedido. Verificado com utilizadores `authenticated` reais de dois tenants distintos (não só `anon`/`service_role`).
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Tenant A/B, anon e authenticated. `tests/integration/rls-tenant-isolation.test.ts` (7 testes: leitura própria, leitura cruzada bloqueada, anon bloqueado, insert/update/delete cruzados bloqueados, update próprio permitido), gated por env vars reais da app — skip limpo sem configuração.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-013 — Implementar provisioning de tenant/owner

**Dependências:** NEX-012

**Objetivo**

Implementar implementar provisioning de tenant/owner sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Fluxo administrativo atómico cria tenant, profile e settings.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Rollback em falha e auditoria.
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

### NEX-014 — Implementar auditoria append-only

**Dependências:** NEX-012

**Objetivo**

Implementar implementar auditoria append-only sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Ações críticas geram log seguro e imutável pela UI.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Tentativa de alteração negada.
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

### NEX-015 — Criar testes automatizados de isolamento

**Dependências:** NEX-012

**Objetivo**

Implementar criar testes automatizados de isolamento sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Suite cobre SELECT/INSERT/UPDATE/DELETE cruzado.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- CI com Supabase local.
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
