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

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Definition of Done**

- [ ] Implementação concluída
- [ ] Testes concluídos
- [ ] Documentação atualizada
- [ ] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md`

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

**Definition of Done**

- [ ] Implementação concluída
- [ ] Testes concluídos
- [ ] Documentação atualizada
- [ ] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md`

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

**Definition of Done**

- [ ] Implementação concluída
- [ ] Testes concluídos
- [ ] Documentação atualizada
- [ ] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md`

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

**Definition of Done**

- [ ] Implementação concluída
- [ ] Testes concluídos
- [ ] Documentação atualizada
- [ ] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md`

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
