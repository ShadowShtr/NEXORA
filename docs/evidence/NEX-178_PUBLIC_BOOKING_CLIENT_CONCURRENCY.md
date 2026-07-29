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

## Atualização — job `e2e-critical` implementado (2026-07-29)

Branch `task/NEX-178-e2e-critical-ci`, seguindo exatamente o plano acordado em
`docs/evidence/BUG_2026-07-28_PUBLIC_BOOKING_CLIENT_CONCURRENCY.md`
("Plano acordado para o job `e2e-critical`"):

- Novo job `e2e-critical` em `.github/workflows/ci.yml`, `needs: [verify, integration]`,
  contra `supabase start` (Postgres local, não o projeto remoto partilhado) e uma build
  de produção real (`next build` + `next start`, não `next dev` — `playwright.config.ts`
  agora usa `command: process.env.CI ? 'npm run start:test' : 'npm run dev'`).
- Seis specs marcadas `@critical` (mínimo acordado): `login.spec.ts` (NEX-020),
  `public-booking-confirmation.spec.ts` (NEX-070, fluxo público completo),
  `public-booking-race.spec.ts` (NEX-065, este bug), `appointment-completion.spec.ts`
  (NEX-110, conclusão/pagamento), `pentest-cross-tenant-write-tamper.spec.ts` (NEX-167,
  isolamento entre tenants), `manual-booking-client-suggestion.spec.ts` (NEX-092).
- `public-booking-race.spec.ts` ganhou `test.describe.configure({ retries: 0 })`
  explícito — os retries globais do CI (2, `playwright.config.ts`) não se aplicam a
  este teste especificamente, para que uma regressão real nunca seja mascarada por uma
  segunda tentativa a passar, tal como pedido no plano ("nunca usar retries que
  escondam a falha do teste de corrida especificamente").
- Scripts novos em `package.json`: `test:e2e:critical` (`playwright test --grep
@critical --project=chromium` — só chromium no CI, mesmo alcance do
  `playwright install --with-deps chromium` do job), `test:e2e:race` (atalho para
  reproduzir só este teste) e `start:test` (`next start -p 3000`).
- `docs-only` gap encontrado e assumido, não escondido: não existe hoje nenhuma spec
  E2E que complete o wizard de "Nova marcação" (NEX-085) até criar mesmo a marcação —
  `manual-booking-client-suggestion.spec.ts` (NEX-092) é a única que toca o wizard, e
  para no passo de sugestão de cliente. Foi essa a spec marcada `@critical` por ser a
  mais próxima; escrever a spec completa de NEX-085 ficou fora do âmbito desta tarefa
  (só "ligar o CI", não "aumentar cobertura") e fica como seguimento sugerido.

### Validado nesta máquina (sem Docker — ver `ADR-007`)

`npm run verify` completo (format/lint/typecheck/534 testes unitários/build/budget)
passa. `npx playwright test --list --grep @critical --project=chromium` confirma
exatamente os 6 ficheiros/14 testes esperados. `npm run build` + `npm run start:test`
com as mesmas env vars do job novo arrancam e servem `/login` (200) e `/api/health`
normalmente. `.github/workflows/ci.yml` validado sintaticamente (`yaml.safe_load`).

**Não validado localmente** (Docker Desktop indisponível nesta máquina — mesma
limitação de `ADR-007` que já afeta `tests/integration/`): a execução real do job
`e2e-critical` contra `supabase start`, incluindo se o teste de corrida
(`public-booking-race.spec.ts`) passa de facto contra Postgres local. Só se prova
quando o GitHub Actions correr este PR — é o próximo passo depois do push.

## Risco residual (parcialmente resolvido nesta sessão)

O job `e2e-critical` está implementado e a aguardar a primeira execução real no CI
(GitHub Actions tem Docker; esta máquina não). Até essa execução confirmar verde:

1. Não está provado que o teste de corrida passa de forma estável contra Postgres
   local em CI (só foi validado antes contra o Supabase de dev/preview remoto, gate
   de aceitação acima).
2. A proteção de branch do `main` ainda não exige `e2e-critical` como check
   obrigatório — configuração do GitHub, fora do alcance do Claude Code, a pedir à
   dona depois de o job passar de forma estável algumas vezes (conforme o plano
   original).
3. Falta a spec E2E completa de NEX-085 (criação manual de marcação) mencionada acima.

Sem os pontos 1-2, uma regressão futura ainda pode ser mesclada com o `e2e-critical` a
falhar (tal como aconteceu com #135 quando não existia nenhum job).

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
