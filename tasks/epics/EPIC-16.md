# EPIC-16 — Privacidade, segurança e direitos

## Objetivo do épico

Entregar **privacidade, segurança e direitos** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-160 — Data map e subprocessadores

**Dependências:** NEX-004,NEX-011

**Objetivo**

Implementar data map e subprocessadores sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Fluxos, regiões, DPA e owners documentados.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Revisão privacy.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só documentação; sem dado novo, RPC ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — tarefa puramente documental.
- Registar risco residual ou decisão temporária. Achado novo nesta tarefa: a Vercel executa as funções serverless em `iad1` (EUA), divergente da região UE do Supabase — transferência internacional não avaliada juridicamente. DPAs individuais não assinados (dependem de ação da dona em cada dashboard). Ver `docs/DATA_MAP.md` e `docs/evidence/NEX-160_DATA_MAP_SUBPROCESSADORES.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-161 — Retenção e limpeza de drafts

**Dependências:** NEX-052

**Objetivo**

Implementar retenção e limpeza de drafts sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Job/processo remove expirados e audita falhas.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Teste de expiração.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. `cleanup_expired_booking_drafts` é `security definer`, revogada de `anon`/`authenticated`, só `service_role` (mesmo padrão de `provision_tenant_owner`, NEX-013) — nenhum utilizador comum consegue invocá-la. Novo endpoint `/api/cron/cleanup-booking-drafts` protegido por `CRON_SECRET` opcional (risco baixo se ausente: só apaga rascunhos já expirados).
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `booking_drafts` continua sem policy `anon`; a limpeza corre inteiramente com service role, nunca via sessão de tenant.
- Registar risco residual ou decisão temporária. Migração 0035 não pôde ser aplicada/testada localmente (sem Docker/WSL2, `ADR-007`) — verificada só via CI (`integration`). Ver `docs/evidence/NEX-161_RETENCAO_LIMPEZA_DRAFTS.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-162 — Exportar dados da cliente

**Dependências:** NEX-091

**Objetivo**

Implementar exportar dados da cliente sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Export tenant-scoped e minimizado.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Authorization/privacy.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma nova entrada — só lê dados já existentes (`clients`/`appointments`/`client_photos`) e devolve-os como ficheiro; sem RPC nova nem privilégio novo.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `requireProfile()` + `.eq('tenant_id', tenantId)` em todas as queries, mesmo padrão de `/api/financeiro/export` (NEX-132) e da própria página da ficha da cliente — um `id` de outra tenant devolve 404, nunca os dados.
- Registar risco residual ou decisão temporária. Fotografias exportadas só como metadados (tipo + data) — os ficheiros de imagem em si não são incluídos no JSON (impraticável embutir binário; URLs assinadas expirariam). Se a dona precisar das fotos em si, continuam disponíveis na própria ficha da cliente. Ver `docs/evidence/NEX-162_EXPORTAR_DADOS_CLIENTE.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-163 — Apagar/anonimizar cliente

**Dependências:** NEX-091,NEX-094

**Objetivo**

Implementar apagar/anonimizar cliente sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Workflow preserva obrigações e remove storage.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Referential/restore considerations.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova coluna `clients.anonymized_at` e nova RPC `delete_or_anonymize_client` (`security definer`, revogada de `anon`/`public`, só `authenticated`) — sem privilégio novo além do que a própria dona já tem sobre os seus clientes.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `current_tenant_id()` deriva sempre da sessão real (mesmo padrão de todas as outras RPCs); um `client_id` de outra tenant falha com `22023` antes de tocar em qualquer linha — confirmado com duas donas reais autenticadas (não `service_role`) no teste de integração.
- Registar risco residual ou decisão temporária. Telefone anonimizado é derivado deterministicamente do `id` da cliente via `hashtext()` — colisão teoricamente possível mas astronomicamente improvável (mesma margem já aceite para códigos de consulta de marcação); se colidir, a operação falha em vez de corromper dados. Ver `docs/evidence/NEX-163_APAGAR_ANONIMIZAR_CLIENTE.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-164 — Headers/CSP completos

**Dependências:** NEX-023

**Objetivo**

Implementar headers/csp completos sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Nonce CSP e políticas verificadas sem quebrar app.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Header tests.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só cabeçalhos HTTP; sem dado novo, RPC ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — CSP/HSTS são preocupação de transporte, não de dados.
- Registar risco residual ou decisão temporária. **Achado crítico**: `src/proxy.ts` (renomeado de `middleware.ts` na `NEX-153`) nunca foi realmente detetado pelo build de produção Turbopack do Next.js 16.2.10 — `middleware-manifest.json` saía sempre vazio, confirmado por rebuild A/B. Revertido para `src/middleware.ts` (a única forma que compila de facto nesta versão) — corrige silenciosamente também o `no-store` da NEX-153, que nunca esteve ativo em produção desde esse rename. Durante a verificação, correr uma amostra real de specs E2E revelou problemas pré-existentes não relacionados (violações de acessibilidade, e páginas públicas de tenant suspenso/não publicado a devolver 200 em vez de 404) — fora do âmbito desta tarefa, reportados à parte. Ver `docs/evidence/NEX-164_HEADERS_CSP_COMPLETOS.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-165 — Hardening uploads

**Dependências:** NEX-094

**Objetivo**

Implementar hardening uploads sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Validação real, quotas, EXIF e signed URLs.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Ficheiros adversariais.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma entrada nova — reforça limites já existentes (contagem de linhas, dimensão de pixels de entrada) sobre os três caminhos de upload já mapeados no threat model.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. A quota de `client_photos` é reforçada na server action com `count` filtrado por `client_id` sob RLS (mesma sessão/tenant do `requireProfile()`), não confiando em nada vindo do cliente; nenhuma alteração de RLS foi necessária.
- Registar risco residual ou decisão temporária. Investigação confirmou que fotos de catálogo/logo/capa já têm quota natural (um registo por campo, semântica de substituição) — só `client_photos` (galeria sem limite) precisava de quota explícita, agora 40/cliente. `reencodePhotoAsJpeg` já removia EXIF e verificava assinatura por decode-or-throw; adicionado `limitInputPixels` explícito (100 MP) como defesa documentada contra decompression bombs, substituindo o default implícito da libvips. Signed URLs (Storage privado + RLS) já estavam corretos desde a NEX-094, não alterados. Ver `docs/evidence/NEX-165_HARDENING_UPLOADS.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-166 — Threat model atualizado e security review

**Dependências:** NEX-115,NEX-135,NEX-164

**Objetivo**

Implementar threat model atualizado e security review sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Ameaças e risco residual atualizados.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Review independente.
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

### NEX-167 — Pentest proporcional

**Dependências:** NEX-166

**Objetivo**

Implementar pentest proporcional sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Escopo crítico testado e findings tratados.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Retest documentado.
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
