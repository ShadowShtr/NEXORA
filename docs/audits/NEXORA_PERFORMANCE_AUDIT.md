# Auditoria de Desempenho, Arquitetura e Organização — NEXORA

**Âmbito desta entrega: PR 1 apenas** — baseline, instrumentação de leitura e matriz de
ficheiros. Por decisão explícita do pedido original (repositório de 632 ficheiros, 28
secções, ~12 PRs, benchmarks de infraestrutura real), esta sessão não implementa PR 2–12
(migração de região, RPCs agregadas, cache de disponibilidade, etc.). Este documento
regista **apenas o que foi verificado por leitura direta de código e por comandos
executados**, e nomeia explicitamente o que ainda não foi medido.

Branch: `perf/auditoria-total-nexora` (criada a partir de `main`).

---

## 1. Baseline recolhida

| Item | Valor | Como foi obtido |
|---|---|---|
| Commit inicial (`main`) | `b0889ce0c5530622f5ec810f8c6068fe6b142cd0` (2026-07-31 12:01 +01:00) | `git log -1` |
| Node | v24.16.0 (repo pede `>=24 <25`, `.nvmrc`=`24`) | `node -v`, `.nvmrc` |
| npm | 11.13.0 | `npm -v` |
| Next.js | `16.2.12` (declarado em `package.json` e `eslint-config-next`) | `package.json` |
| React | `19.2.7` | `package.json` |
| TypeScript | `6.0.3` | `package.json` |
| `@supabase/supabase-js` | `2.110.7` | `package.json` |
| `@supabase/ssr` | `0.12.3` | `package.json` |
| Total de ficheiros rastreados | 632 | `git ls-files \| wc -l` |

### Ficheiros por extensão

| Extensão | Contagem |
|---|---|
| `.ts` | 288 |
| `.md` | 145 |
| `.tsx` | 122 |
| `.sql` | 39 |
| `.json` | 7 |
| `.yml` | 6 |
| `.mjs` | 6 |
| `.png` | 4 |
| `.toml` | 2 |
| outros (gitignore, sh, css, mts, js, CODEOWNERS, pre-commit, gitattributes, .example, editorconfig) | 1 cada |

### Tamanho das pastas principais (ficheiros rastreados)

| Pasta | Ficheiros |
|---|---|
| `src/` | 248 (features 131 · app 77 · lib 35 · components 4 · middleware.ts 1) |
| `tests/` | 159 (unit 66 · e2e 54 specs · integration 36) |
| `docs/` | 100 |
| `supabase/` | 41 (39 `.sql`) |
| `tasks/` | 35 |
| `.github/` | 8 (workflows: `ci.yml`, `codeql.yml`, `dependency-review.yml`, `secret-scan.yml`) |
| `scripts/` | 7 |
| `public/` | 5 |

### Ficheiros com mais linhas

| Linhas | Ficheiro |
|---|---|
| 572 | `src/app/(dashboard)/dashboard/page.tsx` |
| 559 | `src/features/catalog/actions.ts` |
| 446 | `src/features/appointments/wizard/NewAppointmentWizard.tsx` |
| 422 | `src/app/b/[slug]/page.tsx` |
| 407 | `src/features/onboarding/actions.ts` |
| 357 | `src/app/(dashboard)/dashboard/financeiro/page.tsx` |
| 343 | `src/features/appointments/AppointmentCompletionPanel.tsx` |
| 343 | `src/app/b/[slug]/servicos/ServicosClient.tsx` |

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

**Não executado nesta entrega**: `npm ci`, `npm run build`, `npm run test:coverage`,
`npm run budget`, `test:integration`, `test:e2e:critical`, load test — exigem
Supabase local/produção configurado e não estavam disponíveis nesta sessão. Ver secção
"O que não foi validado".

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

- **Nenhum comando de build/teste foi executado** (`npm ci`, `lint`, `typecheck`,
  `test:coverage`, `build`, `budget`, `test:integration`, `test:e2e:critical`, load
  test). Não há `.env` local nem instância Supabase configurada nesta sessão.
- **Nenhuma métrica de navegador foi recolhida** (TTFB, LCP, INP, CLS, número de
  requests, Lighthouse) — exige `next build && next start` com ambiente real.
- **Nenhum acesso ao dashboard Vercel ou Supabase** — região física real, latência
  medida, plano/tier não confirmados.
- **`EXPLAIN ANALYZE` não foi executado** — nenhuma alegação sobre índices, planos de
  query ou tamanho de tabelas é feita; a secção 16 do pedido fica inteiramente para uma
  sessão com acesso a Postgres real.
- **A matriz de ficheiros tem colunas qualitativas (`risco_desempenho`,
  `codigo_duplicado`, `acao_recomendada`, `prioridade`) preenchidas manualmente apenas
  para os ~15 ficheiros revistos em profundidade na secção 3** — as restantes ~617 linhas
  têm as colunas objetivas preenchidas (todas lidas por conteúdo) mas essas quatro colunas
  qualitativas em branco, não fabricadas.
- **`AppShell.tsx` e os 78 ficheiros client não foram individualmente justificados**
  (hook/evento/estado/API do browser) — a secção 18 do pedido pede uma justificação por
  ficheiro; feita apenas a contagem e a confirmação de isolamento do admin client.
- **Nenhuma alteração de código foi feita** — esta entrega é só leitura + documentação,
  por decisão do utilizador de limitar o âmbito a PR 1.

---

## 5. Próximos passos sugeridos (fora do âmbito desta entrega)

Seguir a ordem de PRs definida no pedido original (secção 26), começando por PR 2 (região
Vercel/Supabase, isolado) só depois de confirmação de acesso a ambos os dashboards, e PR 3
(links internos da Agenda para `next/link`) que já tem alvo exato identificado na secção
3.4 acima.
