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

- Resumo, histórico, preferências, faltas, valores. `/dashboard/clientes/[id]` (`src/app/(dashboard)/dashboard/clientes/[id]/page.tsx`): contacto (nome/telefone/e-mail), resumo (primeira/última/próxima marcação, contagem de faltas/cancelamentos, total gasto, última forma de pagamento), preferências editáveis (`ClientPreferencesForm`, quatro campos de texto livre — cores/formatos/técnicas/produtos, `docs/01_PRODUCT_REQUIREMENTS.md` §10), histórico completo de marcações com itens e valores. Preferências modeladas pela primeira vez em `src/features/clients/domain/preferences.ts` (`clients.preferences` era `jsonb` sem forma definida) — parse tolerante para dados legados/malformados, nunca lança exceção. Observações privadas (`NEX-093`) e fotografias (`NEX-094`) ficam para tarefas seguintes; o layout já reserva o espaço.
- Nenhum dado de outro tenant pode ser acedido. Busca do cliente filtrada por `id` + `tenantId` da sessão — um `id` de outro tenant simplesmente não é encontrado (`notFound()`, `404`), nunca vaza dados; confirmado por teste.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Cartões separados por assunto (Contacto/Resumo/Preferências/Histórico), formulário de preferências com confirmação de sucesso.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging novo.

**Testes obrigatórios**

- Privacidade e acesso. `tests/e2e/client-detail.spec.ts`: mostra resumo/histórico corretos e guarda preferências com sucesso para a própria cliente da dona; devolve `404` para um `id` de cliente de outro tenant, sem vazar nenhum dado dele na página. `tests/unit/client-preferences.test.ts`: parse de objeto bem-formado, campos em falta assumem `''`, valor `{}` (default da coluna) resulta em preferências vazias, dados malformados/legados nunca lançam exceção.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — leitura/escrita autenticada de dados já tenant-scoped por RLS.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Busca da ficha filtra por `tenantId` explícito; `updateClientPreferences` conta as linhas afetadas pelo `UPDATE` (RLS torna uma tentativa cross-tenant um no-op silencioso — checado explicitamente para devolver erro em vez de "sucesso" falso).
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

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

- Sugestões sem expor dados cruzados. `suggestExistingClients` (`src/features/clients/suggestion-actions.ts`): busca clientes por nome parcial (`ilike`, com escaping) OU telefone normalizado (`normalizePhoneE164`, `src/lib/phone.ts` — o mesmo normalizador usado ao persistir `clients.phone_e164` em `create_public_booking`/`create_manual_booking`), com limite de 5 resultados. Integrado no `ManualBookingForm` (`NEX-085`): ao escrever nome/telefone no modo "Nova cliente" (debounce de 400ms), sugestões aparecem com botão que troca automaticamente para "Cliente existente" já pré-selecionada — evita duplicar quem já está em `clients`.
- Nenhum dado de outro tenant pode ser acedido. `tenantId` vem só de `requireProfile()`, nunca de input; confirmado por teste com dois tenants tendo o mesmo número de telefone — só a cliente do próprio tenant aparece.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Sugestão discreta ("Já existe uma cliente parecida:"), um clique para usar.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging novo.

**Testes obrigatórios**

- Telefones equivalentes. `tests/e2e/manual-booking-client-suggestion.spec.ts`: telefone digitado em formato diferente (`910 000 000` com espaços) do armazenado (`+351910000000`) ainda sugere a cliente certa; a mesma sugestão nunca aparece para o número equivalente pertencente a outro tenant; nome/telefone sem correspondência não mostra sugestão nenhuma. `tests/unit/phone.test.ts` (já existente) cobre `normalizePhoneE164` exaustivamente — a peça que torna "equivalentes" possível.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — leitura autenticada de dados já tenant-scoped por RLS.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `tenantId` derivado da sessão via `requireProfile()`, filtro explícito na query.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

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

- Editar com auditoria e limites. Nova função `security definer` `update_client_private_notes` (`supabase/migrations/0010_update_client_private_notes.sql`, mesmo padrão de `cancel_appointment`/`NEX-084`): `tenant_id` de `current_tenant_id()`, verifica que o cliente pertence ao próprio tenant, limite de 2000 caracteres (rejeitado com `22001`), grava `audit_logs` — mas só o **facto** de a nota ter mudado (`client.private_notes_updated`), nunca o conteúdo da nota em si, para não duplicar PII num registo amplamente legível pelo tenant (`docs/05_SECURITY_PRIVACY.md`, T8). `clients` não tinha caminho de `UPDATE` autenticado com auditoria antes desta tarefa (`authenticated` só tem `SELECT` em `audit_logs`, `0001_initial.sql`).
- Nenhum dado de outro tenant pode ser acedido. `client_id` verificado contra `tenant_id` do chamador antes de qualquer escrita; confirmado por teste cross-tenant.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Um `textarea` com nota explícita "Só visível para si. Nunca é partilhada com a cliente."
- Logs não contêm segredos nem PII desnecessária. Auditoria por design nunca inclui o texto da observação (só o `resource_id`/ação).

**Testes obrigatórios**

- XSS/log redaction. `tests/integration/update-client-private-notes.test.ts`: não chamável por `anon`; rejeita atualizar cliente de outro tenant; grava a nota e confirma que `audit_logs.metadata` nunca contém o texto da observação; rejeita nota com mais de 2000 caracteres; limpa a nota com string vazia. `tests/e2e/client-private-notes.spec.ts`: uma observação com marcação tipo `<img onerror=...>` é guardada e volta a renderizar como texto literal no `textarea` (React/JSX escapa por padrão — sem `dangerouslySetInnerHTML` em lugar nenhum desta árvore) — sem diálogo disparado, sem variável global injetada; ficha de outro tenant devolve `404` sem vazar a observação dele.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova função `security definer` — revogada de `public`/`anon`, concedida só a `authenticated` (`ADR-008`).
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `tenant_id` sempre de `current_tenant_id()`, nunca de parâmetro; `client_id` validado contra ele antes do `UPDATE`.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

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
