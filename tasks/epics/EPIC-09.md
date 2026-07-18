# EPIC-09 — Clientes e histórico

## Objetivo do épico

Entregar **clientes e histórico** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-090 — Lista e pesquisa de clientes

**Dependências:** NEX-064,NEX-023

**Objetivo**

Implementar lista e pesquisa de clientes sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Busca por nome/telefone, paginação e empty state. `/dashboard/clientes` (`src/app/(dashboard)/dashboard/clientes/page.tsx`): pesquisa via `?q=` (`ilike` em `name`/`phone_e164`, com escaping dos caracteres especiais de sintaxe `or()`/`ilike` do PostgREST), paginação real via `?page=` + `.range()` (20 por página), dois empty states distintos ("ainda não tem clientes" vs. "nenhuma cliente encontrada para essa pesquisa").
- Nenhum dado de outro tenant pode ser acedido. Query filtrada por `tenantId` da sessão (`requireProfile()`); RLS via `createClient()` cookie-scoped como defesa em profundidade. Confirmado por teste com dois tenants.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Um campo de pesquisa, lista direta, paginação Anterior/Seguinte.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging novo.

**Testes obrigatórios**

- RLS/performance. `tests/e2e/clients-search.spec.ts`: empty state sem clientes, pesquisa por nome parcial e por telefone encontra a cliente certa sem nunca mostrar dados de outro tenant, pesquisa sem resultados mostra o empty state correto, paginação com 25 clientes reais mostra exatamente 20 na página 1 e 5 na página 2.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — leitura autenticada de dados já tenant-scoped por RLS.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `createClient()` cookie-scoped (RLS ativa) mais filtro explícito por `tenantId`.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-091 — Ficha completa da cliente

**Dependências:** NEX-090

**Objetivo**

Implementar ficha completa da cliente sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Resumo, histórico, preferências, faltas, valores.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Privacidade e acesso.
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

### NEX-092 — Sugestão/deduplicação no booking manual

**Dependências:** NEX-090,NEX-085

**Objetivo**

Implementar sugestão/deduplicação no booking manual sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Sugestões sem expor dados cruzados.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Telefones equivalentes.
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

### NEX-093 — Observações privadas

**Dependências:** NEX-091

**Objetivo**

Implementar observações privadas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Editar com auditoria e limites.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- XSS/log redaction.
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

### NEX-094 — Fotografias privadas

**Dependências:** NEX-091

**Objetivo**

Implementar fotografias privadas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Upload seguro, signed URL e exclusão.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- MIME/tamanho/EXIF/storage RLS.
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

### NEX-095 — Política configurável de faltas

**Dependências:** NEX-091

**Objetivo**

Implementar política configurável de faltas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Registar, alertar, aprovação ou bloqueio temporário.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Estados e reversão.
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
