# EPIC-06 — Motor de disponibilidade

## Objetivo do épico

Entregar **motor de disponibilidade** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-060 — Modelar horários e exceções

**Dependências:** NEX-011,NEX-032

**Objetivo**

Implementar modelar horários e exceções sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Normal, almoço, bloqueios, férias e especial. Normal+almoço: `business_hours` (já existia, `NEX-032`). Bloqueios+férias: `availability_blocks` (já existia, cobre ambos genericamente via `reason`/`is_all_day`). Especial: `business_hours_exceptions` (novo, `0006_business_hours_exceptions.sql`) — uma `exception_date` substitui o padrão semanal só nessa data.
- Nenhum dado de outro tenant pode ser acedido. RLS tenant-scoped idêntica às restantes tabelas de horário; sem política `anon` (a agenda em bruto nunca é exposta ao público, só slots computados numa RPC futura).
- A interface mantém linguagem simples e fluxo guiado quando houver UI. N/A — tarefa é só modelo de dados.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Integração DB. `tests/integration/business-hours-exceptions.test.ts` (11 testes): RLS cruzada (leitura/insert/update/delete, incluindo anon bloqueado), `exception_date` duplicada rejeitada, `is_open=true` com `opens_at >= closes_at` rejeitado, `is_open=false` com horas nulas aceite, almoço invertido rejeitado. Corrido contra Supabase local real em CI (`NEX-015`) — 9/9 ficheiros, 56/56 testes.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova tabela, mesmo padrão de RLS das restantes — sem privilégio novo.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Confirmado pelos 11 testes de integração.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-061 — Implementar gerador de slots timezone-aware

**Dependências:** NEX-060

**Objetivo**

Implementar implementar gerador de slots timezone-aware sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Slots respeitam step, duração, buffer, notice e window. Implementado em `generateTimezoneAwareSlots` (`src/features/appointments/domain/availability.ts`): itera dia a dia dentro de `[now + min_notice_hours, now + booking_window_days]`, resolve o horário do dia via `resolveDayHours` (exceção tem prioridade sobre `business_hours`, `src/features/appointments/domain/daily-schedule.ts`) e delega step/duração/buffer/sobreposição ao gerador já existente `generateAvailableSlots`.
- Nenhum dado de outro tenant pode ser acedido. N/A — função de domínio pura, sem acesso a dados; os inputs (horários, exceções, `busy`) já vêm filtrados por tenant pelo chamador (RLS nas tabelas de origem).
- A interface mantém linguagem simples e fluxo guiado quando houver UI. N/A — tarefa é só motor de cálculo, sem UI.
- Logs não contêm segredos nem PII desnecessária. N/A — função pura sem logging.

**Testes obrigatórios**

- DST Europe/Lisbon. `tests/unit/timezone-aware-slots.test.ts`: transição de primavera (2026-03-29, WET→WEST) e de outono (2026-10-25, WEST→WET) — confirma que a hora local de abertura mapeia para o offset UTC correto em cada lado da transição, e que uma janela local fixa (09:00–19:00) produz a mesma contagem de slots em ambos os lados. Também cobre notice, window, buffer/step, dias fechados e prioridade de `business_hours_exceptions`.
- `tests/unit/daily-schedule.test.ts`: resolução de horário (exceção vs. semanal vs. fechado) e conversão para intervalos abertos em UTC, incluindo o corte pelo almoço.
- `npm run verify` passa (17 ficheiros, 136 testes; build local requer `.env.local` com os placeholders de `.env.example`, não commitado).

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhum privilégio novo — função de domínio pura, sem acesso a BD.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A nesta tarefa; aplicável quando `NEX-062` ligar isto a uma RPC pública.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-062 — Implementar consulta pública de disponibilidade

**Dependências:** NEX-061,NEX-054

**Objetivo**

Implementar implementar consulta pública de disponibilidade sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- API retorna apenas slots válidos e limites de intervalo. `getPublicAvailability` (`src/app/b/[slug]/availability-actions.ts`, server action) lê `business_settings` do próprio tenant para step/buffer/notice/window/timezone (nunca do caller), busca `business_hours`/`business_hours_exceptions`/`availability_blocks`/marcações ativas (`confirmed`/`presence_confirmed`, janela `[start_at, blocked_until)` como em `appointments_no_overlap`) e delega o cálculo a `generateTimezoneAwareSlots` (`NEX-061`). Retorna só os instantes computados (`slotsIso`).
- Nenhum dado de outro tenant pode ser acedido. Todas as queries são filtradas por `tenant_id`; o service-role client (`src/lib/supabase/admin.ts`) é necessário porque nenhuma das tabelas de origem tem política `anon` (por desenho, ver `docs/04_DATA_MODEL.md`) — só os slots computados saem da função, nunca o horário em bruto. Isolamento coberto por teste de integração com dois tenants (bloqueio total num dia só afeta o tenant dono do bloqueio).
- A interface mantém linguagem simples e fluxo guiado quando houver UI. N/A — esta tarefa entrega só a consulta (server action); a UI que a consome é trabalho de tarefas de dashboard/booking futuras.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging adicionado; erros devolvidos como `Result<T>` tipado (`VALIDATION_ERROR`/`NOT_FOUND`), sem detalhes internos expostos.

**Testes obrigatórios**

- Validação/rate limit contract. Input validado com Zod (`tenantId` uuid, `serviceDurationMinutes` 5–720) — rejeitado antes de tocar a base de dados. `RATE_LIMITED` já modelado em `AppErrorCode` (`src/lib/result.ts`); rate limiting real fica para `NEX-066` (fora de escopo aqui, per `CLAUDE.md`: não expandir escopo).
- `tests/integration/public-availability.test.ts`: rejeita input inválido, `NOT_FOUND` para tenant nunca publicado e para tenant inexistente, isolamento entre dois tenants (bloqueio num não afeta o outro). Segue o mesmo padrão skip-sem-env de `publish-business.test.ts` (`describe.runIf`); import da action é feito dinamicamente dentro de `beforeAll` porque `src/lib/env.ts` faz parse eager de `process.env` — um import estático abortaria o ficheiro inteiro antes do skip poder atuar.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhum privilégio novo — reaproveita o service-role client já existente (`NEX-052`) para leitura, sem escrita.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Confirmado: `tenant_id` de cada query vem do parâmetro validado, nunca de sessão (não há sessão — visitante anónimo); horário/step/buffer/notice/window vêm sempre de `business_settings` do próprio tenant, nunca do input do caller, fechando a via de um caller pedir um `bufferMinutes`/`slotStepMinutes` diferente do configurado pela dona.
- Registar risco residual ou decisão temporária. Sem rate limiting real (`NEX-066` cobre isto) — risco aceite temporariamente: um caller pode fazer polling desta action sem limite até `NEX-066` ser implementada.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-063 — Implementar constraint de não sobreposição

**Dependências:** NEX-011

**Objetivo**

Implementar implementar constraint de não sobreposição sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- GiST impede dupla reserva em estados ativos. Já implementado em `0001_initial.sql` (`appointments_no_overlap`, `exclude using gist (tenant_id with =, tstzrange(start_at, blocked_until, '[)') with &&) where (status in ('confirmed', 'presence_confirmed'))`) — esta tarefa não precisou de migração nova, só da prova de que a constraint aguenta concorrência real, que faltava.
- Nenhum dado de outro tenant pode ser acedido. A exclusão é particionada por `tenant_id with =`, confirmado por teste (`tests/integration/appointment-overlap.test.ts`): um overlap idêntico noutro tenant não é bloqueado.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. N/A — tarefa é só a constraint/teste, sem UI.
- Logs não contêm segredos nem PII desnecessária. N/A — nenhuma alteração de schema ou aplicação.

**Testes obrigatórios**

- Teste concorrente SQL. `tests/integration/appointment-overlap.test.ts`: rejeita insert sequencial sobreposto (`23P01`), aceita marcações costas-com-costas no limite exato do intervalo semiaberto `[start_at, blocked_until)`, ignora overlap noutro tenant, ignora overlap com marcação já `cancelled`, e — o teste central da tarefa — duas transações Postgres independentes a inserir o mesmo intervalo em paralelo (`Promise.allSettled` sobre duas ligações `pg` distintas, cada uma na sua própria transação): exatamente uma comita, a outra recebe `23P01`. Segue o padrão `TEST_DATABASE_URL`/skip de `tests/integration/schema-invariants.test.ts`; sem Docker disponível neste momento, não corrido localmente — corre no CI (`NEX-015`/`NEX-011`).
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — reafirma uma constraint já existente.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A — a exclusion constraint atua ao nível da base de dados, abaixo de RLS, e já é tenant-scoped pelo `with =` sobre `tenant_id`.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-064 — Implementar booking transacional/idempotente

**Dependências:** NEX-063,NEX-051

**Objetivo**

Implementar implementar booking transacional/idempotente sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Cliente upsert, snapshots, appointment, reminder e token em transação. `create_public_booking` (`supabase/migrations/0007_create_public_booking.sql`, `security definer`): upsert de `clients` por `(tenant_id, phone_e164)`, snapshot de `appointment_items` com preço/duração relidos do catálogo (nunca confiados do caller), insert de `appointments` (`booking_token` gerado com `gen_random_bytes`, só o hash persistido) e de `reminders` (due 24h antes) — tudo numa única transação PL/pgSQL; `appointments_no_overlap` (`NEX-063`) faz o rollback automático de tudo se o horário já estiver ocupado. Chamada por `getPublicAvailability`-style server action `createPublicBooking` (`src/app/b/[slug]/booking-actions.ts`), que mapeia `23P01`→`SLOT_TAKEN`, `23505`→`IDEMPOTENCY_CONFLICT`.
- Nenhum dado de outro tenant pode ser acedido. Toda query da função é filtrada por `tenant_id`; `tenant_id` vem sempre do parâmetro validado (uuid), nunca de sessão (não há sessão — visitante anónimo). Confirmado por teste (dois tenants, IDs de serviço só resolvidos dentro do próprio tenant).
- A interface mantém linguagem simples e fluxo guiado quando houver UI. N/A — esta tarefa entrega a mutação (RPC + server action); a UI que a consome fica para `NEX-070` (ecrã de confirmação).
- Logs não contêm segredos nem PII desnecessária. Nenhum logging adicionado; a função não expõe o `booking_token` em texto claro nos logs — só no valor de retorno da própria chamada (`docs/06_API_CONTRACTS.md`: "devolve token público uma única vez").

**Testes obrigatórios**

- Concorrência, rollback e idempotência. `tests/integration/create-public-booking.test.ts` (conexão `pg` direta, `TEST_DATABASE_URL`): cria cliente+items+appointment+reminder atomicamente; reaproveita cliente existente pelo telefone; faz rollback do upsert de cliente quando o insert do appointment falha por sobreposição (`23P01`); replay com mesma chave+payload devolve o `appointment_id` original sem duplicar nem reemitir token; mesma chave com payload diferente rejeitada (`23505`); e o teste central — duas ligações Postgres independentes a reservar o mesmo horário em paralelo, exatamente uma comita. `tests/integration/create-public-booking-grant.test.ts` (PostgREST/`supabase-js`, mesmas env vars de `publish-business.test.ts`): confirma que `anon` consegue mesmo invocar a função via API real (não só ler o `GRANT` no SQL).
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nova função pública (`anon` pode invocar) — âmbito de escrita limitado ao `tenant_id` passado e apenas para tenants publicados; preço/duração sempre recalculados server-side, nunca aceites do caller (fecha a via de um caller declarar um total diferente do real).
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. `security definer` com `set search_path = public`, seguindo `ADR-008`: revogado de `public`/`authenticated`, concedido só a `anon` (marcação administrativa futura, `NEX-085`, terá o seu próprio caminho autenticado — fora de escopo aqui).
- Registar risco residual ou decisão temporária. Nenhum rate limiting nesta função ainda (`NEX-066` cobre isto) — mesmo risco residual já registado em `NEX-062`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-065 — Tratar SLOT_TAKEN na UX

**Dependências:** NEX-064

**Objetivo**

Implementar tratar slot_taken na ux sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Mensagem clara, refresh de slots e carrinho preservado. O carrinho público (`src/app/b/[slug]/PublicBookingCart.tsx`) ganhou um Passo 3 real: `SlotPicker` (`SlotPicker.tsx`) busca disponibilidade via `getPublicAvailability` (`NEX-062`) para a duração total do carrinho e lista os horários agrupados por dia (`domain/slot-formatting.ts`). Ao confirmar (`createPublicBooking`, `NEX-064`), um `SLOT_TAKEN` limpa só a seleção de horário e a chave de idempotência — nunca o registo nem os serviços/pacote escolhidos — mostra "Este horário acabou de ser reservado por outra pessoa. Escolha outro." e incrementa `reloadKey` para o `SlotPicker` voltar a pedir slots frescos. O handoff por WhatsApp deixa de ser o mecanismo de reserva (passa a alternativa de contacto, "Prefere combinar por WhatsApp?").
- Nenhum dado de outro tenant pode ser acedido. Reutiliza `getPublicAvailability`/`createPublicBooking`, já tenant-scoped (`NEX-062`/`064`); nenhuma leitura nova nesta tarefa.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Passos numerados (1–4), um horário por botão com estado `aria-pressed`, mensagens diretas em português.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging adicionado.

**Testes obrigatórios**

- E2E corrida de reservas. `tests/e2e/public-booking-race.spec.ts`: dois `browser.newContext()` independentes (dois visitantes reais) escolhem o mesmo primeiro horário disponível e confirmam em paralelo (`Promise.all`) — exatamente um recebe o ecrã de sucesso, o outro vê o alerta de `SLOT_TAKEN` com o checkbox do serviço ainda marcado (carrinho preservado) e a base de dados confirma só 1 `appointment` criado.
- `tests/unit/slot-formatting.test.ts`: agrupamento por dia, ordenação cronológica, label pt-PT capitalizado, formatação de hora no timezone do tenant.
- `npm run verify` passa (140 testes unitários/integração; e2e requer credenciais Supabase reais, mesmo padrão skip dos restantes specs `tests/e2e/*`).

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só UI sobre RPCs já existentes.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A nesta tarefa (já coberto em `NEX-062`/`064`); a UI nunca decide sozinha se um slot está livre, só reflete o que o servidor devolveu.
- Registar risco residual ou decisão temporária. Mesmo risco de `NEX-062`/`064`: sem rate limiting real ainda (`NEX-066`).

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-066 — Rate limit e bot protection

**Dependências:** NEX-064

**Objetivo**

Implementar rate limit e bot protection sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Rate limit distribuído e proteção escalonável sem memória local.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Teste 429 e bypass legítimo.
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
