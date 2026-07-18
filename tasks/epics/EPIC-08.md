# EPIC-08 — Dashboard e agenda da dona

## Objetivo do épico

Entregar **dashboard e agenda da dona** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-080 — Dashboard combinado

**Dependências:** NEX-023,NEX-064

**Objetivo**

Implementar dashboard combinado sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Próxima cliente, cartões e lista do dia. `DashboardPage` (`src/app/(dashboard)/dashboard/page.tsx`) substitui os quatro cartões estáticos por dados reais: "Próxima cliente" (primeira marcação `confirmed`/`presence_confirmed` do dia ainda não terminada, com nome do cliente e itens), "Marcações" (contagem do dia), "Lembretes" (`reminders.status='pending'`) e "Recebido" (`payments.status='paid'` com `paid_at` hoje). Agregação isolada em `buildDashboardSummary` (`src/features/dashboard/domain/summary.ts`), função pura testável sem BD — decide "próxima" e a contagem a partir de uma lista de marcações e do instante atual, injetado como parâmetro. "Lista do dia" completa (múltiplos cartões de marcação) fica para `NEX-081`; esta tarefa entrega o resumo agregado do Fluxo C (`docs/02_UX_FLOWS.md`: "Dona abre o painel. Próxima cliente aparece em destaque.").
- Nenhum dado de outro tenant pode ser acedido. `requireProfile()` (já usado por todo o dashboard) deriva `tenantId` da sessão; toda query filtra por ele — nunca de input do cliente. Confirmado por teste e2e com dois tenants.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Mesmos quatro cartões já existentes, agora com dados reais; "Nenhuma marcação." quando não há próxima.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging novo.

**Testes obrigatórios**

- Queries tenant-scoped e timezone. `tests/unit/dashboard-summary.test.ts`: seleção da próxima marcação ativa (ignora `cancelled`/`no_show`/`completed`), marcação em curso ainda conta como "próxima", contagem do dia só inclui estados ativos. `tests/e2e/dashboard-summary.spec.ts` (dois tenants provisionados reais): confirma que os dados do próprio tenant aparecem e os de outro tenant nunca aparecem na mesma página, ecrã vazio mostra "Nenhuma marcação.", marcação cancelada não conta. Cálculo do "dia" usa `fromZonedTime`/`formatInTimeZone` no timezone do tenant (`business_settings.timezone`, mesmo helper do motor de disponibilidade, `NEX-061`), não o dia UTC.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhum privilégio novo — leitura autenticada de dados já tenant-scoped por RLS.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `createClient()` cookie-scoped (RLS ativa) mais filtro explícito por `tenantId` em cada query — dupla garantia, mesmo padrão de `servicos/page.tsx`.
- Registar risco residual ou decisão temporária. "Recebido"/"Lembretes" ficam sempre em 0 até `EPIC-11` (conclusão financeira) e `NEX-100+` (lembretes automáticos) existirem — as queries já estão corretas, só não há ainda dados reais a popular essas tabelas.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-081 — Cartões de marcação

**Dependências:** NEX-080

**Objetivo**

Implementar cartões de marcação sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Horário, cliente, itens, valor, estados e duas ações rápidas. `AppointmentCard` (`src/features/appointments/AppointmentCard.tsx`) renderiza hora (timezone do tenant), nome do cliente, itens, total (`final_total_cents` se já concluída, senão `expected_total_cents`) e o estado traduzido (`APPOINTMENT_STATUS_LABELS`, `src/features/appointments/domain/appointment-card.ts`). Duas ações (docs/02_UX_FLOWS.md, Fluxo C): "Abrir WhatsApp" (deep link `wa.me` real e funcional, com mensagem de lembrete) e "Concluir" (desabilitado com `title` explicativo — a conclusão real com modal/pagamento é `NEX-110`/`113`, EPIC-11, fora de escopo aqui; a UI final do cartão já existe, só falta ligar o comportamento). Integrado em `/dashboard/agenda` (`src/app/(dashboard)/dashboard/agenda/page.tsx`), que passa de placeholder estático para a lista real de marcações do dia.
- Nenhum dado de outro tenant pode ser acedido. Mesmo padrão de `NEX-080`: `requireProfile()` deriva `tenantId` da sessão, toda query filtra por ele, `createClient()` cookie-scoped com RLS ativa.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Cartões diretos, uma ação de cada vez, sem jargão técnico.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging novo.

**Testes obrigatórios**

- Axe/mobile. `tests/e2e/appointment-card.spec.ts`: conteúdo do cartão (hora/cliente/itens/total/estado), link do WhatsApp aponta para o número real do cliente, zero violações Axe, sem overflow horizontal em viewport estreito (mesmo padrão de `catalog-mobile-layout.spec.ts`, `NEX-044`). `tests/unit/appointment-card.test.ts`: geração do deep link (`+` removido, mensagem URL-encoded), mensagem de lembrete inclui nome/hora, todo valor do enum `appointment_status` tem label em pt-PT.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — leitura autenticada de dados já tenant-scoped.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Herdado de `requireProfile()`/RLS, mesmo padrão de `NEX-080`.
- Registar risco residual ou decisão temporária. Botão "Concluir" fica desabilitado até `NEX-110`/`113` (EPIC-11) implementarem a conclusão/pagamento real — comportamento intencional, não um bug.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-082 — Visualizações dia/semana/mês

**Dependências:** NEX-080

**Objetivo**

Implementar visualizações dia/semana/mês sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Navegação eficiente e responsiva. `resolveCalendarRange`/`shiftCalendarDate`/`formatRangeLabel` (`src/features/appointments/domain/calendar-navigation.ts`, funções puras): calculam limites de dia/semana (segunda a domingo)/mês no timezone do tenant via `fromZonedTime` (mesmo helper do motor de disponibilidade), com navegação anterior/seguinte/hoje âncorada ao início do período (evita deriva em meses de tamanhos diferentes — dia 31 + 1 mês cai em fevereiro, não março). Estado de vista/data vive na URL (`?view=&date=`), não em estado de componente cliente — página inteiramente server-rendered, `<a>` simples para navegação (`typedRoutes` exige rotas estáticas para `<Link>`, mesmo padrão já usado noutras páginas com hrefs dinâmicos).
- Nenhum dado de outro tenant pode ser acedido. Mesmo padrão de `NEX-080`/`081`: `requireProfile()` deriva `tenantId`, toda query filtra por ele.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Três botões de vista (Dia/Semana/Mês) com `aria-current`, navegação Anterior/Seguinte/Hoje, agrupamento por dia com label em pt-PT nas vistas semana/mês.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging novo.

**Testes obrigatórios**

- E2E datas e DST. `tests/unit/calendar-navigation.test.ts` (16 testes): limites de cada vista, semana começa à segunda mesmo ancorando num domingo, mês bissexto, navegação não salta mês em meses mais curtos, e — o núcleo do critério — vistas semana/mês que atravessam as transições de horário de verão de 2026 (`2026-03-29` primavera, `2026-10-25` outono) têm a duração elapsed correta (uma hora a menos/mais). `tests/e2e/agenda-calendar-views.spec.ts`: alternar entre vistas mantém a marcação de hoje visível, navegar um mês em frente esconde-a, "Hoje" traz de volta; navegação dia-a-dia atravessando `2026-03-29` mostra a marcação exatamente no dia certo, com a hora local correta.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — mesma leitura tenant-scoped já existente, só com intervalo de datas maior.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Herdado de `requireProfile()`/RLS.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-083 — Resumo/lista de horários livres

**Dependências:** NEX-061,NEX-080

**Objetivo**

Implementar resumo/lista de horários livres sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Contagem e drawer/lista sem poluir agenda.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Consistência com motor.
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

### NEX-084 — Detalhes, cancelar e reagendar

**Dependências:** NEX-081

**Objetivo**

Implementar detalhes, cancelar e reagendar sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Ações internas com confirmação e auditoria.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Permissões e conflitos.
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

### NEX-085 — Marcação manual completa

**Dependências:** NEX-041,NEX-061,NEX-080

**Objetivo**

Implementar marcação manual completa sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Cliente, itens, slot, valor, observação.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Conflito e cliente existente.
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
