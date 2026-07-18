# EPIC-05 — Página pública e pré-cadastro

## Objetivo do épico

Entregar **página pública e pré-cadastro** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-050 — Criar página pública por slug

**Dependências:** NEX-035

**Objetivo**

Implementar criar página pública por slug sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Dados públicos mínimos, morada, contacto e booking integrado. `src/app/b/[slug]/page.tsx` (Server Component, cliente Supabase sem sessão = `anon`): nome da profissional, morada completa, telefone (CTA "Marcar por WhatsApp" com mensagem pré-preenchida via `wa.me`, e "Ligar agora" via `tel:`), link opcional para mapa (`maps_url`, já validado na escrita — `NEX-031`). "Booking integrado": mostra o catálogo completo publicado (categorias visíveis → serviços ativos → pacotes ativos, com preço/duração), que alimenta a seleção interativa — essa seleção (checkboxes) e o carrinho fixo com total são especificamente o escopo de `NEX-053`/`NEX-054`, já implementados no código (`PublicBookingCart.tsx`, construído fora do processo formal a pedido do dono para uma demonstração — ver `docs/evidence/`) mas cujos testes formais ficam para essas tarefas, não duplicados aqui.
- Nenhum dado de outro tenant pode ser acedido. Sem migração nova — reutiliza as políticas RLS públicas já existentes desde `NEX-012` (`tenants.status='active'`, `business_settings.published_at is not null`, `service_categories.is_visible`, `services`/`packages.is_active`). Não seleciona `business_settings.email` (mais privado que o telefone, que já é pensado para contacto público).
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Tenant suspenso/não publicado. `tests/e2e/public-business-page.spec.ts` (5 testes, chromium + webkit-mobile, todos através de pedidos anónimos reais — sem cookies de sessão — que exercitam a fronteira RLS `anon` na prática, tal como o resto da suite): mostra nome/morada/contacto/catálogo para tenant publicado (200); Axe 0 violações; `tenants.status='suspended'` → 404; tenant `active` mas nunca publicado (`published_at` nulo) → 404; slug desconhecido → 404.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma nova superfície de escrita — só leitura pública já coberta por RLS existente.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Confirmado pelos 4 cenários (publicado/suspenso/não publicado/inexistente) em `public-business-page.spec.ts`.
- Registar risco residual ou decisão temporária. Ver "Riscos residuais" na evidência — `PublicBookingCart.tsx` (seleção+carrinho) ainda sem testes formais próprios, previstos em `NEX-053`/`NEX-054`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-051 — Criar pré-cadastro temporário

**Dependências:** NEX-050

**Objetivo**

Implementar criar pré-cadastro temporário sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Nome/telefone obrigatórios; e-mail opcional; nada em clients antes do booking. `PreRegistrationStep.tsx` — Passo 1 do fluxo público, antes do catálogo (segue `docs/02_UX_FLOWS.md`, Fluxo B). Nome e telemóvel `required` (HTML nativo — não há round-trip ao servidor neste componente para validar "obrigatório" de outra forma); `src/lib/validation/client.ts#clientContactSchema` (reforçado nesta tarefa: nome ≥2 carateres, telefone normalizado para E.164 via `normalizePhoneE164`, e-mail opcional mas validado se preenchido). **Nada é escrito no servidor** — dados ficam em estado React até ao "Confirmar" (que continua a ser só um link `wa.me`, sem motor de marcação); confirmado por teste que expulsa a aba a meio e verifica `clients` vazio.
- Nenhum dado de outro tenant pode ser acedido. N/A — sem escrita nesta tarefa.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Passo 1 (dados) → Passo 2 (escolher) → Passo 3 (confirmar), com "Alterar dados" para voltar; mensagem de WhatsApp agora personalizada com o nome do cliente.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Abandono sem poluir clientes. `tests/unit/client-contact.test.ts` (9 testes, novo): normalização de telefone E.164, e-mail opcional/inválido, nome curto/vazio, telefone irreconhecível. `tests/e2e/public-pre-registration.spec.ts` (9 testes, chromium + webkit-mobile): Axe; nome/telefone marcados `required`; nome com 1 caráter rejeitado; telefone irreconhecível rejeitado; e-mail inválido rejeitado; avança só com nome+telefone (e-mail vazio); "Alterar dados" volta ao formulário; **completar o pré-cadastro e abandonar antes de "Confirmar" não escreve nenhuma linha em `clients`**.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma nova superfície de escrita.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-052 — Implementar draft e recuperação

**Dependências:** NEX-051

**Objetivo**

Implementar implementar draft e recuperação sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Draft até 24h, token hash, payload protegido; mesmo dispositivo sem e-mail. Reutiliza a tabela `booking_drafts` já existente (`0001_initial.sql`) — `resume_token_hash` (SHA-256, o token nunca é guardado), `encrypted_payload` (AES-256-GCM, `src/lib/booking-draft-crypto.ts`), `expires_at` já limitado a 24h por `CHECK`. Retoma via `localStorage` (`nexora-draft-{slug}`) no mesmo browser, sem qualquer passo de e-mail.
- Nenhum dado de outro tenant pode ser acedido. `saveBookingDraft`/`resumeBookingDraft` (`src/app/b/[slug]/draft-actions.ts`) filtram sempre por `tenant_id` explícito (validado como tenant ativo) via cliente `service_role` (`src/lib/supabase/admin.ts`) — nunca por input livre interpretado como identidade.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Retoma é transparente — o visitante nem nota, volta direto ao Passo 2 com o que tinha escolhido.
- Logs não contêm segredos nem PII desnecessária. Erros devolvidos via `Result<T>` genérico; payload nunca é logado.

**Testes obrigatórios**

- Expiry, token inválido e limpeza. `tests/e2e/public-booking-draft.spec.ts` (3 testes, chromium + webkit-mobile): retoma restaura registo+seleção e reutiliza o mesmo token ao editar (sem linhas órfãs); token desconhecido é ignorado sem crash e removido do `localStorage`; rascunho expirado é rejeitado **e a linha é apagada de `booking_drafts`** (limpeza preguiçosa, on-access — sem cron novo). `tests/unit/booking-draft-crypto.test.ts` (9 testes): round-trip, unicidade de token, determinismo do hash, falha perante ciphertext adulterado.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova superfície: `booking_drafts` acedida por cliente `service_role` a partir de Server Actions públicos (sem sessão) — mitigado por validação Zod do payload, verificação de tenant ativo antes de escrever, e cifra do payload em repouso.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A a RLS (cliente `service_role` bypassa RLS por desenho, dado não existir sessão de visitante anónimo a que uma policy se pudesse ligar) — autorização feita em código (`tenant_id` explícito + `status='active'`).
- Registar risco residual ou decisão temporária. Ver evidência (`docs/evidence/NEX-052_DRAFT_RECOVERY.md`, "Riscos residuais"): rascunhos cujo token se perde nunca são fisicamente apagados antes de expirar (sem cron), risco de armazenamento aceite para o MVP.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-053 — Criar seletor Serviços/Pacotes

**Dependências:** NEX-043,NEX-050

**Objetivo**

Implementar criar seletor serviços/pacotes sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Checkboxes, categorias, pacotes e extras.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Mobile, teclado, cálculo.
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

### NEX-054 — Criar carrinho fixo

**Dependências:** NEX-053

**Objetivo**

Implementar criar carrinho fixo sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Quantidade, duração, total e continuar; sem float.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Unit + visual.
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
