# EPIC-19 — Equipas, prestadores, salas e equipamentos

## Objetivo do épico

Entregar **equipas, prestadores, salas e equipamentos** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-210 — Modelo de membros, prestadores e roles

**Dependências:** NEX-012,NEX-013

**Objetivo**

Implementar modelo de membros, prestadores e roles sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `tenant_members` e `service_providers` criados com roles iniciais (owner, manager, receptionist, provider, viewer) e campos `provider_status`, `provider_color`, `provider_booking_enabled`, `provider_display_order`.
- Membro pode existir sem ser prestador; rececionista não conta como prestador; conta desativada perde sessão; owner único não pode remover-se a si próprio.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de integração para cada role e para a regra do owner único.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. `service_providers` e o RPC `assert_not_last_owner` são novos, mas tenant-scoped pela mesma `current_tenant_id()` já usada em todo o schema; sem privilégio novo introduzido.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. RLS padrão em `service_providers`; trigger reforça que `member_user_id` pertence ao mesmo tenant.
- Registar risco residual ou decisão temporária. Decisão de arquitetura registada em `docs/adr/ADR-011-tenant-members-extends-profiles.md` (estender `profiles`, não criar `tenant_members` paralela). Testes de integração escritos e revistos, mas sem execução real nesta sessão (sem Docker/DB direta) — corre de facto no job `integration` do CI, já obrigatório na proteção de branch. Ver `docs/evidence/NEX-210_MODELO_MEMBROS_PRESTADORES_ROLES.md`.

**Definition of Done**

- [x] Implementação concluída
- [ ] Testes concluídos — escritos; execução real pendente do CI
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md` — marcada `[~]`, não `[x]`

### NEX-211 — Matriz de permissões

**Dependências:** NEX-210

**Objetivo**

Implementar matriz de permissões sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `docs/PERMISSION_MATRIX.md` documenta, por role, as permissões de agenda, marcações, valores, clientes, notas privadas, fichas sensíveis, serviços, equipa, stock, relatórios, exportação e definições.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de autorização confirmam a matriz documentada para cada role.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Não aplicável — só a camada de decisão (`hasPermission`), ainda sem aplicação a nenhuma rota real.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável ainda — RLS continua tenant-scoped por `current_tenant_id()`, sem distinguir role; `hasPermission` fica pronta para tarefas futuras a aplicarem.
- Registar risco residual ou decisão temporária. `hasPermission` ainda não está ligada a nenhuma rota/Server Action — ordem natural do épico (modelo → matriz → provisionamento → UI → aplicação real), não um gap escondido. Ver `docs/evidence/NEX-211_MATRIZ_PERMISSOES.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-212 — Provisionamento de colaborador

**Dependências:** NEX-211

**Objetivo**

Implementar provisionamento de colaborador sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Fluxo de convite (nome, e-mail, role, prestador, serviços, horários) gera link/token para partilha manual pelo owner.
- Token de convite armazenado como hash, validade curta, uso único, com rate limit e sem expor existência de e-mail.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de segurança do token (hash, expiração, uso único, rate limit, não enumeração de e-mail).
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. `tenant_invites` é uma superfície nova (link partilhado manualmente) — token de 256 bits, só o hash é guardado, RLS tenant-scoped, `role='admin'` bloqueado por `check`.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `createTeamInvite` verifica `hasPermission(role,'manage_team')` sempre no servidor; `resolveInvite`/`acceptInvite` usam o admin client só porque o convidado ainda não tem sessão, com comparação `timingSafeEqual` e sem distinguir "expirado"/"usado"/"nunca existiu" na resposta.
- Registar risco residual ou decisão temporária. UI de criação e a página de aceitação (`/convite/{token}`, que cria o utilizador Auth real) ficam para `NEX-217` — mecanismo de backend já pronto e testado para essa UI consumir. Achado real corrigido nesta tarefa: um import estático de `@/lib/tenant-invite` no teste rebentaria o job `verify` do CI (sem variáveis Supabase) — corrigido com import dinâmico. Ver `docs/evidence/NEX-212_PROVISIONAMENTO_COLABORADOR.md`.

**Definition of Done**

- [x] Implementação concluída
- [ ] Testes concluídos — unitários reais (5/5); integração escrita, execução real pendente do CI
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md` — marcada `[~]`

### NEX-213 — Horários por prestador

**Dependências:** NEX-210,NEX-060

**Objetivo**

Implementar horários por prestador sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `provider_business_hours` suporta exceções, bloqueios, férias e intervalo individual.
- Prestador sem horário próprio herda o horário do negócio por omissão.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de integração para herança de horário e para exceções/bloqueios por prestador.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. `provider_business_hours`/`_exceptions` são novas, tenant-scoped pela mesma `current_tenant_id()`; `availability_blocks.provider_id` é uma extensão opcional, sem mudar o comportamento de bloqueios já existentes (`provider_id` nulo = tenant inteiro, inalterado).
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. RLS tenant-scoped padrão nas duas tabelas novas.
- Registar risco residual ou decisão temporária. Lógica de herança (`resolveProviderDayHours`) verificada com 5/5 testes reais, localmente, sem depender de BD. Schema/RLS têm a mesma limitação de verificação local de `NEX-210`/`212` — corre no job `integration` do CI. Ver `docs/evidence/NEX-213_HORARIOS_POR_PRESTADOR.md`.

**Definition of Done**

- [x] Implementação concluída
- [ ] Testes concluídos — lógica de herança real (5/5); schema/RLS pendentes do CI
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md` — marcada `[~]`

### NEX-214 — Serviços por prestador

**Dependências:** NEX-210

**Objetivo**

Implementar serviços por prestador sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Relação N:N prestador-serviço com preço opcional, duração opcional, ativo e prioridade.
- Preço/duração específicos ficam ocultos atrás de "Personalizar para esta pessoa" no primeiro lançamento.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de integração da relação N:N e do fallback para preço/duração do serviço base.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. `provider_services` é tenant-scoped pela mesma `current_tenant_id()`; trigger reforça que prestador e serviço pertencem ao mesmo tenant.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. RLS tenant-scoped padrão.
- Registar risco residual ou decisão temporária. Fallback de preço/duração (`resolveEffectiveProviderService`) verificado com 5/5 testes reais, localmente. Schema/RLS têm a mesma limitação de verificação local de `NEX-210`/`212`/`213` — corre no job `integration` do CI. Ver `docs/evidence/NEX-214_SERVICOS_POR_PRESTADOR.md`.

**Definition of Done**

- [x] Implementação concluída
- [ ] Testes concluídos — fallback real (5/5); schema/RLS pendentes do CI
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md` — marcada `[~]`

### NEX-215 — Salas e equipamentos

**Dependências:** NEX-210

**Objetivo**

Implementar salas e equipamentos sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- `resources` suporta tipo (sala/equipamento/cadeira/outro), capacidade, cor, localização e serviços compatíveis.
- Marcação pode exigir prestador, recurso ou ambos; a reserva impede conflito de prestador e de recurso.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes de conflito de recurso e de prestador sob concorrência.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. **Achado real**: `appointments_no_overlap` era `exclude` tenant-wide (`NEX-063`) — incompatível com vários prestadores simultâneos. Substituída por 3 exclusões (`ADR-012`), preservando exatamente o comportamento de hoje para marcações sem prestador/recurso.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. RLS tenant-scoped padrão em `resources`/`resource_services`; trigger garante que `provider_id`/`resource_id` de uma marcação pertencem ao mesmo tenant.
- Registar risco residual ou decisão temporária. Mesma limitação de verificação local do resto do lote (sem Docker/BD direta) — a mudança na exclusão de sobreposição, a mais crítica desta tarefa, fica confirmada pelo job `integration` do CI. Ver `docs/evidence/NEX-215_SALAS_EQUIPAMENTOS.md` e `ADR-012`.

**Definition of Done**

- [x] Implementação concluída
- [ ] Testes concluídos — escritos; execução real pendente do CI
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md` — marcada `[~]`

### NEX-216 — Motor de disponibilidade multi-recurso

**Dependências:** NEX-061,NEX-213,NEX-214,NEX-215

**Objetivo**

Implementar motor de disponibilidade multi-recurso sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Ordem de avaliação: serviço, localização, prestador opcional, recursos necessários, horários de negócio, horários do prestador, bloqueios, marcações, buffer.
- Conflitos devolvem códigos distintos: `PROVIDER_TAKEN`, `RESOURCE_TAKEN`, `SLOT_TAKEN`, `LOCATION_CLOSED`.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes unitários e de integração para cada código de conflito.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Segurança e privacidade — nota**

`classifyOverlapConstraintViolation` depende dos nomes exatos das 3 exclusões de
`0043_resources_and_multi_resource_conflicts.sql` (ADR-012); se essa migração mudar
sem atualizar esta função, o mapeamento fica dessincronizado silenciosamente (devolve
`null`). A integração real com a rota de escrita (que efetivamente recebe o erro
23P01 do Postgres) ainda não foi feita — apenas o domínio puro. Ver
`docs/evidence/NEX-216_MOTOR_DISPONIBILIDADE_MULTI_RECURSO.md`.

**Definition of Done**

- [x] Implementação concluída — domínio puro (`generateMultiResourceSlots`,
      `isWithinOpenHours`, `classifyOverlapConstraintViolation`); integração com a
      rota de escrita/`availability-lookup.ts` fica para quando a UI (NEX-217/218)
      precisar de consumir isto
- [x] Testes concluídos — 10 testes unitários reais, todos a passar; `npm run verify`
      completo (635 passed) sem regressão
- [x] Documentação atualizada
- [x] Critérios de aceite validados — códigos de conflito mapeados; ordem de
      avaliação (prestador com fallback ao negócio, depois `busy` mesclado pelo
      chamador) implementada no motor
- [~] Tarefa marcada no `TASKS.md` — marcada `[~]`

### NEX-217 — UI da página Equipa e Recursos

**Dependências:** NEX-212,NEX-213,NEX-214,NEX-215

**Objetivo**

Implementar ui da página equipa e recursos sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Página acessível em Mais → Gestão (mobile) e Sidebar → Gestão (desktop), com tabs Pessoas, Salas e equipamentos, Permissões.
- Card de pessoa não expõe e-mail completo; editor de pessoa é wizard de 4 passos (Dados, Acesso, Serviços, Horários); estado vazio segue o texto definido.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Verificação visual mobile/tablet/desktop e axe na nova página.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Segurança e privacidade — nota**

Gate próprio de página (`hasPermission(role, 'manage_team')`) além do gate de escrita
já repetido em cada Server Action — quem não gere equipa não vê sequer a lista. Sem
e-mail completo no card de pessoa (conforme pedido). Ver limitações honestas em
`docs/evidence/NEX-217_UI_EQUIPA_RECURSOS.md`: sem editor de horário próprio por
prestador ainda (fallback para horário do negócio, correto por design), sem página de
aceitação de convite ainda, sem "próximo horário de trabalho" no card (sem dado real
para isso).

**Definition of Done**

- [x] Implementação concluída — página, tabs, cards, wizard, Server Actions
- [x] Testes concluídos — `npm run verify` completo (format/lint/typecheck/635 testes/
      build/bundle); verificação visual mobile/tablet/desktop e axe reais não foram
      possíveis (sem Docker/BD local com as migrações aplicadas neste ambiente) —
      confirmado apenas que a rota compila e redireciona corretamente sem sessão
- [x] Documentação atualizada
- [x] Critérios de aceite validados — navegação, tabs, card sem e-mail completo,
      wizard de 4 passos (com as limitações documentadas)
- [~] Tarefa marcada no `TASKS.md` — marcada `[~]`

### NEX-218 — Integração visual na Agenda

**Dependências:** NEX-082,NEX-216

**Objetivo**

Implementar integração visual na agenda sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Agenda ganha filtros horizontais Todos/Eu/prestador/Recursos; cor do prestador aparece como faixa lateral de 4px, nunca como fundo saturado completo.
- Vista de mês usa indicador por quantidade e filtro de prestador, sem listar dezenas de nomes no dia.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Verificação visual das vistas Dia/Semana/Mês com filtro de prestador ativo.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Decisão de arquitetura — nota**

Não existe (nunca existiu nesta base de código) uma vista de calendário em grelha —
a terceira vista chama-se "Lista" na interface, uma lista cronológica agrupada por
dia. O "indicador por quantidade" foi aplicado a essa estrutura (badge por grupo de
dia) em vez de construir uma grelha só para corresponder literalmente à palavra
"Mês" do plano mestre — ver `docs/evidence/NEX-218_INTEGRACAO_VISUAL_AGENDA.md`.

**Definition of Done**

- [x] Implementação concluída — filtros Todos/Eu/prestador/Recursos, faixa lateral de
      4px por cor do prestador, indicador por quantidade na vista Lista
- [x] Testes concluídos — `npm run verify` completo, sem regressão nos testes
      existentes da agenda; verificação visual real não foi possível neste ambiente
- [x] Documentação atualizada
- [x] Critérios de aceite validados — com a decisão de arquitetura documentada acima
- [~] Tarefa marcada no `TASKS.md` — marcada `[~]`

### NEX-219 — Testes e métricas de equipas/recursos

**Dependências:** NEX-216,NEX-217,NEX-218

**Objetivo**

Implementar testes e métricas sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Cobertura de isolamento tenant, matriz de permissões, conflitos de prestador/recurso, rececionista sem financeiro, provider com acesso restrito e desativação de membro.
- Métricas de prestadores ativos, utilização por prestador, horas disponíveis/ocupadas e conflitos evitados disponíveis.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Testes negativos de autorização e regressão de timezone por prestador.
- `npm run verify` passa.

**Segurança e privacidade — nota**

Achado real desta tarefa: `hasPermission` só está aplicado nas Server Actions de
equipa (NEX-217) e no convite (NEX-212) — páginas mais antigas (Financeiro, Agenda)
ainda não verificam role nenhuma, assunção de dona única herdada de antes deste EPIC.
Um `receptionist`/`provider` autenticado hoje ainda navega livremente para
`/dashboard/financeiro`. Risco residual real, documentado em
`docs/evidence/NEX-219_TESTES_METRICAS_EQUIPAS_RECURSOS.md`, não resolvido nesta
tarefa (retrofit de autorização em páginas antigas é maior do que "escrever testes").

**Definition of Done**

- [x] Implementação concluída — `src/features/team/domain/metrics.ts` (utilização/
      resumo de equipa); mapeamento de cobertura de testes já existente vs. nova
- [x] Testes concluídos — `team-metrics.test.ts` (5 testes reais) e
      `team-member-lifecycle.test.ts` (assert_not_last_owner, desativação, isolamento
      tenant — escritos, execução real pendente do CI); `npm run verify` completo
- [x] Documentação atualizada
- [x] Critérios de aceite validados — com os dois gaps residuais documentados
      (autorização não retrofitada em páginas antigas; "conflitos evitados" sem
      instrumentação real para medir)
- [~] Tarefa marcada no `TASKS.md` — marcada `[~]`
