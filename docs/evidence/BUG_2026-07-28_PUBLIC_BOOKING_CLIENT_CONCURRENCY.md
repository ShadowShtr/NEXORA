# Bug (não resolvido) — cliente React nunca conclui o estado após confirmação concorrente

**Estado: aberto, P0.** Não corrigir às cegas — ver "Regras para quem retomar" no fim.

## Contexto

Ao reescrever os specs E2E do fluxo público (`fix/public-flow-stale-tests`, PR #134),
`public-booking-race.spec.ts` (NEX-065 — "duas visitantes disputam a mesma vaga") passou
a navegar corretamente pela arquitetura paginada atual pela primeira vez desde a migração
para `/servicos → /horario → /dados → /resumo`. Antes disso o teste nunca tinha chegado a
exercitar a corrida real (ficava preso num bug de navegação anterior à seleção de
serviço). Ao corrigir a navegação, o teste passou a falhar por um motivo novo e real.

`docs/evidence/FIX_2026-07-20_PUBLIC_BOOKING_RPC_BROKEN.md` já documenta que
`create_public_booking` só passou a funcionar de todo em 20/07 — este é o primeiro
momento em que a corrida real (dois pedidos concorrentes para a mesma vaga) foi
exercitada de ponta a ponta pela UI.

O PR #135 (`fix/public-booking-concurrency`) — que continha uma correção parcial, ainda
sem resolver — foi mesclado em produção pela dona antes de o bug estar resolvido,
juntamente com #134, #116 e #81. `main` está verde porque **o CI atual não corre a
suite Playwright** (`tests/e2e/**`) — só `verify` (lint/types/build/unit) e `integration`
(vitest contra Supabase local). Ver secção "CI não cobre isto" abaixo.

## Sintoma

Duas visitantes (dois `BrowserContext` Playwright separados) selecionam o mesmo serviço,
o mesmo horário, preenchem os seus dados e clicam "Confirmar marcação" em simultâneo
(`Promise.all([confirmA.click(), confirmB.click()])`). Esperado: uma navega para o ecrã
de confirmação, a outra é reenviada para `/horario?slotTaken=1` com uma mensagem clara.
Observado: **ambas ficam presas no botão "A confirmar…" indefinidamente** (testado até
30s de espera, repetido 5+ vezes, sempre igual).

## O que já está confirmado (não repetir)

- **A função SQL `create_public_booking` está correta.** Duas chamadas RPC diretas
  (`admin.rpc(...)`, script Node standalone, sem Next.js, sem browser) para o mesmo
  `tenant_id`+`start_at` resolvem em ~150–200ms: uma sucesso, uma `23P01` (exclusion
  violation) correta, exatamente 1 `appointments` criado. Reproduzido duas vezes.
- **A causa não é (só) a Server Action.** Hipótese inicial: Next.js Server Actions são
  processadas sequencialmente por instância de servidor e não entregam resposta ao
  cliente sob invocação concorrente genuína — ver
  [vercel/next.js#69265](https://github.com/vercel/next.js/issues/69265) e
  [discussão #84893](https://github.com/vercel/next.js/discussions/84893). Migrei
  `createPublicBooking` de Server Action (`src/app/b/[slug]/booking-actions.ts`, agora
  apagado) para Route Handler real — `POST /api/public/business/[slug]/bookings`,
  alinhado com o contrato **já documentado mas nunca implementado** em
  `docs/06_API_CONTRACTS.md`. Validado via HTTP direto (`fetch` concorrente, Node,
  sem browser): 1.2s total, 200 + 409, 1 appointment. **O sintoma no browser
  persistiu de forma idêntica mesmo depois desta migração** — portanto a Server Action
  era no máximo parte do problema, não a causa inteira (ou não era a causa).
- **O pedido HTTP chega e volta corretamente até ao browser.** Com listeners de rede do
  Playwright (`page.on('request'|'response'|'requestfinished', ...)`) em ambas as
  páginas: **ambos os POST completam** — 200 numa página, 409 na outra — confirmado
  via `page.on('response', ...)`, não só pela camada de aplicação. O problema está
  depois disso: algures entre a resposta chegar ao browser e a UI atualizar.
- **Não é um artefacto do Playwright.** Substituí `locator.click()` (que usa CDP) por
  `page.evaluate(() => element.click())` (DOM nativo) — falha da mesma forma.
- **Não é uma limitação genérica de rede concorrente deste ambiente.** Dois `fetch()`
  concorrentes entre as mesmas duas páginas/contexts, contra `/api/health` (sem React,
  sem booking), resolvem em ~300ms sem problema.
- **Rate limit e Turnstile são no-op neste ambiente** — `RATE_LIMIT_REDIS_URL`,
  `RATE_LIMIT_REDIS_TOKEN` e `TURNSTILE_SECRET_KEY` vazios em `.env.local`
  (`src/lib/rate-limit.ts` linha 32, `src/lib/turnstile.ts` linha 12 fazem no-op
  explícito quando não configurados). Confirmado também pelo facto de uma reserva
  única (sem corrida) completar normalmente.
- **Reproduz de forma idêntica em `next dev` e numa build de produção real**
  (`next build && next start`, porta separada) — não é um artefacto de compilação
  on-demand do Turbopack em dev.
- Em `next dev`, aparece sempre `[Fast Refresh] rebuilding` no console do browser logo
  a seguir ao pedido POST — ainda por explicar, mas **produção falha da mesma forma sem
  ter Fast Refresh**, por isso não pode ser a causa única.

## O que NÃO investigar sem nova evidência

Por indicação explícita da dona, dado tudo o que já está confirmado acima:

- função SQL `create_public_booking`;
- exclusion constraint `appointments_no_overlap`;
- RLS;
- ordem de inserts nas migrations de reserva.

O foco deve ser exclusivamente o lado do cliente: `ResumoClient.tsx` →
`handleConfirm()` → leitura da resposta (`await response.json()`) → atualização de
estado (`setIsBooking`/`setConfirmedBooking`/`persist`+`router.push`) → navegação.

## Próximo passo sugerido (não executado)

A última instrumentação que estava a correr (removida antes de commitar, ver histórico
do commit `5c56dc6` em `fix/public-booking-concurrency`) tinha `console.log` antes e
depois de `await fetch(...)` e depois de `await response.json()`. Nos runs capturados,
**`"after fetch, status"` nunca chegou a aparecer no console de nenhuma das duas
páginas em `next dev`** — mas essa leitura está contaminada por um `[Fast Refresh]
rebuilding` a meio do pedido (edição de ficheiro feita momentos antes, com o servidor
dev reutilizado entre execuções). Isto **nunca foi confirmado contra uma build de
produção limpa** (sem HMR) — é o passo imediato em falta: repetir exatamente essa
instrumentação (`before fetch` / `after fetch, status` / `after json parse`) contra
`next build && next start`, para saber se `await fetch(...)` chega mesmo a resolver do
lado do JS do cliente, ou se fica pendente apesar de a rede (Playwright) mostrar
`requestfinished`.

## Comportamento esperado (gate de aceitação)

Em duas confirmações simultâneas para a mesma vaga:

- exatamente uma reserva é criada na BD;
- a vencedora navega para o ecrã de confirmação;
- a perdedora recebe o conflito e é reenviada para `/horario?slotTaken=1`;
- cliente e serviços selecionados da perdedora sobrevivem (só o horário é limpo);
- **nenhuma página fica presa em "A confirmar…"**;
- cada página conclui em menos de 5 segundos.

Gate de estabilidade antes de considerar resolvido:

- teste de corrida (2 concorrentes) — 20 execuções consecutivas verdes;
- variante com 3 concorrentes — 10 execuções verdes;
- variante com 5 concorrentes — 5 execuções verdes (ainda por escrever).

Não considerar resolvido só por não haver dupla marcação — as duas interfaces têm de
terminar corretamente.

## CI não cobre isto (gap separado, também por corrigir)

`.github/workflows/ci.yml` só tem dois jobs: `verify` (format/lint/typecheck/`vitest
run --coverage`/build) e `integration` (`vitest run tests/integration` contra Supabase
local via `supabase start` — já não depende do projeto remoto partilhado, ao contrário
do que se pensava; ver nota abaixo). **A suite `tests/e2e/**` (Playwright) nunca corre
em CI** — nem neste push, nem antes. É por isso que #135 passou verde com o teste de
corrida ainda a falhar: o teste que prova o bug nunca chega a executar automaticamente.

Nota: isto significa que a preocupação original de "eliminar dependência do Supabase
remoto partilhado nos testes" já está parcialmente resolvida — mas só para
`tests/integration/*.test.ts` (vitest). `tests/e2e/*.spec.ts` (Playwright, usa
`tests/e2e/support/provisioned-user.ts`) continua a criar utilizadores reais no projeto
Supabase remoto quando corrido localmente, e não corre de todo em CI.

### Plano acordado para o job `e2e-critical`

Adicionar um job novo, condicionado a `verify`+`integration` passarem primeiro, contra
Supabase local (`supabase start` + `supabase db reset`) e uma build de produção real
(`npm run build` + `next start`, não `next dev` — reduz diferença entre CI e Vercel):

```yaml
e2e-critical:
  name: E2E crítico
  runs-on: ubuntu-latest
  timeout-minutes: 20
  needs: [verify, integration]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 24, cache: npm }
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npx supabase start
    - run: npx supabase db reset
    - run: npm run build
    - run: npm run test:e2e:critical
      env:
        CI: true
        NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
        # chaves obtidas de `supabase status`, não credenciais de produção
    - if: always()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: [playwright-report/, test-results/]
        retention-days: 14
```

Scripts `package.json` a acrescentar:

```json
"test:e2e:critical": "playwright test --grep @critical",
"test:e2e:race": "playwright test tests/e2e/public-booking-race.spec.ts",
"start:test": "next start -p 3000"
```

`playwright.config.ts`: `webServer.command` deve passar a `npm run start:test` (build de
produção) em vez de `npm run dev`, pelo menos para o job de CI — reduz divergência entre
o que o CI valida e o que o Vercel serve. Precisa de `npm run build` correr antes.

Testes a marcar `@critical` (mínimo): login, reserva pública completa, corrida de
reserva (este bug), criação manual de marcação, conclusão/pagamento, isolamento básico
entre tenants. Nunca usar `test.skip`/`test.fixme`/retries que escondam a falha do teste
de corrida especificamente.

Depois de o job existir e passar de forma estável, a proteção de branch do `main`
deve passar a exigir `verify`, `integration`, `e2e-critical`, `gitleaks` e `analyze`
como checks obrigatórios — sem isso, um job novo pode falhar e mesmo assim alguém
mesclar (foi exatamente o que aconteceu com #135).

## Ordem de execução (quando retomar)

1. `git checkout fix/public-booking-client-concurrency` (branch já criada, só com este
   documento).
2. Reproduzir contra o `main` atual antes de mexer em código (confirmar que o sintoma
   persiste pós-merge de #135/#134/#116/#81).
3. Rebuild de produção limpo + instrumentação `before/after fetch`/`after json parse`
   em `handleConfirm` — confirmar se `await fetch(...)` resolve ou não do lado do
   cliente, sem contaminação de Fast Refresh.
4. Corrigir a causa raiz no cliente (só depois de a entender — não às cegas).
5. Gate de estabilidade (20×2, 10×3, 5×5 concorrentes).
6. Adicionar `e2e-critical` ao CI (mesmo PR ou PR imediatamente a seguir), com o teste
   de corrida a falhar no código antigo e a passar no novo, para provar que o gate
   funciona.
7. `npm run verify`, commit, push, abrir PR (não mesclar — pedir à dona).
8. Documentar a necessidade de tornar `e2e-critical` obrigatório na proteção do branch
   `main` (fora do alcance do Claude Code — configuração do GitHub feita pela dona).
9. Sugerir execução noturna (`workflow_dispatch`/`schedule`) da suite Playwright
   completa, não só `@critical`.
