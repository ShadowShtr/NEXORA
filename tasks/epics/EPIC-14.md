# EPIC-14 — Definições e simplicidade operacional

## Objetivo do épico

Entregar **definições e simplicidade operacional** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-140 — Central de definições em cartões

**Dependências:** NEX-023,NEX-035

**Objetivo**

Implementar central de definições em cartões sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Negócio, agenda, marcações, lembretes, pagamentos, aparência, dados.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Axe/mobile.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só reorganiza páginas e queries já existentes em 7 rotas novas, sem tabela/RPC nova.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Cada subpágina nova chama `requireProfile()` e filtra por `tenant_id`, mesmo padrão de sempre.
- Registar risco residual ou decisão temporária. Âmbito reduzido por decisão do dono: só reorganiza o que já existe em 7 categorias; 3 delas (Negócio, Pagamentos, Dados) ficam com placeholder "em breve" porque construir esses formulários pela primeira vez expandiria o escopo desta tarefa. Ver `docs/evidence/NEX-140_CENTRAL_DEFINICOES.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-141 — Defaults e “usar recomendações”

**Dependências:** NEX-140

**Objetivo**

Implementar defaults e “usar recomendações” sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Configuração rápida sem termos técnicos.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Reset/undo.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só expõe 5 colunas já existentes de `business_settings` (já editáveis uma vez no onboarding, NEX-034) para edição contínua.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `updateBookingRules` usa `requireProfile()` + `.eq('tenant_id', tenantId)`, mesmo padrão de `submitRulesStep` (onboarding) e de todas as outras actions de definições.
- Registar risco residual ou decisão temporária. Nenhum.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-142 — Pré-visualização da página pública

**Dependências:** NEX-140

**Objetivo**

Implementar pré-visualização da página pública sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Mudanças visuais sem publicar acidentalmente.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Draft/publish.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova função `getOptionalProfile()` (`src/lib/auth/require-profile.ts`) — variante de `requireProfile()` que devolve `null` em vez de redirecionar, necessária porque `/b/[slug]` é a única página pensada para uma visitante sem sessão nenhuma. Não cria privilégio novo: só permite que a página pública reconheça quando quem está a visitar é a própria dona do tenant.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. A pré-visualização de horários lê `business_hours` diretamente (não via `get_public_business_hours`) só quando `isOwnerPreview` é verdadeiro — a política RLS autenticada (`business_hours_select`, `tenant_id = current_tenant_id()`) já garante que isto só devolve dados do próprio tenant da sessão, nunca de outro. Testado com dois tenants/donas diferentes (`tests/integration/public-profile-owner-preview.test.ts`): a dona do tenant A nunca vê horários do tenant B, e uma visitante anónima continua a ver "página não disponível" para um tenant não publicado, exatamente como antes.
- Registar risco residual ou decisão temporária. A pré-visualização cobre a página pública inicial (`/b/[slug]`) e o `get_public_business_hours`, que era a lacuna concreta encontrada (a dona não conseguia pré-visualizar os horários antes de publicar, só o resto da página). O fluxo completo de marcação (`/b/[slug]/servicos` → `horario` → `dados` → `resumo`) não foi estendido com o mesmo tratamento — services/packages já funcionam para a dona via a sua própria política autenticada (não dependem de `published_at`), mas uma tentativa real de confirmar uma marcação de teste falharia no fim (`create_public_booking` continua a exigir publicação), por desenho e sem alteração aqui. Ver `docs/evidence/NEX-142_PRE_VISUALIZACAO_PAGINA_PUBLICA.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-143 — Confirmações e desfazer

**Dependências:** NEX-140

**Objetivo**

Implementar confirmações e desfazer sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Ações destrutivas confirmam; ações reversíveis oferecem undo.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- E2E.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só adiciona um passo de confirmação na UI antes de ações de remoção já existentes, sem alterar as RPCs/actions em si.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Inalterado.
- Registar risco residual ou decisão temporária. NEX-142 (pré-visualização) foi explicitamente deixada de fora por decisão da dona; esta tarefa não depende dela. Ver `docs/evidence/NEX-143_CONFIRMACOES_DESFAZER.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-144 — Ajuda contextual curta

**Dependências:** NEX-140

**Objetivo**

Implementar ajuda contextual curta sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Explicação sob demanda, sem tour obrigatório.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Usabilidade.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só texto estático explicativo, sem dado novo, RPC ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — `HelpTip` é um componente puramente de apresentação, sem ligação a `tenant_id` ou dados do servidor.
- Registar risco residual ou decisão temporária. Âmbito reduzido por não expandir escopo: só cobre os 5 campos técnicos de `BookingRulesForm` (os únicos rótulos jargão-pesados sem nenhuma explicação já visível na app — os outros formulários de definições já têm texto de apoio sempre visível, ex. `NoShowPolicyForm`, `ReminderTemplateForm`). Ver `docs/evidence/NEX-144_AJUDA_CONTEXTUAL.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
