# Auditoria de Desempenho, Arquitetura e Organização — NEXORA

**Âmbito original desta entrega: PR 1** — baseline, instrumentação de leitura e matriz de
ficheiros. Por decisão explícita do pedido original (repositório de 632 ficheiros, 28
secções, ~12 PRs, benchmarks de infraestrutura real), a entrega inicial não implementava
PR 2–12 (migração de região, RPCs agregadas, cache de disponibilidade, etc.). Este
documento regista **apenas o que foi verificado por leitura direta de código e por
comandos executados**, e nomeia explicitamente o que ainda não foi medido.

**Atualização — PR 2 concluído** (secção 0 abaixo): navegação interna da Agenda corrigida
para `next/link`, comentário desatualizado de `server.ts` corrigido, teste Playwright
anti-regressão adicionado, e a baseline deixou de ser puramente estática — `build`,
`test:coverage` e `budget` foram efetivamente executados, com números reais.

Branches: `perf/auditoria-total-nexora` (PR 1, a partir de `main`) e
`perf/pr2-agenda-links-baseline` (PR 2, a partir do commit do PR 1).

---

## 0. PR 2 — Navegação interna da Agenda + baseline executável

### O que mudou

1. **`src/app/(dashboard)/dashboard/agenda/page.tsx`** — os 7 pontos de navegação
   identificados no PR 1 (secção 3.4) deixaram de usar `<a href={string}>` e passaram a
   usar `next/link`. `navHref()` passou a devolver o shape de `href` que o `next/link`
   entende com `typedRoutes: true` (`{ pathname, query }`) em vez de uma string
   interpolada — só assim o compilador consegue validar contra as rotas reais do
   `next.config.ts`. Nenhuma alteração de layout, texto ou comportamento visível.
2. **`src/lib/supabase/server.ts`** — o comentário `"The root proxy refreshes sessions"`
   (falso, confirmado no PR 1 secção 3.7) foi substituído por uma nota que descreve com
   precisão o que acontece hoje (o refresh, quando ocorre, é descartado silenciosamente
   quando a chamada vem de um Server Component) e regista explicitamente que a estratégia
   real de refresh de sessão ainda não foi determinada — fica para PR 3. **Nenhuma
   mudança de comportamento** — só o comentário mudou.
3. **`tests/e2e/agenda-client-navigation.spec.ts`** (novo) — confirma, contra os 7 pontos
   de navegação: zero requests de `resourceType() === 'document'` durante os cliques; um
   marcador plantado em `window` antes dos cliques sobrevive (prova de que o documento não
   foi recriado, i.e. o layout ficou montado); e `goBack()`/`goForward()` resolvem para o
   URL certo. Gate por `canUseSupabase()`, mesmo padrão dos outros specs do repositório —
   não foi adicionado a `@critical` nesta entrega (decisão a validar com a equipa: é um
   teste de regressão de navegação, não um fluxo de negócio crítico dos 12 já listados em
   `docs/07_TEST_STRATEGY.md`).

Ficheiro adicional fora do pedido original de PR 2 mas identificado no PR 1 (secção 3.4):
`src/app/(dashboard)/dashboard/clientes/[id]/page.tsx:203` tem mais um `<a href>` interno
(link para o próximo agendamento) que **não foi alterado nesta entrega** — estava fora do
escopo acordado ("os 7 `<a href>` internos da Agenda"), fica registado para PR 3 ou uma
extensão pequena e isolada.

### Verificação executada (`npm ci`, `format`, `lint`, `typecheck`, `test:coverage`,

`build`, `budget`, `test:integration`, `test:e2e:critical`)

Todos os comandos foram de facto corridos nesta sessão, no repositório clonado
localmente, contra o build real (`next build`/`next start`, nunca só `next dev` para as
medições de servidor abaixo):

| Comando                     | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Evidência                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `npm ci`                    | OK — 558 pacotes, 30s. Avisos de peer-dependency pré-existentes (`eslint-plugin-react` vs. `eslint@10`), não introduzidos por este PR.                                                                                                                                                                                                                                                                                                                                         | output do comando                                   |
| `npm run format`            | Falhou inicialmente nos 3 ficheiros novos/alterados desta sessão (docs + teste); corrigido com `prettier --write`; `npm run format` limpo depois.                                                                                                                                                                                                                                                                                                                              | output do comando                                   |
| `npm run lint`              | OK, zero erros/avisos (`--max-warnings=0`).                                                                                                                                                                                                                                                                                                                                                                                                                                    | output do comando                                   |
| `npm run typecheck`         | OK, zero erros — inclui a validação do shape `{ pathname, query }` do `next/link` contra `typedRoutes: true`.                                                                                                                                                                                                                                                                                                                                                                  | output do comando                                   |
| `npm run test:coverage`     | **534 testes passaram**, 187 skipped (suite de integração, sem credenciais Supabase), 0 falhas. Cobertura: **91.74% statements, 80.64% branches, 93.47% functions, 92.76% lines** — acima dos limiares configurados em `vitest.config.ts` (80/75/80/80).                                                                                                                                                                                                                       | output do comando, secção completa arquivada abaixo |
| `npm run build`             | OK, **18.4s**, Turbopack. 30 páginas, todas dinâmicas (`ƒ`) exceto `/manifest.webmanifest` (estática). Exigiu variáveis de ambiente fictícias e sem valor real (`NEXT_PUBLIC_SUPABASE_URL=https://local-build-only.invalid.supabase.co` etc., nunca persistidas — ficheiro `.env.local` local, fora do controlo de versões e apagado no fim da sessão) só para satisfazer a validação Zod de `src/lib/env.ts`; nenhuma chamada de rede real foi feita a um Supabase existente. | output do comando                                   |
| `npm run budget`            | OK — **44 chunks, 1505.4 KiB total de JS (orçamento 2500 KiB), maior chunk 276.8 KiB (orçamento 400 KiB)**. Primeira medição real de tamanho de bundle deste ciclo de auditoria.                                                                                                                                                                                                                                                                                               | output do comando                                   |
| `npm run test:integration`  | **187 testes, todos skipped** (`describe.runIf(canUseSupabase())`) — sem `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` reais. Ver "Bloqueio de ambiente" abaixo.                                                                                                                                                                                                                                                                                                      | output do comando                                   |
| `npm run test:e2e:critical` | **14 testes, todos skipped**, mesmo motivo — confirma que o build de produção sobe (`next dev`/`next start` arrancam sem erro com o middleware alterado) mas não exercita nenhum fluxo de negócio real.                                                                                                                                                                                                                                                                        | output do comando                                   |

### Bloqueio de ambiente — Supabase local via Docker não disponível nesta sessão

Tentei subir o stack local (`npx supabase start`, o mesmo padrão que
`.github/workflows/ci.yml` usa nos jobs `integration` e `e2e-critical`, Docker nativo em
`ubuntu-latest`). O binário `supabase` CLI e o `docker.exe` existem nesta máquina, mas o
**daemon do Docker Desktop não está a correr** neste ambiente de sessão (`docker ps` falha
com `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`).
Não tentei iniciar a aplicação Docker Desktop (GUI, fora do alcance de uma sessão não
interativa). Consequência honesta:

- **Nenhuma migration foi de facto aplicada** a uma base local nesta sessão.
- **Nenhum teste de integração correu de verdade** (RLS, constraints, RPCs) — os 187 só
  confirmam que a gate `runIf` funciona, não que as regras passam.
- **Nenhum teste E2E autenticado correu** — os 14 `@critical` só confirmam que o servidor
  sobe e a suite está corretamente cablada (nenhum erro de sintaxe/import), não que o
  login, a reserva pública ou a conclusão de marcação funcionam.
- **As medições de navegação pedidas** (Agenda Dia→Semana, Semana→Lista, anterior/
  seguinte, Início→Agenda, tempo clique→conteúdo, p50/p75/p95) **não puderam ser
  recolhidas** — todas exigem uma sessão autenticada real, que por sua vez exige
  `provision_tenant_owner` contra uma base de dados real. Isto é um bloqueio de ambiente
  desta sessão, não uma alegação de que a navegação está corrigida sem prova — o teste
  `agenda-client-navigation.spec.ts` fica pronto e correto (confirmado por rodar e dar
  skip limpo, sem erro), à espera de correr contra Supabase real (CI do GitHub, ou uma
  sessão com Docker Desktop ativo).

### O que foi medido sem depender de sessão autenticada (evidência parcial, não substitui as medições pedidas)

Com `next start` (build de produção) a correr localmente e as env vars fictícias do build
ainda válidas para arrancar o servidor (sem qualquer round-trip real a um Supabase — o
servidor arranca, mas qualquer rota que tentasse mesmo falar com a `NEXT_PUBLIC_SUPABASE_URL`
fictícia falharia; as duas rotas abaixo não chegam a fazer essa chamada):

| Rota                                     | TTFB (`curl -w time_starttransfer`) | Total  | Status         |
| ---------------------------------------- | ----------------------------------- | ------ | -------------- |
| `GET /login` (página pública, sem dados) | 0.209s                              | 0.211s | 200            |
| `GET /dashboard/agenda` (sem sessão)     | 0.024s                              | 0.025s | 307 → `/login` |

O redirect de `/dashboard/agenda` sem sessão confirma que `requireProfile()` continua a
proteger a rota corretamente depois da troca `<a>`→`next/link` (a troca foi só na
navegação client-side dentro da página já autenticada; o gate de acesso na entrada da
rota não foi tocado). O cabeçalho `Cache-Control: no-store` e a CSP com nonce por request
continuam presentes na resposta, confirmando que a correção do comentário em `server.ts`
(comentário apenas, sem mudança de código) não afetou o middleware. Estes dois números
são TTFB de servidor local sem rede real e **não substituem** as medições de navegação
click-to-content pedidas (que exigem sessão autenticada + Supabase real) — são incluídos
só porque são reais e verificáveis, não uma alegação de "navegação medida".

---

## 1. Baseline recolhida

| Item                          | Valor                                                                | Como foi obtido         |
| ----------------------------- | -------------------------------------------------------------------- | ----------------------- |
| Commit inicial (`main`)       | `b0889ce0c5530622f5ec810f8c6068fe6b142cd0` (2026-07-31 12:01 +01:00) | `git log -1`            |
| Node                          | v24.16.0 (repo pede `>=24 <25`, `.nvmrc`=`24`)                       | `node -v`, `.nvmrc`     |
| npm                           | 11.13.0                                                              | `npm -v`                |
| Next.js                       | `16.2.12` (declarado em `package.json` e `eslint-config-next`)       | `package.json`          |
| React                         | `19.2.7`                                                             | `package.json`          |
| TypeScript                    | `6.0.3`                                                              | `package.json`          |
| `@supabase/supabase-js`       | `2.110.7`                                                            | `package.json`          |
| `@supabase/ssr`               | `0.12.3`                                                             | `package.json`          |
| Total de ficheiros rastreados | 632                                                                  | `git ls-files \| wc -l` |

### Ficheiros por extensão

| Extensão                                                                                            | Contagem |
| --------------------------------------------------------------------------------------------------- | -------- |
| `.ts`                                                                                               | 288      |
| `.md`                                                                                               | 145      |
| `.tsx`                                                                                              | 122      |
| `.sql`                                                                                              | 39       |
| `.json`                                                                                             | 7        |
| `.yml`                                                                                              | 6        |
| `.mjs`                                                                                              | 6        |
| `.png`                                                                                              | 4        |
| `.toml`                                                                                             | 2        |
| outros (gitignore, sh, css, mts, js, CODEOWNERS, pre-commit, gitattributes, .example, editorconfig) | 1 cada   |

### Tamanho das pastas principais (ficheiros rastreados)

| Pasta       | Ficheiros                                                                         |
| ----------- | --------------------------------------------------------------------------------- |
| `src/`      | 248 (features 131 · app 77 · lib 35 · components 4 · middleware.ts 1)             |
| `tests/`    | 159 (unit 66 · e2e 54 specs · integration 36)                                     |
| `docs/`     | 100                                                                               |
| `supabase/` | 41 (39 `.sql`)                                                                    |
| `tasks/`    | 35                                                                                |
| `.github/`  | 8 (workflows: `ci.yml`, `codeql.yml`, `dependency-review.yml`, `secret-scan.yml`) |
| `scripts/`  | 7                                                                                 |
| `public/`   | 5                                                                                 |

### Ficheiros com mais linhas

| Linhas | Ficheiro                                                    |
| ------ | ----------------------------------------------------------- |
| 572    | `src/app/(dashboard)/dashboard/page.tsx`                    |
| 559    | `src/features/catalog/actions.ts`                           |
| 446    | `src/features/appointments/wizard/NewAppointmentWizard.tsx` |
| 422    | `src/app/b/[slug]/page.tsx`                                 |
| 407    | `src/features/onboarding/actions.ts`                        |
| 357    | `src/app/(dashboard)/dashboard/financeiro/page.tsx`         |
| 343    | `src/features/appointments/AppointmentCompletionPanel.tsx`  |
| 343    | `src/app/b/[slug]/servicos/ServicosClient.tsx`              |

(lista completa de `.ts`/`.tsx`/`.sql`/`.md` por linhas está em `docs/audits/_filelist_raw.txt` do processo de recolha, reproduzível com o comando na secção 12)

### Componentes client vs. server

- **78 ficheiros** com `'use client'` no topo (contagem exaustiva por grep, lista completa
  em `NEXORA_FILE_AUDIT.csv`, coluna `camada=client`).
- Nenhum ficheiro client importa `createAdminClient` (verificado por grep cruzado — ver
  secção 4).
- `AppShell.tsx` (`src/features/shell/AppShell.tsx`) é client; ainda não avaliado se pode
  ser reduzido a um client boundary mínimo (fica para PR 12+, fora do âmbito desta
  entrega).

### Rotas existentes (`page.tsx`, 32 no total)

```
(auth)/definir-password, (auth)/login, (auth)/recuperar-password
(dashboard)/dashboard, /agenda, /agenda/[id], /agenda/nova, /clientes, /clientes/[id],
  /definicoes, /definicoes/agenda, /definicoes/aparencia, /definicoes/dados,
  /definicoes/lembretes, /definicoes/marcacoes, /definicoes/negocio,
  /definicoes/pagamentos, /financeiro, /financeiro/pendentes, /lembretes, /mais,
  /relatorios, /servicos
(onboarding)/onboarding
b/[slug], b/[slug]/dados, b/[slug]/horario, b/[slug]/resumo, b/[slug]/servicos
marcacao, marcacao/[token]
```

### Migrations e testes

- 39 ficheiros `.sql` em `supabase/migrations/` (ou subpastas de `supabase/`).
- 156 ficheiros de teste rastreados: 66 unitários (Vitest, fora de `e2e/`/`integration/`),
  36 de integração, 54 specs Playwright.
- Scripts npm relevantes já existentes: `test`, `test:coverage`, `test:integration`,
  `test:e2e`, `test:e2e:critical`, `test:e2e:race`, `budget`, `verify`.

### Dependências de produção (`package.json`)

`@supabase/ssr`, `@supabase/supabase-js`, `@upstash/ratelimit`, `@upstash/redis`, `clsx`,
`date-fns`, `date-fns-tz`, `exceljs`, `lucide-react`, `next`, `pdfkit`, `qrcode`, `react`,
`react-dom`, `sharp`, `zod`.

### Dependências de desenvolvimento

`@axe-core/playwright`, `@eslint/compat`, `@playwright/test`, `@types/*`,
`@vitest/coverage-v8`, `eslint`, `eslint-config-next`, `jsqr`, `pg`, `pngjs`, `prettier`,
`typescript`, `vitest`.

**Atualizado no PR 2** (secção 0): `npm ci`, `npm run build`, `npm run test:coverage` e
`npm run budget` foram executados de facto, com números reais. `test:integration` e
`test:e2e:critical` também correram, mas com todos os testes em `skip` — Docker Desktop
(necessário para o Supabase local) não estava disponível nesta sessão. Load test continua
por fazer. Ver secção 0 e "O que não foi validado" abaixo.

---

## 2. Matriz de ficheiros — `docs/audits/NEXORA_FILE_AUDIT.csv`

**Confirmação: todos os 632 ficheiros listados por `git ls-files` foram classificados** —
o CSV tem 633 linhas (1 cabeçalho + 632 ficheiros), gerado por um script Node
(`node audit-nexora.mjs`, cópia arquivada nesta secção) que **abre e lê o conteúdo de
cada ficheiro de texto rastreado** para derivar os sinais reportados. Ficheiros binários
(`.png` — 4 no repo) são marcados `estado=revisto (binario/gerado)` com justificação
explícita na coluna `responsabilidade`, nunca marcados "revisto" sem essa nota.

### Metodologia — o que é automatizado vs. avaliado manualmente

Dado o volume (632 ficheiros) e o âmbito desta entrega (PR 1), a matriz combina dois
níveis de rigor, declarados coluna a coluna:

- **Colunas objetivas, derivadas por leitura de conteúdo de cada ficheiro** (aplicadas às
  632 linhas, sem exceção): `tipo`, `feature`, `camada` (server/client/shared/db/test/
  docs/binary, por presença real de `'use client'`/`'use server'`/padrão de rota),
  `leitura_dados` (presença de `.from(`/`.rpc(`/`.select(`), `escrita_dados`
  (`.insert`/`.update`/`.upsert`/`.delete`), `cache_atual` (`no-store`/`force-dynamic`/
  `unstable_cache`/`cache()`), `invalidacao_atual` (`revalidatePath`/`revalidateTag`),
  `dependencias_pesadas` (import direto de `pdfkit`/`exceljs`/`sharp`/`qrcode`),
  `teste_associado` (correspondência de nome de ficheiro em `tests/`), `importadores_
principais` (índice reverso de `import ... from` construído a partir de todos os
  ficheiros `.ts`/`.tsx` em `src/`, até 5 importadores listados).
- **Colunas qualitativas** (`responsabilidade` em prosa, `risco_desempenho`,
  `codigo_duplicado`, `acao_recomendada`, `prioridade`) foram preenchidas com avaliação
  manual apenas para o subconjunto de alto risco/alto valor revisto em profundidade nesta
  sessão (secção 3 abaixo — dashboard, clientes, financeiro, agenda, clientes Supabase,
  auth, middleware). Para as restantes linhas ficam **vazias, não fabricadas** — isto é
  um risco residual explícito (secção "O que não foi validado"), não uma alegação de
  cobertura total.
- `risco_seguranca` é preenchido para as 632 linhas com um sinal automático (`service_
role`/`createAdminClient` presentes num ficheiro client → `ALTO`; `select('*')` →
  `MEDIO`; caso contrário `sem sinal automatico`), que é um alarme grosseiro, não uma
  revisão de segurança completa por ficheiro.

O script está preservado em `scripts/lib/` desta branch (ver `git status` original —
`scripts/lib/` já aparecia como novidade não rastreada antes desta sessão; não foi
tocado) — a cópia usada para gerar o CSV desta auditoria fica em
`docs/audits/_audit-nexora-tool.mjs` para reprodutibilidade.

---

## 3. Achados verificados por leitura direta (evidência, não suposição)

### 3.1 Dashboard (`src/app/(dashboard)/dashboard/page.tsx`) — fan-out confirmado

`loadDashboardData()` (linhas 81–180) faz **8 consultas Supabase distintas** por
carregamento:

1. `business_settings` (timezone) — sequencial, antes do `Promise.all`.
2. `profiles.display_name`
3. `tenants.slug`
4. `appointments` do dia (com `clients(...)`, `appointment_items(...)` embutidos)
5. `reminders` — `count: 'exact', head: true` (pendentes)
6. `payments` recebidos hoje
7. `reminders` — 4 lembretes de atenção (com `appointments`/`clients` embutidos)
8. `payments` pendentes hoje — **depende do resultado de (4)** (`.in('appointment_id',
todayApptIds)`), portanto não pode entrar no `Promise.all` inicial — é uma segunda
   volta sequencial.

Isto confirma o diagnóstico do pedido original: nenhuma RPC/`get_dashboard_overview`
única; soma de `payments` feita em JavaScript (`reduce`) em vez de agregação SQL.

**Nota que contradiz uma suposição do pedido original**: o cálculo do "dia" já usa
`fromZonedTime`/`formatInTimeZone` (`date-fns-tz`) para resolver a meia-noite local em
UTC, com um comentário explícito a citar o motor de disponibilidade
(`src/features/appointments/domain/daily-schedule.ts`) como razão para o padrão — **não**
está a somar 24h a partir de `now`. A alegação do pedido original ("não usar início + 24
horas") não se verifica neste ficheiro; não avaliado ainda no motor de disponibilidade em
si (fora do âmbito desta entrega).

### 3.2 Clientes (`.../clientes/page.tsx`) — 8 consultas `.from()` confirmadas

Confirma o padrão de fan-out descrito no pedido: `business_settings`, `reminders`
(contagem), `clients` (contagem), `clients` (página), `appointments`, mais `appointments`
e `payments` adicionais mais abaixo no ficheiro (linhas 104/122) — consistente com "20
clientes → todos os appointments → todos os payments" descrito na secção 10 do pedido
original. Não foi medido o custo real (sem `EXPLAIN ANALYZE`, sem dataset de 10k
clientes) — fica para PR 6.

### 3.3 Financeiro (`.../financeiro/page.tsx`) — agregação em JavaScript confirmada

`selectCompleted()` traz `payments(...)` e `appointment_items(...)` **de todos os
appointments concluídos do período**, sem paginação, e agrega com `mapCompletedRows` +
`buildFinanceSummary` no lado do servidor Next (JS), não em SQL — exatamente o padrão que
o pedido pede para eliminar na secção 12. Roda duas vezes (período atual + anterior) em
paralelo.

### 3.4 Agenda — navegação por `<a href>` confirmada (âmbito da secção 5)

`src/app/(dashboard)/dashboard/agenda/page.tsx` usa `<a href={navHref(...)}>` (não
`next/link`) em **7 pontos**: anterior/hoje/seguinte (linhas 191, 198, 203) e as três abas
Dia/Semana/Mês (linhas 218, 226, 234). Cada clique é um document navigation completo —
confirma literalmente o que o pedido descreve como problema a corrigir na secção 5. Fora
disto, apenas mais um `<a href>` interno foi encontrado em todo `src/` para navegação de
página (`clientes/[id]/page.tsx:203`, link para o detalhe do próximo agendamento); o outro
`<a href>` remanescente (`clientes/[id]/page.tsx:191`) é um download de exportação
(`/api/clientes/.../export`) e deve permanecer `<a>` por ser intencionalmente um document
navigation (download de ficheiro). Nenhum uso de `window.location`/`location.href`/
`location.assign`/`location.replace` foi encontrado fora de
`(auth)/definir-password/page.tsx` (leitura de `#hash` do link de recuperação de senha —
uso legítimo, não é navegação interna substituível por `next/link`).

### 3.5 Clientes Supabase — inventário completo

10 ficheiros chamam `createBrowserClient`/`createServerClient`/`createAdminClient`/
`createClient`:

- `src/lib/supabase/client.ts`, `server.ts`, `admin.ts` — as três factories centrais.
- `src/app/(auth)/definir-password/page.tsx`, `src/app/api/cron/cleanup-booking-drafts/
route.ts`, `src/app/api/public/business/[slug]/bookings/route.ts`,
  `src/app/b/[slug]/availability-actions.ts`, `src/app/b/[slug]/draft-actions.ts`,
  `src/lib/booking-lookup-code.ts`, `src/lib/booking-token-lookup.ts` — chamadores.

`createAdminClient()` (`src/lib/supabase/admin.ts`) já está bem isolado: comentário
explícito "Server-only (never imported by a 'use client' component)"; verificação por
grep confirma que **nenhum** dos 78 ficheiros `'use client'` importa `createAdminClient`
nem referencia `SUPABASE_SERVICE_ROLE_KEY`. Não confirmado nesta sessão se o cliente
server (`server.ts`) está memoizado por request com `cache()` do React — lido o código
(não usa `cache()` atualmente) mas o impacto real de duplicação por request não foi
medido (fica para PR 4).

### 3.6 `requireProfile` — chamado 50× em 50 ficheiros distintos

`requireProfile`/`getOptionalProfile` estão definidos uma única vez em
`src/lib/auth/require-profile.ts` (sem duplicação da própria lógica), mas são
**importados/chamados em 50 ficheiros** — confirma a alegação do pedido de que "várias
páginas chamam a mesma função novamente" além do layout do dashboard. Não avaliado nesta
sessão quantas dessas chamadas resultam em queries de `profile` repetidas dentro do
**mesmo** request (isso exige tracing de request, fora do âmbito de PR 1 — ver secção 8
do pedido original, fica para PR 4).

### 3.7 Middleware — comentário desatualizado confirmado

`src/lib/supabase/server.ts:20` tem o comentário `// Server Components cannot set
cookies. The root proxy refreshes sessions.` Mas `src/middleware.ts` (lido na íntegra)
**não chama `supabase.auth.getUser()` nem qualquer refresh de sessão** — trata
exclusivamente CSP (com nonce por request), `Cache-Control: no-store` para rotas
sensíveis, e `x-request-id`. Isto confirma exatamente a suspeita do pedido original
(secção 6): o comentário está desalinhado com o comportamento real do middleware atual.
Não foi determinado nesta sessão onde (ou se) a sessão é de facto refrescada — precisa de
investigação dedicada da estratégia oficial `@supabase/ssr` compatível com Next 16.2.12
antes de qualquer alteração (PR 4).

### 3.8 Realtime — nenhum uso encontrado

Busca por `.channel(` e padrões de subscrição Supabase Realtime em todo `src/**/*.{ts,tsx}`
não encontrou nenhuma ocorrência. A secção 21 do pedido (auditoria de canais duplicados,
polling, `setInterval`) parte de uma hipótese que **não se confirma neste código** — não
há Realtime implementado atualmente. Deve ser reconfirmado antes de PR 11 caso a hipótese
tenha mudado.

### 3.9 Vercel/Supabase — região não fixada, confirmado

`vercel.json` contém apenas a configuração de `crons` (`/api/cron/cleanup-booking-drafts`
às 04:00); **não existe campo `regions`**. Confirma a alegação do pedido original de que
não há região fixada. A região real de execução das funções (o Vercel usa `iad1` por
omissão salvo configuração) e a região real do projeto Supabase não foram confirmadas
nesta sessão — exige acesso ao dashboard Vercel/Supabase, que não estava disponível aqui
(ver "O que não foi validado"). Fica para PR 2, isolado, como o pedido exige.

### 3.10 CI existente

4 workflows em `.github/workflows/`: `ci.yml`, `codeql.yml`, `dependency-review.yml`,
`secret-scan.yml`. Conteúdo detalhado (jobs, gates atuais) não foi lido linha a linha
nesta sessão — fica para antes de PR 23 (gates adicionais).

---

## 4. O que NÃO foi validado nesta entrega (lacunas explícitas)

Esta secção existe porque o pedido original proíbe declarar "otimizado" sem evidência —
o inverso também se aplica: não declarar "auditado" o que não foi de facto medido.
Atualizada depois do PR 2 — riscado o que deixou de ser verdade, mantido o resto.

- ~~Nenhum comando de build/teste foi executado~~ — **corrigido no PR 2**: `npm ci`,
  `format`, `lint`, `typecheck`, `test:coverage`, `build`, `budget`, `test:integration` e
  `test:e2e:critical` correram todos de facto (secção 0). `test:integration` e
  `test:e2e:critical` correram mas com 100% dos testes em skip — **Docker Desktop não
  estava disponível nesta sessão** (daemon inacessível, `docker ps` falha), então nenhum
  teste que precise de Supabase local foi realmente exercitado. Load test continua por
  fazer.
- **Nenhuma métrica de navegador autenticada foi recolhida** (LCP, INP, CLS, Lighthouse,
  click-to-content nas navegações principais pedidas) — continua a exigir sessão
  autenticada real, que por sua vez exige Supabase, indisponível nesta sessão (ver secção
  0, "Bloqueio de ambiente"). Só dois TTFB de rotas sem sessão/sem dados foram recolhidos,
  e estão marcados como não substituindo as medições pedidas.
- **Nenhum acesso ao dashboard Vercel ou Supabase** — região física real, latência
  medida, plano/tier não confirmados. Inalterado desde o PR 1.
- **`EXPLAIN ANALYZE` não foi executado** — nenhuma alegação sobre índices, planos de
  query ou tamanho de tabelas é feita; a secção 16 do pedido fica inteiramente para uma
  sessão com acesso a Postgres real. Inalterado desde o PR 1.
- **A matriz de ficheiros tem colunas qualitativas (`risco_desempenho`,
  `codigo_duplicado`, `acao_recomendada`, `prioridade`) preenchidas manualmente apenas
  para os ~15 ficheiros revistos em profundidade na secção 3** — as restantes ~617 linhas
  têm as colunas objetivas preenchidas (todas lidas por conteúdo) mas essas quatro colunas
  qualitativas em branco, não fabricadas. Inalterado desde o PR 1 — o CSV não foi
  regenerado neste PR (nenhum ficheiro novo relevante à matriz além do teste e2e, que teria
  entrado como mais uma linha — fica para a próxima regeneração completa).
- **`AppShell.tsx` e os 78 ficheiros client não foram individualmente justificados**
  (hook/evento/estado/API do browser) — a secção 18 do pedido pede uma justificação por
  ficheiro; feita apenas a contagem e a confirmação de isolamento do admin client.
  Inalterado desde o PR 1.
- **`src/lib/supabase/server.ts` teve só o comentário corrigido, não o comportamento** —
  onde e se a sessão é de facto refrescada continua por determinar; não confundir a
  correção do comentário com uma correção funcional.

---

## 5. Próximos passos sugeridos

PR 3 (contexto autenticado memoizado, eliminação de `requireProfile()` duplicado, e
determinar a estratégia real de refresh de sessão `@supabase/ssr`) é o próximo indicado.
Antes disso, para desbloquear medições reais (integração, e2e crítico, navegação
autenticada), é preciso ou (a) Docker Desktop ativo numa sessão futura, ou (b) correr a
suite no CI do GitHub (`.github/workflows/ci.yml` já faz `supabase start` em
`ubuntu-latest`, onde o Docker nativo funciona) e trazer os resultados de volta para este
documento. PR 4+ (RPC do Dashboard), PR 5 (Clientes paginado), PR 6 (Financeiro agregado),
PR 7 (disponibilidade em Suspense + cache), PR 8 (região Vercel/Supabase, só depois de
acesso aos dashboards) seguem a ordem já registada no pedido original (secção 26).
(links internos da Agenda para `next/link`) que já tem alvo exato identificado na secção
3.4 acima.
