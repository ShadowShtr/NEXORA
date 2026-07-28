# NEX-178 — Concorrência do cliente em `/resumo` e deadlock real do Postgres

## Estado

Resolvido em `fix/public-booking-concurrency` (PR #138), rebaseado sobre `main`
após o merge de `fix/public-booking-concurrency` (#135) e `fix/public-flow-stale-tests`
(#134). Ver `docs/evidence/BUG_2026-07-28_PUBLIC_BOOKING_CLIENT_CONCURRENCY.md` para
o registo integral da investigação original (hipóteses descartadas, evidência
passo a passo) — este documento é o resumo de fecho da tarefa, com os dois
bugs reais encontrados, a causa raiz de cada um, a correção aplicada e a
validação.

## Contexto

`public-booking-race.spec.ts` (NEX-065): duas visitantes disputam o mesmo
horário, confirmando em simultâneo (`Promise.all([confirmA.click(),
confirmB.click()])`). O comportamento esperado é uma vencedora e uma
perdedora com mensagem clara — nunca as duas presas, nunca as duas a
"ganhar". O PR #135 (mesclado em `main` antes de estar resolvido, porque
`tests/e2e/**` não corre em CI) deixou este teste a falhar de propósito como
regressão. Esta tarefa resolve os dois bugs reais por trás dessa falha.

## Bug 1 — estado do cliente React nunca conclui sob confirmação concorrente

### Sintoma

Ambas as páginas ficavam presas no botão "A confirmar…" indefinidamente
(mais de 30s), apesar de o `POST /api/public/business/{slug}/bookings`
completar corretamente nas duas — confirmado com `page.on('response', ...)`
do Playwright: uma página recebia 200, a outra 409, sempre.

### Causa raiz

`ResumoClient.tsx` fazia o `fetch()` inline dentro de `handleConfirm()` e
mantinha o resultado em vários `useState` booleanos independentes
(`isBooking`, `bookingError`, `confirmedBooking`), sem `AbortController`, sem
`finally` garantido, e sem um contrato de resposta único partilhado com o
servidor. Essa combinação podia deixar o componente sem nunca transicionar
para um estado final, dependendo da ordem exata de resolução das promises
sob confirmação concorrente — não foi isolada uma única linha "culpada"; o
desenho do fluxo (transporte HTTP, interpretação da resposta e estado da UI
todos misturados na mesma função, sem uma máquina de estados explícita) era
estruturalmente propenso a isto.

### Correção

- `src/app/b/[slug]/domain/public-booking-result.ts` — tipo
  `PublicBookingResult` discriminado (`ok: true, code: 'BOOKING_CREATED'` |
  `ok: false, code: 'SLOT_TAKEN' | ...`), devolvido diretamente pelo Route
  Handler (`src/app/api/public/business/[slug]/bookings/route.ts`) como corpo
  da resposta, incluindo no 409 — nunca corpo vazio.
- `src/app/b/[slug]/domain/submit-public-booking.ts` — `submitPublicBooking()`,
  cliente HTTP isolado do React. Lê o corpo com `response.text()` antes de
  `JSON.parse` (uma resposta vazia, HTML de erro de proxy, ou stream truncado
  falha com erro claro em vez de ficar pendurada em `response.json()`).
- `src/app/b/[slug]/domain/confirmation-state.ts` — `confirmationReducer`
  puro (`idle → submitting → success | conflict | error`), testável sem
  renderizar React.
- `ResumoClient.tsx` — `handleConfirm()` usa `useReducer` + `AbortController`
  (timeout de 10s) + `finally` obrigatório (liberta a ref de submissão
  sempre, mesmo em erro/abort). Deliberadamente **sem** `startTransition`: é
  um pedido de rede com resultado real que o utilizador espera, não uma
  atualização visual adiável.

### Testes

`tests/unit/confirmation-state.test.ts` e
`tests/unit/submit-public-booking.test.ts` — cobrem todas as transições do
reducer e o cliente HTTP (200, 409, corpo vazio, JSON inválido, abort),
mockando `fetch` global, sem depender de rede real nem de React.

## Bug 2 — deadlock real do Postgres sob alta concorrência (`40P01`)

### Sintoma

Depois de corrigido o Bug 1, uma execução em ~20-40 do teste de corrida ainda
falhava — não com as páginas presas, mas com uma das duas a mostrar "Não foi
possível concluir a marcação." (erro genérico) em vez de "reservado por
outra pessoa" (`SLOT_TAKEN`).

### Causa raiz

Log do servidor (`logEvent`, `src/lib/logger.ts`) capturado durante um lote
de 40 execuções concorrentes: `{"code":"40P01", level":"error",
"event":"booking.public.failed"}`. **`40P01` é o código Postgres para
`deadlock_detected`** — sob contenção real suficiente (múltiplos `INSERT`
simultâneos disputando os mesmos locks), o próprio Postgres escolhe uma
transação como vítima de deadlock e aborta-a, mesmo que essa transação não
fosse a que deveria perder a vaga por regra de negócio (isso é decidido
depois, pela exclusion constraint `appointments_no_overlap`, não pelo
deadlock). O route handler tratava qualquer código de erro não mapeado como
`INTERNAL_ERROR` genérico, sem distinguir este caso recuperável.

Isto **não é o mesmo bug do idempotency check** (`23505`) nem da exclusion
constraint (`23P01`) — é uma terceira categoria de erro, específica de
contenção de locks, que só aparece sob concorrência real alta (não apareceu
em nenhuma das execuções com poucos workers/pouca carga).

### Correção

`src/app/api/public/business/[slug]/bookings/route.ts` — uma única
tentativa de retry da RPC `create_public_booking`, especificamente para
`error.code === '40P01'`. Justificação: deadlocks do Postgres resolvem-se por
definição com um retry — o próprio motor de banco de dados já abortou uma
das duas transações em conflito; ao repetir, a transação concorrente já
terá committado ou feito rollback, pelo que o retry resolve sempre para um
resultado real (reserva criada, ou `23P01` legítimo), nunca para outro
deadlock da mesma disputa.

### Validação do retry

Confirmado empiricamente, não apenas por inferência: num lote de 40
execuções concorrentes, o evento `booking.public.deadlock_retry` disparou 2
vezes no log do servidor, e **zero eventos de nível `error`** resultaram
dessas execuções — ambos os retries resolveram com sucesso, e o teste
completo (40/40) passou.

## Achado secundário — falso-negativo no próprio teste de regressão

Durante a investigação, uma execução falhou por um motivo aparentemente novo:
`errorLocatorA.isVisible()` retornava `true` com texto vazio mesmo na página
que teve **sucesso** na reserva. Causa: `getByRole('alert')` (usado sem
escopo em `public-booking-race.spec.ts`) coincidia com o **route-announcer
nativo do Next.js App Router** — todo App Router injeta um
`<div role="alert" id="__next-route-announcer__">` global, para anunciar
mudanças de rota a leitores de tela, presente e "visível" em qualquer
página, independentemente do resultado da reserva. Corrigido trocando para
`page.locator('.form-error[role="alert"]')`, escopado ao elemento de erro
real da aplicação. Isto era um bug pré-existente no teste, não introduzido
por esta tarefa, e mascarava o verdadeiro resultado sempre que a asserção de
visibilidade genérica resolvia cedo demais.

## Gate de aceitação — resultado

Executado com `npm run build && npm run start` (build de produção real, não
`next dev`, para eliminar qualquer interferência de Fast Refresh/HMR) contra
o Supabase de dev/preview real (`znakuwpmapkhzuntzorj`, o mesmo já usado como
"Local" por `ADR-007`; nunca dados reais de clientes).

| Cenário                                                            | Execuções | Resultado                                             |
| ------------------------------------------------------------------ | --------- | ----------------------------------------------------- |
| 2 visitantes concorrentes                                          | 20/20     | ✅ passou                                             |
| 2 visitantes concorrentes (lote maior, para reproduzir o deadlock) | 40/40     | ✅ passou — deadlock ocorreu 2×, retry absorveu ambos |
| 3 visitantes concorrentes                                          | 10/10     | ✅ passou                                             |
| 5 visitantes concorrentes                                          | 5/5       | ✅ passou                                             |

Em todas as execuções: exatamente uma reserva vencedora, exatamente 1 registo
em `appointments` por rodada, perdedora(s) com mensagem clara e navegação
para `/horario?slotTaken=1` preservando cliente/serviços selecionados.

Nota de metodologia: com `--workers=8` (paralelismo por omissão do
Playwright neste ambiente de 16 núcleos), os cenários de 3 e 5 concorrentes
produziam falhas de **infraestrutura de teste** (navegação para a página
errada, sem qualquer erro correspondente no log do servidor) — não do
código de produção. Reduzir para `--workers=2` eliminou essas falhas por
completo; a causa é contenção de recursos do ambiente local (CPU/rede para
dezenas de páginas de browser + conexões ao Supabase remoto simultâneas), não
um bug do produto. Relevante para quem replicar este teste noutra máquina.

`npm run typecheck`, `npm run lint`, `npm run format` e `npm test` (534
testes unitários, 0 regressões) passam.

## Documentos atualizados

- `docs/10_RISK_REGISTER.md` — R1 (Dupla reserva): Médio → Baixo.
- `TASKS.md` — NEX-178 marcada como parcialmente resolvida (ver risco
  residual).
- `docs/evidence/BUG_2026-07-28_PUBLIC_BOOKING_CLIENT_CONCURRENCY.md` —
  secção de resolução adicionada no topo; o corpo original (investigação,
  hipóteses descartadas) foi preservado sem edição.
- `docs/adr/ADR-005-booking-concurrency.md` — referência a este documento
  adicionada.

## Risco residual (não resolvido nesta tarefa)

`tests/e2e/**` (Playwright) continua sem correr em CI (`.github/workflows/ci.yml`
só tem `verify` e `integration`). É exactamente por isso que o PR #135 (com o
Bug 1 ainda por resolver) passou verde e foi mesclado em `main` antes de
estar corrigido — o teste que prova a regressão nunca chegou a executar
automaticamente. O job `e2e-critical` (build de produção real +
`supabase start` + `playwright test --grep @critical`) está desenhado em
detalhe em `docs/evidence/BUG_2026-07-28_PUBLIC_BOOKING_CLIENT_CONCURRENCY.md`
("Plano acordado para o job `e2e-critical`"), mas não foi implementado nesta
sessão. Sem ele, uma regressão futura neste fluxo específico (ou em
qualquer outro fluxo crítico coberto só por Playwright) pode voltar a passar
despercebida da mesma forma.

## Lição para reaplicar noutros projetos

Duas causas distintas, ambas sob o mesmo sintoma superficial ("a UI trava
sob concorrência real"), que só a exercitação de concorrência genuína (não
mockada, múltiplas instâncias de browser reais, contra um banco de dados
real) revelou:

1. **Estado de submissão em componentes React que fazem I/O de rede**: usar
   uma máquina de estados discriminada (`idle/submitting/success/error/...`),
   nunca vários booleans independentes; sempre `AbortController` + `finally`;
   nunca `startTransition` em torno do próprio pedido de rede (só em torno de
   atualizações visuais subsequentes, se pesadas). O contrato de resposta
   HTTP deve ser um tipo discriminado único, partilhado entre servidor e
   cliente, devolvido explicitamente mesmo em códigos de erro (nunca corpo
   vazio).
2. **Testes de concorrência real contra Postgres devem esperar `40P01`
   (deadlock) como uma categoria de erro distinta de `23P01`
   (exclusion violation) e `23505` (unique violation)** — um deadlock não é
   o mecanismo de negócio que decide o vencedor (isso continua a ser a
   constraint/lock específico da lógica), é o próprio motor de banco de
   dados a proteger-se de um impasse; a mitigação correta é sempre um retry
   único da operação, nunca tratar como erro fatal do pedido do utilizador.
   Só aparece sob paralelismo real suficiente — testes com pouca
   concorrência (2-3 execuções manuais) tipicamente não o revelam; um lote
   de dezenas de execuções concorrentes é o que o expõe de forma fiável.
