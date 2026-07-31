# NEX-205 — E2E completo da criação manual

## Objetivo

Cobrir de ponta a ponta o wizard de marcação manual (`NEX-085`,
`NewAppointmentWizard.tsx`): cliente existente, nova cliente, serviço, pacote,
extras, data, slot, observação, recorrência simples, sucesso, e a marcação
visível na agenda. A única cobertura prévia
(`manual-booking-client-suggestion.spec.ts`, `NEX-092`) para no passo de
seleção de cliente.

## Implementação

Criado `tests/e2e/manual-booking-wizard-complete.spec.ts`, marcado `@critical`
(mesmo padrão de `appointment-completion.spec.ts` e
`manual-booking-client-suggestion.spec.ts` — é um dos fluxos centrais do
produto, a dona a criar uma marcação para uma cliente presencial/telefónica).

Dois testes, cobrindo todos os ramos pedidos entre os dois:

1. **Nova cliente, serviço único, sem recorrência** — cria cliente nova
   (nome/telemóvel/e-mail), seleciona um serviço, escolhe explicitamente o
   dia no calendário e um horário, preenche observação, confirma, chega ao
   ecrã de sucesso ("Reservado para Carolina Nova."), volta à agenda e
   confirma o cartão da marcação visível lá — mais uma verificação direta na
   base de dados (`appointments.source = 'admin'`).
2. **Cliente existente, pacote + extra, recorrência semanal simples** —
   pesquisa e seleciona uma cliente já existente, escolhe um pacote (aba
   Pacotes) e adiciona um serviço extra não incluído nele (confirma que o
   serviço já incluído aparece desativado, não como extra separado), ativa
   "Repetir esta marcação" (semanal, 3 ocorrências), revê as ocorrências sem
   conflitos, confirma a série. Como uma série semanal de 3 ocorrências
   atravessa ~2 semanas, a prova de sucesso é feita diretamente na base de
   dados (3 `appointments` com o mesmo `recurring_series_id`, `client_id`
   correto, e `appointment_items` com as descrições do pacote e do extra) em
   vez de depender de qual data a agenda mostra por omissão.

## Bug real encontrado — motor de disponibilidade (fora de âmbito desta tarefa)

Ao escrever e correr o segundo teste, a confirmação da série falhava sempre
com "Este horário já está ocupado." nas 3 ocorrências, mesmo num tenant
recém-criado sem nenhuma marcação. Investigação (não assumida — lida linha a
linha em `src/features/appointments/domain/availability.ts`,
`recurrence.ts`, `recurrence-conflicts.ts`) confirmou a causa raiz:

`generateTimezoneAwareSlots` (`NEX-061`) calcula, para cada dia, `windowStartMs
= Math.max(interval.startMs, earliestMs)`, onde `earliestMs = nowMs +
minNoticeHours horas`. **Quando é `earliestMs` (não o horário de abertura do
negócio) que decide o início da janela do dia — o caso normal para "hoje",
sempre que ainda faltam horas de expediente — a primeira vaga do dia fica
ancorada ao milissegundo exato em que `Date.now()` foi chamado, sem
arredondar à grelha de `slot_interval_minutes`.** Isto significa que:

1. Duas chamadas separadas a `computeAvailableSlotsMs` para o mesmo dia
   ("hoje") — uma ao carregar o passo de horário, outra ao verificar
   conflitos de recorrência momentos depois — quase nunca produzem o mesmo
   valor exato em milissegundos, porque cada uma lê `Date.now()`
   independentemente.
2. `generateRecurrenceOccurrences` copia a hora exata (`HH:mm:ss`) da vaga
   escolhida para as datas futuras da série — se essa hora for um artefacto
   tipo "16:43:07" (em vez de um valor limpo como "16:30:00"), nunca vai
   coincidir com a grelha limpa, ancorada à meia-noite, usada nos dias
   futuros (onde é o horário de abertura, não `earliestMs`, que decide o
   início — uma grelha estável).
3. Resultado: **qualquer série de recorrência cuja primeira ocorrência caia
   em "hoje" mostra falsos conflitos em todas as ocorrências**, mesmo sem
   nenhuma marcação real a colidir.

**Não corrigido nesta tarefa** — a correção correta (arredondar
`windowStartMs` para cima até à próxima marca da grelha quando vem de
`earliestMs`) altera o motor de disponibilidade central
(`generateAvailableSlots`/`generateTimezoneAwareSlots`), partilhado por
**todos** os fluxos de marcação (pública, manual, resumo de horários livres
do `NEX-083`) — um raio de impacto muito maior do que esta tarefa (corrigir
specs E2E) justifica tocar sem uma tarefa e revisão dedicadas. Em vez disso,
o teste evita deliberadamente o cenário (escolhe um dia via "Mês seguinte",
cuja grelha é estável por depender do horário de abertura, não de
`earliestMs`) e documenta o achado aqui para decisão futura — candidato
natural a uma tarefa própria (ex.: `NEX-121` revisitado, ou uma nova
correção de `NEX-061`).

**Efeito colateral também real, não só de teste**: a UI de horários
(`AvailabilityCalendar`) provavelmente já mostra, hoje em produção, um
primeiro horário "de hoje" com um minuto estranho (ex.: "16:43" em vez de
"16:30"/"17:00") sempre que o limite de aviso mínimo cai a meio de um
intervalo de grelha — não verificado visualmente nesta tarefa, mas seria a
manifestação do mesmo bug visível diretamente à dona.

## Testes obrigatórios

- Os 2 testes novos a passar de forma estável contra a app real (corridos
  duas vezes seguidas para confirmar que não são intermitentes — ambas as
  vezes 2/2 verde).
- Verificação com `--grep @critical --project=chromium` (mesmo filtro do job
  `e2e-critical` do CI) — os 2 testes são apanhados corretamente.
- `npm run verify` (ver fecho do lote).

## Definition of Done

- [x] Implementação concluída — `tests/e2e/manual-booking-wizard-complete.spec.ts`, `@critical`
- [x] Testes concluídos — 2/2 estável, corrido duas vezes
- [x] Documentação atualizada — bug do motor de disponibilidade documentado aqui, não escondido
- [x] Critérios de aceite validados — todos os ramos pedidos cobertos entre os dois testes
- [x] Tarefa marcada no `TASKS.md`
