# EPIC-03 — Onboarding guiado da dona

## Objetivo do épico

Entregar **onboarding guiado da dona** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-030 — Criar motor de wizard persistente

**Dependências:** NEX-022

**Objetivo**

Implementar criar motor de wizard persistente sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Passos guardam progresso e permitem voltar. Progresso persistido em `business_settings.onboarding_step` (coluna já existia desde `NEX-001`) — sobrevive a refresh e a reentrada a partir de outra navegação, não é estado só de cliente.
- Nenhum dado de outro tenant pode ser acedido. Leitura/escrita via cliente autenticado normal (RLS `tenant_id = current_tenant_id()`), sem `service_role` — isolamento garantido pela política já existente, sem código extra.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Um passo de cada vez, "Voltar" só aparece a partir do passo 2, "Seguinte" desaparece no último passo.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Unit + E2E refresh/reentrada. `tests/unit/wizard.test.ts` (6 testes: avançar, não ultrapassar o limite, recuar, não recuar antes do passo 1, clamping de valores arbitrários, contagem de títulos). `tests/e2e/onboarding-wizard.spec.ts` (3 testes): tenant novo começa no passo 1 sem "Voltar"; avançar persiste através de `reload()` **e** de reentrada por navegação separada (`/dashboard` → `/onboarding`); "Voltar" funciona. Chromium + webkit-mobile.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária. Conteúdo real de cada passo (negócio/morada, horários, serviços, regras, publicar) fica para `NEX-031`–`NEX-035`; esta tarefa entrega só o motor — passos mostram um título e um placeholder "em breve". Extraído `requireProfile()` partilhado (`src/lib/auth/require-profile.ts`) entre o layout do dashboard e o do onboarding, evitando duplicar a verificação de claims+profile.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-031 — Passo negócio e morada fixa

**Dependências:** NEX-030

**Objetivo**

Implementar passo negócio e morada fixa sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Validação simples, telefone normalizado e Maps URL segura. `src/lib/phone.ts` normaliza para E.164 (Portugal como país por omissão, já suporta números já em E.164 de qualquer país). `src/lib/maps-url.ts` só aceita `https://` para uma allowlist de anfitriões conhecidos (Google/Apple Maps) — impede URL arbitrário/open-redirect no campo mostrado publicamente na página de marcação (`NEX-073`).
- Nenhum dado de outro tenant pode ser acedido. Escrita via cliente autenticado normal (RLS), não `service_role`.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Um formulário, submissão guarda e avança automaticamente.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Validação e acessibilidade. `tests/unit/phone.test.ts` (6 testes) + `tests/unit/maps-url.test.ts` (5 testes) para as funções puras. `tests/e2e/onboarding-business-step.spec.ts` (4 testes): 0 violações Axe; telefone local normalizado para E.164 confirmado na BD; URL de Maps não confiável rejeitado (mensagem clara, não avança); link real do Google Maps aceite e avança. Chromium + webkit-mobile.
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

### NEX-032 — Passo horários de trabalho

**Dependências:** NEX-030

**Objetivo**

Implementar passo horários de trabalho sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Dias, início/fim e almoço com defaults. Formulário pré-preenchido com um horário recomendado (dias úteis 09:00–19:00 com almoço 13:00–14:00, sábado 09:00–13:00, domingo fechado) — a dona só revê e confirma, ou ajusta.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. 7 dias num só ecrã (é o desenho do passo 2 do wizard), horários só aparecem quando o dia está marcado como aberto.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Casos inválidos e limites. `tests/unit/hours-step.test.ts` (10 testes: defaults válidos, fim antes/igual ao início, dia fechado com campos vazios, só um limite de almoço preenchido, fim de almoço antes do início, dia aberto sem almoço, limites 00:00/23:59, exatamente 7 dias, merge com defaults, truncagem de `HH:MM:SS`→`HH:MM`). `tests/e2e/onboarding-hours-step.spec.ts` (6 testes): Axe, defaults corretos no ecrã, aceitar defaults persiste as 7 linhas na BD, fim antes do início rejeitado, só um limite de almoço rejeitado, "Voltar" funciona sem exigir dados válidos. Chromium + webkit-mobile.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária. Convenção `day_of_week` (0=domingo..6=sábado, `Date.getDay()`) não estava documentada em lado nenhum — adotada e registada em comentário no código, já que o motor de disponibilidade (`NEX-060`/`061`) provavelmente vai calcular isto a partir de `Date` nativo.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-033 — Passo serviços iniciais

**Dependências:** NEX-030

**Objetivo**

Implementar passo serviços iniciais sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Criação repetida de nome/preço/duração/categoria. Formulário de "adicionar serviço" fica no ecrã após cada submissão bem-sucedida, permitindo adicionar quantos serviços forem precisos antes de avançar; categoria é criada automaticamente se não existir, reaproveitada se já existir.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Lista dos serviços já adicionados + formulário de adicionar mais, sem exigir uma etapa de gestão de categorias separada nesta fase (isso é `NEX-040`).
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Persistência e duplicados. `tests/unit/services-step.test.ts` (7 testes: conversão de preço para cêntimos, vírgula/ponto como separador decimal, nome/preço/duração/categoria inválidos, limites de duração). `tests/e2e/onboarding-services-step.spec.ts` (6 testes): Axe, exige pelo menos 1 serviço para avançar, criação repetida com 2 serviços persistidos corretamente (confirmado na BD), nome de serviço duplicado rejeitado com mensagem clara (sem duplicar na BD), categoria reaproveitada em vez de duplicada, "Voltar" funciona. Chromium + webkit-mobile.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária. Ajuste de configuração ESLint: `@typescript-eslint/no-unused-vars` passou a ter `argsIgnorePattern: '^_'`, formalizando a convenção já usada (`_prevState`) para argumentos exigidos pela assinatura de `useActionState` mas não usados no corpo da função.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-034 — Passo regras recomendadas

**Dependências:** NEX-030

**Objetivo**

Implementar passo regras recomendadas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Aplicar defaults com um toque e permitir edição. 5 `<select>` (intervalo da agenda, intervalo entre clientes, antecedência mínima, janela de marcação, aviso de cancelamento) já carregam com os valores recomendados de `docs/01_PRODUCT_REQUIREMENTS.md` #5 (aplicados automaticamente pelos defaults de coluna em `business_settings` desde `NEX-013`); botão "Usar recomendações" repõe todos com um clique (client-side, via `ref`, sem round-trip ao servidor); todos os campos continuam editáveis livremente antes de submeter.
- Nenhum dado de outro tenant pode ser acedido. Validação server-side confirma que o valor pertence ao conjunto permitido de cada regra, mesmo que o `<select>` nativo já restrinja no cliente (defesa em profundidade — `CLAUDE.md`: "a UI nunca é um controlo de segurança").
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- E2E recomendações. `tests/unit/rules-step.test.ts` (4 testes: defaults aceites, todos os valores permitidos de cada campo aceites, valor fora do conjunto rejeitado mesmo sendo numérico, valor não numérico rejeitado). `tests/e2e/onboarding-rules-step.spec.ts` (5 testes): Axe, valores recomendados corretos no carregamento, editar e persistir um valor diferente do recomendado, **"Usar recomendações" repõe campos editados com um toque**, "Voltar" funciona. Chromium + webkit-mobile.
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

### NEX-035 — Passo publicar link e QR Code

**Dependências:** NEX-031,NEX-033,NEX-034

**Objetivo**

Implementar passo publicar link e qr code sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Slug único, preview, publicar e QR local. Passo 5/5: campo de link editável (pré-preenchido com o slug atual do tenant), pré-visualização ao vivo de `{NEXT_PUBLIC_APP_URL}/b/{slug}` (estrutura definida em `docs/01_PRODUCT_REQUIREMENTS.md` #12), QR Code gerado localmente com a biblioteca `qrcode` (computação pura no cliente, sem chamar nenhum serviço externo) e regenerado a cada alteração do slug. Publicar chama a nova função `security definer` `publish_business` (`supabase/migrations/0005_publish_business.sql`), que deriva `tenant_id` de `current_tenant_id()` (nunca de um parâmetro do cliente) e atualiza `tenants.slug`, `tenants.status = 'active'` e `business_settings.published_at`.
- Nenhum dado de outro tenant pode ser acedido. `tenants` só tinha política `SELECT` para `authenticated` (sem `UPDATE`) — em vez de abrir uma política de `UPDATE` mais ampla, `publish_business` só pode publicar o tenant do próprio chamador; `EXECUTE` revogado de `anon`, concedido só a `authenticated` (padrão de `ADR-008`, adaptado: esta função É suposta ser chamada pela sessão normal do dono, ao contrário de `provision_tenant_owner`).
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Publicar redireciona para `/dashboard`.
- Logs não contêm segredos nem PII desnecessária. `audit_logs` regista `business.published` com o novo slug, sem dados pessoais.

**Testes obrigatórios**

- Slug collision e QR decode. `tests/unit/publish-step.test.ts` (8 testes): normalização de slug (acentos, maiúsculas, espaços/pontuação → hífens), schema Zod. `tests/integration/publish-business.test.ts` (3 testes, contra a BD real): `anon` rejeitado (`42501`); dono publica o próprio tenant (slug, `status=active`, `published_at`, audit log) sem afetar outro tenant; colisão de slug entre tenants devolve `23505`. `tests/e2e/onboarding-publish-step.spec.ts` (6 testes, chromium + webkit-mobile): Axe; preview do link correto; **QR decodificado (via `jsqr` + `pngjs`, lendo o `data:image/png` do `<img>`) confirma que codifica exatamente o link público**; colisão de slug mostra erro amigável e não avança; publicar ativa o tenant e redireciona para `/dashboard`; "Voltar" regressa ao passo 4.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova superfície: função RPC `publish_business`, com autorização e derivação de `tenant_id` conforme acima.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Verificado via teste de integração (RPC como `anon` vs. `authenticated` de tenants diferentes).
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-036 — Teste de usabilidade do onboarding

**Dependências:** NEX-035

**Objetivo**

Implementar teste de usabilidade do onboarding sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Fluxo concluído sem linguagem técnica e em tempo alvo definido.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Sessão observada/documentada.
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
