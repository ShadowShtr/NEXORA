# EPIC-18 — Alinhar documentação, QA e design foundations

## Objetivo do épico

Entregar **alinhar documentação, QA e design foundations** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-200 — Atualizar documentos de produto e UX

**Dependências:** Nenhuma

**Objetivo**

Implementar atualizar documentos de produto e ux sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `README.md`, `docs/01_PRODUCT_REQUIREMENTS.md`, `docs/02_UX_FLOWS.md`, `docs/03_ARCHITECTURE.md`, `docs/04_DATA_MODEL.md` e `TASKS.md` deixam de descrever o projeto como "esqueleto inicial".
- Fluxo público paginado, Route Handler de reserva e E2E crítico ficam documentados; "pacote de serviços" e "pack de sessões" são explicitamente distinguidos.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Verificação de links internos e markdown lint, caso configurado.
- Revisão cruzada da documentação contra rotas e testes atuais.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Não aplicável — só documentação.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável.
- Registar risco residual ou decisão temporária. Nenhum — ver `docs/evidence/NEX-200_ATUALIZAR_DOCUMENTOS_PRODUTO_UX.md` para as 5 lacunas encontradas e corrigidas.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-201 — Inventário único de funcionalidades e rotas

**Dependências:** NEX-200

**Objetivo**

Implementar inventário único de funcionalidades e rotas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `docs/FEATURE_ROUTE_INVENTORY.md` criado com capacidade, rota, componente principal, tabelas, actions/RPC, flag, estado e cobertura de teste (unitário/integração/E2E) e documentação por linha.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Revisão cruzada do inventário contra as rotas e flags reais do código.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Não aplicável — só documentação.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável.
- Registar risco residual ou decisão temporária. ~15 tarefas sem ficheiro de evidência próprio localizável, marcadas "não confirmado" em vez de adivinhadas — ver `docs/evidence/NEX-201_INVENTARIO_FUNCIONALIDADES_ROTAS.md`.

**Definition of Done**

- [x] Implementação concluída — `docs/FEATURE_ROUTE_INVENTORY.md`
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-202 — Tokenizar espaçamento, radius e elevação

**Dependências:** NEX-150

**Objetivo**

Implementar tokenizar espaçamento, radius e elevação sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Tokens de espaçamento (`--space-1` a `--space-12`) e de radius (`--radius-sm` a `--radius-pill`) adicionados a `globals.css` sem alterar o visual já aprovado.
- Tokens aplicados a `Button`, `Card`, `BottomSheet`, `PageHeader`, `FilterChip` e `MetricCard`, sem perda de fidelidade nem elementos encostados.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Comparação visual antes/depois nos componentes partilhados, sem regressão.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Não aplicável — só tokens CSS.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável.
- Registar risco residual ou decisão temporária. `PageHeader` e `MetricCard` não têm componente/valor alinhado à escala proposta — ver `docs/evidence/NEX-202_TOKENIZAR_ESPACAMENTO_RADIUS.md` para o detalhe e a decisão de não forçar mudança visual.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-203 — Criar harness de regressão visual

**Dependências:** NEX-202

**Objetivo**

Implementar criar harness de regressão visual sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Harness Playwright com capturas determinísticas cobre login, Início, Agenda (dia/semana), Clientes, ficha de cliente, Serviços, Financeiro, Lembretes, Mais, Definições e o fluxo público completo (página, serviços, horários, resumo, confirmação).
- Não depende de Percy, Chromatic ou qualquer serviço externo pago.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Execução local e em CI das capturas determinísticas.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Não aplicável — só testes e workflow de CI.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável.
- Registar risco residual ou decisão temporária. Mecânica provada localmente (16/16 capturas sem erro), mas sem baselines Linux reais ainda — só o CI pode gerá-las corretamente (nome do ficheiro de snapshot inclui a plataforma; uma baseline gerada localmente no Windows nunca seria usada na comparação Linux). Ver `docs/evidence/NEX-203_HARNESS_REGRESSAO_VISUAL.md`.

**Definition of Done**

- [x] Implementação concluída — `tests/e2e/visual-regression.spec.ts` + `.github/workflows/visual-regression.yml`
- [ ] Testes concluídos — mecânica provada; baselines Linux reais pendentes de `workflow_dispatch` da dona
- [x] Documentação atualizada
- [ ] Critérios de aceite validados — falta baseline real para haver "regressão" a detetar
- [ ] Tarefa marcada no `TASKS.md` — marcada `[~]`, não `[x]`

### NEX-204 — Corrigir specs E2E não críticas desatualizadas

**Dependências:** NEX-178

**Objetivo**

Implementar corrigir specs e2e não críticas desatualizadas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `appointment-completion-discount.spec.ts`, `appointment-completion-extras.spec.ts` e `appointment-card.spec.ts` refletem o fluxo real de conclusão (bottom sheet), não a UI inline antiga.
- Outros specs identificados com o mesmo pressuposto desatualizado também são corrigidos.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Specs E2E corrigidos a passar de forma estável contra a UI atual.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Não aplicável ao trabalho de teste; a correção do bug de desconto não introduz entrada/privilégio novo, só corrige a conversão euro→cêntimos já esperada pela RPC.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — a RPC `complete_appointment` (security definer, `0017_complete_appointment_discount.sql`) já validava/clampava o valor; o bug era só na camada de apresentação.
- Registar risco residual ou decisão temporária. Bug real encontrado e corrigido (desconto fixo a 1/100 do valor pretendido) — ver `docs/evidence/NEX-204_CORRIGIR_SPECS_E2E_DESATUALIZADAS.md`. Nenhum risco residual conhecido.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-205 — E2E completo da criação manual

**Dependências:** NEX-085,NEX-204

**Objetivo**

Implementar e2e completo da criação manual sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Spec cobre cliente existente e nova cliente, serviço, pacote, extras, data, slot, observação e recorrência simples.
- Sucesso do fluxo termina com a marcação visível na agenda.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Novo spec E2E completo da criação manual de marcação, cobrindo todos os ramos descritos.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Não aplicável — só teste novo.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável.
- Registar risco residual ou decisão temporária. Bug real encontrado no motor de disponibilidade (`generateTimezoneAwareSlots`/`NEX-061`): a primeira vaga de "hoje", quando decidida por `min_notice_hours` em vez do horário de abertura, não é arredondada à grelha de `slot_interval_minutes` — fica ancorada ao milissegundo exato de `Date.now()`, o que quebra a verificação de conflitos de recorrência (`NEX-121`) sempre que a primeira ocorrência de uma série cai em "hoje". **Não corrigido** — altera o motor partilhado por todos os fluxos de marcação, risco maior do que esta tarefa justifica; candidato a tarefa própria futura. Ver `docs/evidence/NEX-205_E2E_COMPLETO_CRIACAO_MANUAL.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
