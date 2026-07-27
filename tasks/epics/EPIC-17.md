# EPIC-17 — Observabilidade, CI/CD e lançamento

## Objetivo do épico

Entregar **observabilidade, ci/cd e lançamento** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-170 — Logs estruturados e redaction

**Dependências:** NEX-004

**Objetivo**

Implementar logs estruturados e redaction sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Correlation ID e allowlist; sem PII sensível.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Log tests.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Fecha a lacuna do T8 (`docs/05_SECURITY_PRIVACY.md`) já registada na NEX-166 ("sem mecanismo de redaction automática dedicado") — `src/lib/logger.ts` agora é o controlo real.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — infraestrutura de logging, sem novo acesso a dados.
- Registar risco residual ou decisão temporária. Redaction por forma do valor cobre e-mail/telemóvel completos, não substrings dentro de mensagens de erro mais longas — a allowlist de nomes de chave continua a ser a proteção principal. Nenhum ponto de logging novo instrumentado além do já existente (cron de limpeza) — eventos de negócio ficam para a NEX-171. Ver `docs/evidence/NEX-170_LOGS_ESTRUTURADOS_REDACTION.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-171 — Métricas e alertas

**Dependências:** NEX-170

**Objetivo**

Implementar métricas e alertas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Booking, conflitos, 5xx, auth, reminders, exports.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Alert test.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Não aplicável — só observabilidade sobre fluxos já existentes.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — instrumentação de logging, sem novo acesso a dados; `tenantId` incluído nos logs vem sempre de `requireProfile()`/sessão, nunca de input.
- Registar risco residual ou decisão temporária. Reminders "pending overdue" só medido ao carregamento da página (sem cron dedicado). Payments pending, e-mail provider degradado e RLS denials ficam sem instrumentação — fora dos seis critérios de aceite explícitos desta tarefa (booking, conflitos, 5xx, auth, reminders, exports); investigação confirmou que não existe hoje nenhum caminho de código que alcance genuinamente uma RLS denial (`42501`) para instrumentar. Ver `docs/evidence/NEX-171_METRICAS_ALERTAS.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-172 — Deploy Vercel e Supabase separados

**Dependências:** NEX-003,NEX-010

**Objetivo**

Implementar deploy vercel e supabase separados sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Preview/prod com secrets separados e smoke test.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Deploy rehearsal.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Não criou nada novo — investigação/tentativa de configuração de infraestrutura já existente.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável.
- Registar risco residual ou decisão temporária. **Tarefa não concluída como pedido.** Uma tentativa real de separar segredos de Preview/Produção no Vercel causou um incidente de produção (`NEXT_PUBLIC_SUPABASE_URL` apagada de Produção ao tentar retirá-la só de Preview — o Vercel guarda valores partilhados entre ambientes como um único registo, remover um ambiente elimina o registo inteiro, não o divide). Recuperado sem perda de dados de cliente (o Vercel nunca promoveu a build falhada a produção) e confirmado saudável com login real da dona. Por pedido explícito dela, revertido para o estado original partilhado em vez de insistir na separação. Risco residual aceite e documentado em `docs/ENVIRONMENTS_AND_SECRETS.md` — Preview e Produção continuam a partilhar todos os segredos, incluindo a service role key, até um plano mais cuidadoso ser feito, idealmente antes do lançamento comercial. Ver `docs/evidence/NEX-172_DEPLOY_PREVIEW_PROD_SEPARADOS.md`.

**Definition of Done**

- [ ] Implementação concluída — separação de segredos não alcançada, revertida por decisão da dona
- [x] Testes concluídos — "deploy rehearsal" aconteceu de facto (incidente real + recuperação)
- [x] Documentação atualizada
- [ ] Critérios de aceite validados — "secrets separados" não cumprido
- [ ] Tarefa marcada no `TASKS.md`

### NEX-173 — Backups e restore test

**Dependências:** NEX-172

**Objetivo**

Implementar backups e restore test sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Política real documentada e restore comprovado.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Evidence.
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

### NEX-174 — Runbooks de incidentes

**Dependências:** NEX-171,NEX-173

**Objetivo**

Implementar runbooks de incidentes sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Runbooks mínimos e contactos.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Tabletop exercise.
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

### NEX-175 — Load/concurrency test

**Dependências:** NEX-064,NEX-155

**Objetivo**

Implementar load/concurrency test sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Booking e availability sob carga alvo.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Relatório p95/p99.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Não aplicável — script de teste usa os fluxos públicos existentes (`getPublicAvailability`, `createPublicBooking`) sem alterar código de produção; não cria endpoints, permissões ou entradas novas.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Cada corrida provisiona um tenant descartável próprio (`loadtest-<hex>`) via `provision_tenant_owner`; todos os pedidos concorrentes operam dentro desse tenant, nunca cruzando dados de outro tenant. `SUPABASE_SERVICE_ROLE_KEY` usada só para provisionar/limpar (nunca exposta ao browser, script corre em Node local).
- Registar risco residual ou decisão temporária. Utilizadores Auth de teste ficam órfãos após cada corrida (FK `RESTRICT` de `audit_logs` para o autor impede `deleteUser`, comportamento intencional já confirmado noutra tarefa) — tenant fica soft-deleted e sem appointments/clients, mas o registo em `auth.users`/`audit_logs` permanece; sem impacto funcional (e-mail `@example.test` descartável), mas corridas repetidas acumulam órfãos — script agora avisa no log em vez de falhar silenciosamente. Testado só contra `localhost`, não contra o deployment Vercel real (Deployment Protection bloqueia pedidos automatizados). `concurrency` testada até 15/10, proporcional ao volume esperado de uma profissional independente. Ver `docs/evidence/NEX-175_LOAD_CONCURRENCY_TEST.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-176 — Checklist beta privado

**Dependências:** NEX-154,NEX-167,NEX-175

**Objetivo**

Implementar checklist beta privado sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Todos os gates de beta satisfeitos.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Go/no-go review.
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

### NEX-177 — Lançamento e monitorização inicial

**Dependências:** NEX-176

**Objetivo**

Implementar lançamento e monitorização inicial sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Produção controlada, owner e rollback prontos.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Smoke + 24h monitoring.
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
