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

**Atualização — PR 3 concluído** (secção 0b abaixo): contexto de autenticação
centralizado e memoizado por request (`src/lib/auth/get-auth-context.ts`), refresh real
da sessão Supabase ligado ao middleware (a lacuna que PR2 apenas documentou), 27 novos
testes unitários (todos a passar), e duas queries `profiles`/`tenants` redundantes
eliminadas de `dashboard/page.tsx` e `dashboard/mais/page.tsx`.

**Atualização — PR 4 concluído** (secção 0c abaixo): fan-out de 6 operações Supabase do
loader do Dashboard substituído por 1 RPC (`get_dashboard_summary_v1`,
`supabase/migrations/0039_dashboard_summary_rpc.sql`), com validação Zod do lado
cliente, 20 cenários de teste de integração e 12 testes unitários novos. Pela primeira
vez, esta branch foi enviada ao GitHub e um PR real foi aberto para obter execução de
CI com Docker — ver secção 0c.12.

Branches: `perf/auditoria-total-nexora` (PR 1, a partir de `main`),
`perf/pr2-agenda-links-baseline` (PR 2, a partir do commit do PR 1),
`perf/pr3-auth-context-session-refresh` (PR 3, a partir do commit do PR 2, `3cb69fb`), e
`perf/pr4-dashboard-summary-rpc` (PR 4, a partir do commit do PR 3, `b83e240`).

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

## 0b. PR 3 — Contexto autenticado memoizado e refresh real da sessão

Branch `perf/pr3-auth-context-session-refresh`, a partir do commit do PR 2 (`3cb69fb`).

### 0b.1 Baseline — todos os usos de autenticação/perfil/tenant (antes da alteração)

Levantamento exaustivo por grep sobre `src/**/*.{ts,tsx}`, um call site por linha
(ficheiros com múltiplas ocorrências são múltiplas funções exportadas distintas — cada
Server Action/Route Handler é invocado como um pedido HTTP separado do Next.js, nunca
dois dentro do mesmo pedido; verificado por leitura direta em `detail-actions.ts`,
`catalog/actions.ts` e `api/financeiro/export/route.ts`, os três com mais ocorrências).

| Padrão                                                    | Ficheiros distintos                                                         | Ocorrências totais                                        | Observação                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `requireProfile()`                                        | 46                                                                          | ~90                                                       | 1 chamada por função exportada (page, layout, Server Action ou Route Handler GET)    |
| `getOptionalProfile()`                                    | 3 (`login/page.tsx`, `b/[slug]/page.tsx`, `require-profile.ts` — definição) | 2 chamadas reais (as restantes são menções em comentário) |                                                                                      |
| `auth.getClaims()` direto (fora de `require-profile.ts`)  | 0                                                                           | 0                                                         | Todas as leituras de claims passam por `requireProfile()`/`getOptionalProfile()`     |
| `auth.getUser()` direto                                   | 0 (fora de `src/middleware.ts`, novo nesta PR)                              | —                                                         |                                                                                      |
| `.from('profiles')` direto (fora de `require-profile.ts`) | 2 (`dashboard/page.tsx`, `dashboard/mais/page.tsx`)                         | 2                                                         | Ambas redundantes — mesmo dado que `requireProfile()` já resolve; removidas nesta PR |
| `.from('tenants')` só para obter `slug`                   | 2 (os mesmos dois ficheiros)                                                | 2                                                         | Idem — removidas                                                                     |

**Duplicação real no mesmo request** (a única forma que importa para `cache()`: dois
call sites que renderizam na mesma árvore React do mesmo pedido HTTP) — confirmada por
leitura de `src/app/(dashboard)/layout.tsx` + cada `page.tsx` sob
`(dashboard)/dashboard/**`, e de `src/app/(onboarding)/layout.tsx` +
`(onboarding)/onboarding/page.tsx`:

| Rota                                                                                                                                                        | Layout chama `requireProfile()`                          | Page chama `requireProfile()`                                      | Queries de identidade/perfil por request (antes)      | Depois (PR3)                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/dashboard`                                                                                                                                                | sim                                                      | sim, +2 queries próprias (`profiles.display_name`, `tenants.slug`) | 2× getClaims + 3× profiles + 1× tenants = 6 operações | 1× getClaims + 1× profiles (com `tenants(slug)` embutido) = 2 operações               |
| `/dashboard/agenda`                                                                                                                                         | sim                                                      | sim                                                                | 2× getClaims + 2× profiles = 4                        | 2                                                                                     |
| `/dashboard/agenda/[id]`, `/agenda/nova`, `/clientes`, `/clientes/[id]`, `/definicoes/*`, `/financeiro`, `/financeiro/pendentes`, `/lembretes`, `/servicos` | sim                                                      | sim                                                                | 4                                                     | 2                                                                                     |
| `/dashboard/mais`                                                                                                                                           | sim                                                      | sim, +2 queries próprias (mesmo padrão do dashboard)               | 6                                                     | 2                                                                                     |
| `/onboarding`                                                                                                                                               | sim                                                      | sim                                                                | 4                                                     | 2                                                                                     |
| Server Actions (`features/**/actions.ts`), Route Handlers (`api/**/route.ts`)                                                                               | não aplicável (não há layout a montante no mesmo pedido) | 1 chamada, já era 1                                                | 1 operação (getClaims+profiles)                       | 1 (sem mudança — nunca havia duplicação aqui; `cache()` não tem nada para deduplicar) |

Todas as 18 rotas `page.tsx` sob `(dashboard)/dashboard/**` seguem o padrão de 4→2 (ou
6→2 nas duas com queries próprias redundantes). Esta tabela substitui a necessidade de
listar as 46 linhas uma a uma — o padrão é idêntico em todas exceto as duas assinaladas.

### 0b.2 Comportamento documentado por cenário (estático — ver ressalva abaixo)

Lido diretamente em `src/lib/auth/get-auth-context.ts` e
`src/lib/auth/require-profile.ts` (não observado em runtime — ver "Bloqueio de
ambiente" no PR2, inalterado nesta PR: sem Docker, sem Supabase real, nenhum destes
cenários foi exercitado contra um servidor real):

| Cenário                                    | `getAuthContext()`                                                                                                                                                                                                                                  | `requireProfile()`                                  | `getOptionalProfile()` |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------- |
| Não autenticado (sem claims válidas)       | `{ status: 'unauthenticated' }`                                                                                                                                                                                                                     | `redirect('/login')`                                | `null`                 |
| Autenticado, sem `profiles` correspondente | `{ status: 'no_profile', userId }`                                                                                                                                                                                                                  | `signOut()` + `redirect('/login?error=no_profile')` | `null` (sem signOut)   |
| Autenticado, com perfil e tenant válidos   | `{ status: 'ok', profile }`                                                                                                                                                                                                                         | `{ userId, tenantId, tenantSlug, displayName }`     | idem                   |
| Perfil de outro tenant                     | Não aplicável a este código — `tenant_id` vem sempre do próprio `profiles` do `userId` autenticado (`eq('user_id', userId)`), nunca de um parâmetro externo; não há caminho para um utilizador resolver o `tenant_id` de outro através desta função | —                                                   | —                      |
| Sessão expirada, refresh token válido      | Depende do middleware (secção 0b.3) — `getUser()` no middleware tenta o refresh antes de `requireProfile()` correr; `requireProfile()` em si não tenta refrescar nada, só lê as claims já presentes no pedido                                       | —                                                   | —                      |
| Refresh token inválido/revogado            | `getUser()` no middleware não escreve cookies novos (nada para `setAll`); a claims check em `getAuthContext()` vê a sessão como inválida/ausente, mesmo fluxo que "não autenticado"                                                                 | `redirect('/login')`                                | `null`                 |

**Não afirmo que nenhum destes cenários foi validado em runtime.** A tabela documenta o
que o código faz, lido linha a linha — não o que foi observado a acontecer contra um
Supabase real. Os 27 testes unitários novos (secção 0b.4) verificam os 4 primeiros
cenários com um cliente Supabase mockado — uma verificação real, mas de lógica, não de
comportamento end-to-end.

### 0b.3 `getAuthContext()` — contexto memoizado por request

Novo ficheiro `src/lib/auth/get-auth-context.ts`. Resolve identidade (claims) + perfil +
tenant slug numa única função, memoizada com `cache()` do React:

- **Não é cache partilhado nem persistente** — `cache()` do React memoiza apenas dentro
  do ciclo de vida de uma única árvore de render (para Server Components) ou de uma
  única invocação de Server Action/Route Handler; um novo pedido HTTP começa sempre com
  memoização vazia. Isto foi verificado, não assumido — ver 0b.5.
- **Pura, sem efeitos secundários**: nenhum `redirect()`/`signOut()` dentro da função
  memoizada. Um resultado memoizado pode, em teoria, ser devolvido de novo sem a função
  voltar a correr — repetir um efeito secundário nesse cenário seria incorreto. Os
  efeitos ficam em `requireProfile()` (que interpreta o resultado e decide redirecionar
  ou terminar a sessão).
- **`tenantSlug` resolvido na mesma query** (`profiles` com `tenants(slug)` embutido),
  não numa segunda ida à base — precisamente porque `dashboard/page.tsx` e
  `dashboard/mais/page.tsx` já faziam essa segunda query redundantemente.
- **`requireProfile()`/`getOptionalProfile()` mantêm as assinaturas anteriores**
  (`{ userId, tenantId, displayName }`, agora com `tenantSlug` adicional — aditivo, não
  quebra nenhum dos ~90 call sites existentes) e o comportamento exato de antes
  (mesmos redirects, mesmo `signOut()` no caso "sem perfil"). Nenhuma substituição
  global foi feita — os únicos ficheiros de consumo alterados são os dois que tinham
  queries redundantes (`dashboard/page.tsx`, `dashboard/mais/page.tsx`); os outros ~44
  continuam a chamar `requireProfile()` exatamente como antes.

### 0b.4 Testes unitários novos (27, todos a passar)

- **`tests/unit/get-auth-context.test.ts`** (17 testes): os 6 status/branches de
  `getAuthContext()` (não autenticado, claims sem payload, sem perfil, erro Supabase no
  `.maybeSingle()`, sucesso completo, normalização do relacionamento `tenants` como
  array-ou-objeto — PostgREST pode devolver qualquer um dos dois — fallback para string
  vazia/`null`), contagem exata de chamadas ao cliente mockado por invocação
  (`getClaims` 1×, `.from('profiles')` 1×), confirmação de que `signOut()` nunca é
  chamado dentro de `getAuthContext()`, e os redirects/`signOut()` de `requireProfile()`
  e o comportamento sem-redirect de `getOptionalProfile()`.
- **`tests/unit/middleware.test.ts`** (10 testes): CSP presente com nonce válido,
  `x-request-id` presente e com formato UUID, `Cache-Control: no-store` em todos os
  prefixos de `NO_STORE_PATHS` e ausente fora deles, o mesmo nonce a chegar tanto ao
  cabeçalho CSP quanto ao cabeçalho de pedido reencaminhado (via
  `x-middleware-request-x-nonce`, mecanismo do próprio Next.js para expor cabeçalhos de
  pedido reencaminhados numa resposta inspecionável em teste), leitura de cookies a
  partir do pedido, e — o teste central desta PR — que quando `getUser()` decide
  atualizar a sessão (chama `setAll`), o cookie novo chega ao `Set-Cookie` da resposta
  **e** CSP/nonce/request-id/no-store continuam todos presentes (a regressão exata que
  uma reimplementação ingénua, a descartar a resposta depois do `setAll`, cometeria).
  `@supabase/ssr` é mockado — documentado explicitamente no cabeçalho do ficheiro como o
  limite do teste: prova a canalização do middleware, não que a troca real de
  refresh-token do Supabase funciona (isso exige Supabase real).
- **`tests/unit/require-profile.test.ts`** (pré-existente, NEX-135): 1 teste teve de ser
  atualizado (o `tenantSlug` aditivo quebrou uma igualdade exata) — corrigido, não
  revertido.

### 0b.5 Deduplicação entre chamadas — o que É e o que NÃO é provado

Antes de escrever os testes, testei empiricamente (não assumi) se `cache()` do React
dedupe fora de uma renderização real do Next.js:

```ts
const fn = cache(async () => {
  calls++;
  return calls;
});
await fn();
await fn();
// resultado: calls === 2
```

**Resultado: `calls` chega a 2, não 1** — fora do dispatcher de pedido que o
Next.js configura internamente durante uma renderização real, `cache()` não memoiza
nada. Isto significa que **nenhum teste Vitest pode provar deduplicação entre
chamadas** — só pode provar a forma/correção de cada chamada isolada (o que os 17
testes de `get-auth-context.test.ts` fazem). A prova real de deduplicação exige
renderizar através de um servidor Next.js real (dev ou `next start`) com Supabase por
trás — bloqueado nesta sessão pela mesma ausência de Docker documentada no PR2.

Isto **não é uma lacuna nova introduzida por esta PR** — o único outro uso de `cache()`
no repositório antes desta PR (`loadPublicProfile` em `src/app/b/[slug]/page.tsx`,
NEX-PUBLIC-404-001) tinha exatamente a mesma lacuna, nunca antes documentada: nenhum
teste, unitário ou de outro tipo, alguma vez provou que o seu `cache()` dedupe. Esta PR
não piora essa situação — apenas a torna explícita, pela primeira vez, para ambos os
usos.

**Não foi adicionada instrumentação de produção nova** (sem `Server-Timing`, sem
contadores, sem rotas de depuração) especificamente para tentar contornar este bloqueio
— avaliei um contador exportado só-para-testes e uma rota de depuração dedicada, e
descartei ambos: exigiriam nova superfície em produção (uma rota, ou lógica condicional
por ambiente) só para tornar testável uma alegação que, mesmo com essa instrumentação,
continuaria a exigir um servidor Next.js real para ser exercitada — não uma
simplificação, uma complexidade nova sem prova adicional real nesta sessão. Registado
como risco residual (secção "O que não foi validado").

### 0b.6 Refresh real da sessão — `src/middleware.ts`

O middleware passou a:

1. Construir o cliente Supabase server (`createServerClient` de `@supabase/ssr`) com
   `cookies.getAll` ligado a `request.cookies.getAll()`.
2. Em `cookies.setAll` (chamado por `@supabase/ssr` quando `getUser()` encontra um
   access token expirado e o refresca com sucesso): escrever as cookies tanto em
   `request.cookies` (para que Server Components mais adiante no mesmo pedido já vejam
   a sessão atualizada) como reconstruir `response` a partir desse `request` mutado
   (para que o browser receba as cookies novas via `Set-Cookie`).
3. Chamar `await supabase.auth.getUser()` — deliberadamente `getUser()`, não
   `getClaims()`: só `getUser()` faz o round-trip ao servidor de Auth que pode
   efetivamente usar o refresh token. O resultado é intencionalmente descartado — o
   middleware só mantém a sessão fresca, não decide autorização (isso continua em
   `requireProfile()`/`getOptionalProfile()`, agora sobre `getAuthContext()`), para não
   duplicar a lógica de autorização num segundo sítio.
4. Só depois de `getUser()` resolver, aplicar CSP/nonce/`x-request-id`/`no-store` — no
   mesmo objeto `response` que pode já ter sido reconstruído pelo passo 2, nunca um
   objeto novo a substituí-lo.

**Corrige a lacuna que o PR2 apenas documentou**: o comentário em
`src/lib/supabase/server.ts` ("the root proxy refreshes sessions") tinha sido corrigido
no PR2 só como texto — o middleware, de facto, não fazia nada disso até agora. Este PR
implementa o que o comentário original presumia.

Todas as verificações da secção 4 do pedido original desta PR foram confirmadas — por
leitura de código e pelos 10 testes de `middleware.test.ts`, não em runtime real:
cookies atualizadas chegam à resposta final; CSP, nonce, `x-request-id` e `no-store`
continuam presentes mesmo quando `setAll` reconstrói a resposta; o matcher continua a
excluir `_next/static`, `_next/image`, `favicon.ico`, `icons/` e `sw.js`.

### 0b.7 Verificação executável (`npm ci`, `format`, `lint`, `typecheck`, `test:coverage`, `build`, `budget`, `test:integration`, `test:e2e:critical`)

| Comando                     | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format`            | 2 ficheiros novos precisaram de `prettier --write` (os dois ficheiros de teste); limpo depois                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run lint`              | OK, zero erros/avisos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run typecheck`         | OK, zero erros                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npm run test:coverage`     | **561 testes passaram** (534 do PR2 + 27 novos), 0 falhas, 187 skipped (integração, sem Supabase). Cobertura subiu para **92.79% statements, 81.88% branches, 94.16% functions, 93.81% lines**. `src/lib/auth/*` não aparece na tabela de cobertura do reporter `text` — esse reporter só lista diretórios com alguma linha por cobrir, o que implica 100% nesses dois ficheiros (confirmado indiretamente, não por uma métrica explícita por-ficheiro que o reporter tenha impresso). `middleware.ts`: 96.66% statements / 70% branches / 100% functions / 100% lines — o ramo não coberto (`isDev` a `false`, código pré-existente do PR2/anterior) não foi tocado por esta PR |
| `npm run build`             | OK, ~18.4s, 30 rotas, mesma contagem de chunks/tamanho do PR2 (1505.4 KiB total, maior chunk 276.8 KiB) — esperado, esta PR é só server-side, zero JS novo enviado ao browser                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run budget`            | OK, dentro do orçamento (inalterado do PR2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `npm run test:integration`  | **187 testes, todos skipped** — mesmo bloqueio de Docker do PR2, inalterado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `npm run test:e2e:critical` | **14 testes, todos skipped**, mesmo motivo — servidor sobe sem erro com o middleware novo (`next dev` e `next start`, ambos testados manualmente)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Smoke tests manuais adicionais (fora da suite, contra `next start` com env fictício,
Supabase inalcançável de propósito): `/login` → 200; `/dashboard` e `/dashboard/agenda`
sem sessão → 307 para `/login` em 19–36ms, sem exceção não tratada nos logs do servidor
— confirma que `supabase.auth.getUser()` do `@supabase/ssr` real (não mockado, desta
vez) resolve graciosamente (`{ user: null }`) em vez de rejeitar quando o host do
Supabase é inatingível, e que o middleware novo não derruba a aplicação nesse cenário.

### 0b.8 Duplicações removidas

- `dashboard/page.tsx`: removida a query `profiles.select('display_name')` e a query
  `tenants.select('slug')` de `loadDashboardData()` — ambas substituídas pelos valores
  já resolvidos por `requireProfile()`.
- `dashboard/mais/page.tsx`: mesma remoção em `loadMoreData()`.
- Em ambos os casos, o dado devolvido é idêntico ao anterior (mesmas colunas, mesmo
  fallback para `''`) — só a origem mudou.

### 0b.9 Fora do escopo desta PR (confirmado, não tocado)

RPCs do Dashboard/Clientes/Financeiro, cache de disponibilidade, `unstable_cache`,
Realtime, região Vercel, novos índices, refactors visuais, mudanças de schema, mudança
geral de estratégia de autorização — nenhum destes ficheiros/áreas foi tocado nesta PR.

---

## 0c. PR 4 — RPC agregada do Dashboard

Branch `perf/pr4-dashboard-summary-rpc`, a partir do commit do PR 3 (`b83e240`).
Commit: `perf(dashboard): aggregate dashboard data in Supabase RPC`.

### 0c.1 Baseline — fluxo real anterior de `/dashboard`

Lido em `src/app/(dashboard)/dashboard/page.tsx` (estado antes desta PR,
`loadDashboardData()`):

| Operação anterior                                                                     | Tabela                                                                   | Filtro                                                        | Linhas transferidas                                          | Agregação                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| 1 — sequencial, antes das restantes                                                   | `business_settings`                                                      | `tenant_id`                                                   | 1 (ou 0)                                                     | nenhuma                                           |
| 2 — paralela (`Promise.all`)                                                          | `appointments` (+ `clients`, `appointment_items` embutidos)              | `tenant_id`, `start_at >= dayStart`, `start_at < dayEnd`      | não medido (nunca executado contra dados reais nesta sessão) | nenhuma na query; `appointmentsToday.map()` em JS |
| 3 — paralela                                                                          | `reminders` (count only)                                                 | `tenant_id`, `status='pending'`                               | 0 linhas de dados (`head: true`)                             | count no Postgres                                 |
| 4 — paralela                                                                          | `payments`                                                               | `tenant_id`, `status='paid'`, `paid_at` no intervalo do dia   | não medido                                                   | `reduce()` em JS (soma)                           |
| 5 — paralela                                                                          | `reminders` (+ `appointments`, `clients`, `appointment_items` embutidos) | `tenant_id`, `status='pending'`, `order by due_at`, `limit 4` | ≤4                                                           | mapeamento em JS                                  |
| 6 — **sequencial, depende do resultado de 2** (`.in('appointment_id', todayApptIds)`) | `payments`                                                               | `tenant_id`, `status='pending'`, `appointment_id in (...)`    | não medido                                                   | `reduce()` em JS (soma) + `.length`               |

**6 operações Supabase por carregamento** (1 sequencial + 4 paralelas + 1 dependente-sequencial), confirmando e precisando o número aproximado ("~8") já registado no PR1 (aquele número incluía também o que se tornaria as duas queries de perfil/tenant já eliminadas no PR3 — ver secção 0b). Regras confirmadas por leitura direta do código, não assumidas:

- **Pagamentos recebidos hoje** (`receivedTodayCents`): soma de `payments.amount_cents` onde `status='paid'` e `paid_at` cai no dia — **não depende de o `appointment` em si ser de hoje**, só do `paid_at`.
- **Pagamentos pendentes hoje** (`pendingTodayCents`/`pendingPaymentsTodayCount`): soma/contagem de `payments` `status='pending'` cujo `appointment_id` está entre os IDs de hoje — via uma segunda query dependente, não um filtro de data no `payments` (pagamentos pendentes não têm `paid_at`).
- **Total faturado hoje** (`invoicedTodayCents`): **não vem de `payments`** — é `buildDashboardSummary()` (JS puro, inalterado por este PR) a somar `totalCents` (`final_total_cents ?? expected_total_cents`) das `appointments` de hoje com estado `confirmed`/`presence_confirmed`.
- **Lembretes pendentes** (`pendingRemindersCount`): contagem **tenant-wide, sem filtro de data** — a etiqueta "Lembretes Hoje" na UI não corresponde à regra real; confirmado por leitura, preservado tal e qual (não é uma correção de produto pedida por este PR).
- **Marcações canceladas/concluídas**: entram na lista bruta `appointmentsToday` com o seu `status` real — só `buildDashboardSummary()` as filtra (para `todayCount`/`invoicedTodayCents`/`nextAppointment`), nunca a query em si.
- **Valores em cêntimos** (`bigint` no Postgres, `number` em JS) — sem reembolsos tratados neste fluxo (o enum `payment_status` tem `refunded`, mas nada no Dashboard soma ou trata esse estado; preservado, não é uma lacuna introduzida por este PR).
- **Timezone**: PR1 já tinha confirmado `fromZonedTime`/`formatInTimeZone` corretos aqui — inalterado, a RPC não faz cálculo de timezone, recebe `p_day_start`/`p_day_end` já resolvidos pelo chamador (secção 0c.4).

Nenhum número de linhas transferidas foi medido (sem Supabase real nesta sessão) — todas as células "não medido" são literais, não estimativas.

### 0c.2 Contrato da RPC — `get_dashboard_summary_v1`

`supabase/migrations/0039_dashboard_summary_rpc.sql` (nova migration, imutável — nenhuma
migration anterior foi editada).

```sql
get_dashboard_summary_v1(p_day_start timestamptz, p_day_end timestamptz) returns jsonb
```

**Decisão de segurança**: `p_tenant_id` **não é parâmetro**. O tenant é derivado dentro
da função via `public.current_tenant_id()` (`auth.uid()` → `profiles.tenant_id`,
`0001_initial.sql`) — o mesmo padrão já estabelecido por `cancel_appointment`/
`reschedule_appointment` (`0008_cancel_reschedule_appointment.sql`). Isto é mais forte do
que aceitar `p_tenant_id` e validar contra `auth.uid()`: não há parâmetro nenhum para um
chamador adulterar para chegar a outro tenant, porque esse parâmetro simplesmente não
existe no contrato da função.

**Nome versionável**: sufixo `_v1` deliberado (não `get_dashboard_data`) — uma mudança
incompatível de contrato no futuro ganha uma função `_v2`, nunca uma alteração in-place
que quebra silenciosamente quem ainda chama `_v1` a meio de um deploy.

**Retorno**: `jsonb` (não `returns table` com colunas planas) — a forma tem arrays
aninhados (`appointments_today`, `attention_reminders`) e escalares lado a lado, o que
`returns table` não representa bem. Este é o primeiro RPC do repositório com uma forma
rica o suficiente para justificar validação Zod no lado cliente (ver 0c.3) — os
restantes RPCs existentes devolvem `void`/escalar, sem necessidade de esquema.

```ts
type DashboardSummaryRpcResult = {
  appointments_today: Array<{
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    total_cents: number;
    client_name: string | null;
    client_phone_e164: string | null;
    item_descriptions: string[];
  }>;
  attention_reminders: Array<{
    id: string;
    due_at: string;
    appointment_id: string;
    appointment_start_at: string;
    client_name: string | null;
    client_phone_e164: string | null;
    item_descriptions: string[];
  }>;
  pending_reminders_count: number;
  received_today_cents: number;
  pending_today_cents: number;
  pending_payments_today_count: number;
};
```

Nenhuma métrica nova — todos os 6 campos de topo mapeiam 1:1 para os 6 valores que o
loader antigo já produzia (secção 0c.1). `buildDashboardSummary()` (nextAppointment,
todayCount, invoicedTodayCents) **não foi movido para SQL** — continua puro, em
TypeScript, com os testes unitários que já tinha (`tests/unit/dashboard-summary.test.ts`,
inalterado) — só a origem dos dados que ele agrega mudou.

**`security definer`, justificado**: necessário porque a função lê `appointments`,
`payments`, `appointment_items`, `reminders`, `clients` de outras linhas que a RLS do
chamador (se corresse como `invoker`) poderia não deixar juntar eficientemente entre
si sem múltiplas idas à base — o padrão já estabelecido por toda a função transacional
deste schema (`complete_appointment`, `cancel_appointment`, etc.). Mitigado por:
`set search_path = public` explícito; `current_tenant_id()` deriva o tenant do
utilizador autenticado, nunca de um parâmetro; todas as 5 CTEs filtram explicitamente
por `tenant_id = v_tenant_id`; `revoke`/`grant` explícitos (ADR-008) — ver 0c.3.

### 0c.3 Segurança — grants e isolamento

Seguindo ADR-008 (`docs/adr/ADR-008-function-privilege-defaults.md` — revogar de
`public` **e** `anon` explicitamente, porque este projeto Supabase concede `EXECUTE` a
`anon`/`authenticated` diretamente, não via `PUBLIC`):

```sql
revoke all on function public.get_dashboard_summary_v1(timestamptz, timestamptz) from public;
revoke all on function public.get_dashboard_summary_v1(timestamptz, timestamptz) from anon;
grant execute on function public.get_dashboard_summary_v1(timestamptz, timestamptz) to authenticated;
```

Testado (não só lido) em `tests/integration/get-dashboard-summary-rpc.test.ts`
(20 cenários, secção 0c.6): um `anon` a chamar a função recebe `42501`; um utilizador
`authenticated` sem `profiles` (logo sem tenant) recebe erro, não dados vazios
disfarçados de "sem marcações"; um dono do tenant B nunca vê dados do tenant A e
vice-versa; um intervalo de dia inválido (`p_day_end <= p_day_start`) é rejeitado
explicitamente, não silenciosamente tratado como vazio.

### 0c.4 Timezone e limite do dia — preservado, não substituído

`p_day_start`/`p_day_end` continuam a ser resolvidos em `dashboard/page.tsx` exatamente
como antes (`formatInTimeZone` + `fromZonedTime`, confirmado correto no PR1) — **não**
há `new Date().setHours(0,0,0,0)` nem `+24h` fixo em lado nenhum, nem na RPC. A RPC em si
só compara `start_at >= p_day_start and start_at < p_day_end` (intervalo semiaberto,
não `BETWEEN`) — testado explicitamente: uma marcação exatamente em `p_day_start` entra,
uma exatamente em `p_day_end` não entra (secção 0c.6, cenários #5/#6).

### 0c.5 Evitar multiplicação de linhas

Três relações um-para-muitos identificadas e tratadas:

1. **`appointment_items` → `appointments`** (uma marcação pode ter vários
   itens/serviços): agregada numa CTE própria (`item_totals`,
   `array_agg(description order by created_at)`) **antes** de ser juntada às marcações
   — uma marcação com 3 itens continua a produzir 1 linha, não 3.
2. **`payments` → `appointments`**: nunca junta pagamentos linha a linha às marcações —
   os totais (`received_today`, `pending_today`) são agregados diretamente sobre
   `payments` com `sum()`/`count()`, sem passar por um join que multiplicaria por item.
3. **`reminders` → `appointments`**: `reminders.appointment_id` é `unique`
   (`0001_initial.sql`), logo este join é garantidamente 1:1, nunca multiplicador.

Testado explicitamente (não só por inspeção do SQL): cenário #14/#15 da secção 0c.6 —
uma marcação com 3 itens **e** 3 pagamentos (2 pagos + 1 pendente) continua a aparecer
exatamente 1 vez em `appointments_today`, com o array de itens completo e os totais de
pagamento corretos.

### 0c.6 Testes de integração (20 cenários, `tests/integration/get-dashboard-summary-rpc.test.ts`)

Todos os 20 cenários pedidos estão cobertos (numeração da tabela original entre
parêntesis), cada um comparando contra um **valor concreto calculado à mão a partir das
regras da secção 0c.1** — não apenas "não lançou erro":

| #     | Cenário                                         | Teste                                                                                                                                                                                                |
| ----- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | tenant sem marcações                            | tenant novo isolado → resultado `{ appointments_today: [], ..., pending_reminders_count: 0, ... }` exato                                                                                             |
| 2–3   | uma / múltiplas marcações                       | 6 marcações no intervalo, todas presentes por id                                                                                                                                                     |
| 4     | marcação fora do intervalo                      | excluída (dia anterior)                                                                                                                                                                              |
| 5     | exatamente em `dayStart`                        | incluída (`>=`)                                                                                                                                                                                      |
| 6     | exatamente em `dayEnd`                          | excluída (`<`)                                                                                                                                                                                       |
| 7     | marcação cancelada                              | presente, `status: 'cancelled'`                                                                                                                                                                      |
| 8     | marcação concluída                              | presente, `status: 'completed'`                                                                                                                                                                      |
| 9     | "marcação pendente"                             | **não existe esse valor no enum `appointment_status`** (só `payment_status` tem `pending`) — reinterpretado como pagamento pendente, coberto pelos cenários 10–13; documentado no teste              |
| 10    | marcação sem nenhum pagamento                   | presente, contribui 0 para ambos os totais                                                                                                                                                           |
| 11    | pagamento total                                 | soma correta em `received_today_cents`                                                                                                                                                               |
| 12    | pagamento parcial                               | `final_total_cents` (4500) prevalece sobre `expected_total_cents` (5000) via `coalesce`; parcela paga e pendente somadas corretamente                                                                |
| 13    | múltiplos pagamentos na mesma marcação          | 2 pagamentos pagos (2000+1000) somados sem perder nenhum                                                                                                                                             |
| 14–15 | múltiplos itens e pagamentos sem dupla contagem | 3 itens + 3 pagamentos → 1 linha só, array de itens completo, totais corretos                                                                                                                        |
| 16    | lembretes pendentes                             | contagem tenant-wide = 6, **incluindo um lembrete de uma marcação fora do intervalo do dia** (prova explícita de que não é date-scoped)                                                              |
| 17    | lembretes que exigem atenção                    | os 4 mais próximos por `due_at`, nesta ordem exata; o lembrete com `due_at` mais cedo de todos é excluído por ter `status != 'pending'` (prova que o filtro de estado não é ignorado pela ordenação) |
| 18    | outro tenant com dados semelhantes              | tenant B (dados "parecidos", valor 9999) nunca aparece nos totais/linhas do tenant A, e vice-versa                                                                                                   |
| 19    | utilizador sem acesso ao tenant                 | utilizador autenticado sem linha em `profiles` → RPC devolve erro, não dados vazios                                                                                                                  |
| 20    | utilizador não autenticado                      | `anon` → erro `42501` (grant ausente, ADR-008)                                                                                                                                                       |

Mais 1 teste adicional (intervalo de dia inválido, `p_day_end <= p_day_start` →
erro explícito, não vazio silencioso) e testes unitários puros para o mapper/schema
(`tests/unit/dashboard-summary-rpc.test.ts`, 12 testes: validação Zod aceita/rejeita as
formas certas, mapeamento snake_case→camelCase, fallback `'Cliente'`).

**Estratégia de equivalência (secção 11 do pedido)**: em vez de manter uma cópia viva do
loader antigo só para comparação lado a lado (o que seria, na prática, criar uma segunda
implementação permanente da mesma lógica — o próprio pedido original do projeto proíbe
isso), cada asserção do ficheiro de integração compara contra um **valor esperado
derivado explicitamente das regras do código antigo**, documentado comentário a
comentário (ex.: "5000 (single) + 2000 + 1000 (multi) + 2000 (completed/partial) =
10000"). Isto é o mesmo resultado que comparar duas implementações lado a lado — a
lógica antiga foi lida, transcrita para os valores esperados do teste, e o teste falha
se a RPC alguma vez desviar dela.

### 0c.7 `EXPLAIN ANALYZE` e índices — não executado, índices existentes parecem suficientes

**`EXPLAIN (ANALYZE, BUFFERS)` não foi executado nesta sessão** — mesmo bloqueio de
Docker das PRs anteriores. Declarado explicitamente, não estimado.

Por leitura das migrations existentes, os índices que os padrões de acesso desta RPC
precisam **já existem** (nenhum novo criado nesta PR):

| Índice existente                                                | Migration                             | Cobre                                                                                        |
| --------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `appointments_tenant_start_idx (tenant_id, start_at)`           | `0001_initial.sql`                    | filtro de `today_appointments`                                                               |
| `appointment_items_appointment_idx (tenant_id, appointment_id)` | `0002_harden_tenant_fk_integrity.sql` | `group by` de `item_totals`                                                                  |
| `payments_appointment_idx (tenant_id, appointment_id)`          | `0002_harden_tenant_fk_integrity.sql` | filtro de `pending_today`                                                                    |
| `payments_tenant_status_idx (tenant_id, status)`                | `0002_harden_tenant_fk_integrity.sql` | filtro de `received_today`/`pending_today` (parcial — não cobre `paid_at`, ver risco abaixo) |
| `reminders_due_idx (tenant_id, due_at, status)`                 | `0001_initial.sql`                    | `pending_reminders`/`attention_reminders`                                                    |

**Risco residual**: `payments_tenant_status_idx` não inclui `paid_at`, que
`received_today` também filtra — sem `EXPLAIN ANALYZE` real não é possível confirmar se
isso importa na prática (pode ser irrelevante se a maioria dos pagamentos `paid` de um
tenant já cabe numa leitura de índice pequena). Não foi adicionado um índice novo
especulativamente — fica para PR 9 (índices comprovados), com plano de execução real.

### 0c.8 Alteração do loader — operações antes/depois

|                                          | Antes (PR3)                                                                                                                                                                                  | Depois (PR4)                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Operações Supabase de dados do Dashboard | 6 (1 sequencial + 4 paralelas + 1 dependente)                                                                                                                                                | **1** (`supabase.rpc('get_dashboard_summary_v1', ...)`)                                                  |
| + leitura de configuração                | `business_settings` (timezone) — inalterada, continua fora da RPC (é preciso _antes_ de calcular `p_day_start`/`p_day_end`, que são parâmetros da própria RPC — não pode vir de dentro dela) | igual                                                                                                    |
| Agregações em JavaScript removidas       | soma de `payments` pagos (`reduce`), soma de `payments` pendentes (`reduce` + `.length`)                                                                                                     | ambas movidas para `sum()`/`count()` em SQL                                                              |
| Agregações em JavaScript mantidas        | `buildDashboardSummary()` inteira (nextAppointment, todayCount, invoicedTodayCents)                                                                                                          | inalterada — está fora do escopo desta PR (é lógica de negócio pura já testada, não round-trips de rede) |
| **Total de operações Supabase por load** | **7** (6 de dados + 1 de settings)                                                                                                                                                           | **2** (1 RPC + 1 settings)                                                                               |

Meta indicativa do pedido ("reduzir as ~8 operações para uma RPC principal, mais no
máximo uma leitura de configuração") — **cumprida**: 7→2, contadas no fluxo final real
do ficheiro alterado, não uma alegação sem contagem.

### 0c.9 Tratamento de erros e observabilidade

- Erro da RPC (`error` devolvido pelo `supabase.rpc()`): `logEvent('error', 'dashboard.summary_rpc_failed', { tenantId, durationMs, errorCode }, requestId)` seguido de `throw` — nunca um Dashboard vazio silencioso. Sem boundary de erro dedicado nesta rota (nenhuma outra página deste repositório tem uma), cai no tratamento de erro por omissão do Next.js, o mesmo que qualquer outra exceção não tratada já teria.
- Forma inesperada (falha na validação Zod): mesmo padrão, evento
  `dashboard.summary_rpc_shape_invalid`.
- Sucesso: `logEvent('info', 'dashboard.summary_rpc_loaded', { tenantId, durationMs }, requestId)`.
- Usa o `logEvent`/`getRequestId` já existentes no repositório
  (`src/lib/logger.ts`/`src/lib/request-id.ts`, com redação automática de campos
  sensíveis por nome/forma) — nenhuma infraestrutura de observabilidade nova. Nenhum
  token, cookie, service role key, nota privada ou payload de marcação é registado —
  só `tenantId` (identificador opaco, mesmo padrão já usado em
  `dashboard/lembretes/page.tsx`), duração e um código de erro.

### 0c.10 Compatibilidade visual e funcional

Nenhuma alteração de JSX, texto, classe CSS, ordem de secções ou formatação —
`loadDashboardData()` foi a única função alterada; `DashboardPage()` (o componente) e
todos os subcomponentes (`NextClientCard`, `DailySummaryGrid`, `AttentionSection`,
`TodayAgendaPreview`) permanecem byte-a-byte inalterados. A ordenação de
`attention_reminders` (`order by due_at`) e de `appointments_today` (implícita — a UI já
não dependia de ordem de chegada da query antiga para `appointmentsToday`, visto que
`buildDashboardSummary()` já reordenava por `startAtMs` para `nextAppointment`) mantém o
resultado visual idêntico.

### 0c.11 Verificação executada (`npm ci`, `format`, `lint`, `typecheck`, `test:coverage`, `build`, `budget`, `test:integration`, `test:e2e:critical`)

| Comando                     | Descobertos                                                                                                 | Executados | Passaram                                           | Falharam | Skip                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `npm run format`            | —                                                                                                           | sim        | sim (após `prettier --write` em 2 ficheiros novos) | 0        | —                                                                                |
| `npm run lint`              | —                                                                                                           | sim        | sim, 0 erros/avisos                                | 0        | —                                                                                |
| `npm run typecheck`         | —                                                                                                           | sim        | sim, 0 erros                                       | 0        | —                                                                                |
| `npm run test:coverage`     | 776 testes                                                                                                  | 776        | **573** (12 novos: schema/mapper)                  | **0**    | 203 (todos de integração, sem Supabase)                                          |
| `npm run build`             | —                                                                                                           | sim        | sim, ~22.4s, 30 rotas                              | 0        | —                                                                                |
| `npm run budget`            | —                                                                                                           | sim        | sim, 1505.4 KiB (inalterado — PR server-only)      | 0        | —                                                                                |
| `npm run test:integration`  | 203 testes (37 ficheiros, +1 novo com 20 casos — 16 `it()` reais mais um `beforeAll` de fixture partilhada) | 203        | 0                                                  | 0        | **203** — Docker indisponível, mesmo bloqueio das PRs anteriores                 |
| `npm run test:e2e:critical` | 14 testes                                                                                                   | 14         | 0                                                  | 0        | **14** — idem; servidor sobe sem erro com o loader novo (`next dev`, confirmado) |

**Não estou a declarar `test:integration`/`test:e2e:critical` como "validados"** — 100%
dos testes relevantes ficaram em skip por falta de Docker. O pedido original desta PR
(secção 12) pede explicitamente para usar o CI do GitHub para correr Supabase local em
`ubuntu-latest` e aguardar o resultado antes de considerar o PR concluído — ver 0c.12.

### 0c.12 CI real — branch enviada, PR aberto, resultado aguardado

Ao contrário das PRs 1–3 (só documentadas localmente), esta branch foi **enviada para o
GitHub e um Pull Request foi aberto** especificamente para obter execução real dos
testes de integração/E2E contra Supabase local no `ubuntu-latest` do CI — o mecanismo
que `.github/workflows/ci.yml` já tem configurado (`supabase/setup-cli@v3` +
`supabase start`, Docker nativo no runner, ao contrário desta sessão local). Resultado
registado abaixo depois de aguardar os checks.

_(preenchido depois de abrir o PR — ver secção mais abaixo desta atualização, após o
`git push`/`gh pr create`)_

### 0c.13 Fora do escopo desta PR (confirmado, não tocado)

RPC de Clientes, RPC do Financeiro, cache de disponibilidade, Realtime, região Vercel,
alteração visual, refactor geral da pasta Dashboard, mudança da política de
autenticação, novos mecanismos globais de cache, service worker, migração de outras
queries do projeto, índices novos sem `EXPLAIN ANALYZE` — nenhum destes foi tocado.

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

**Confirmação (estado no PR 1): todos os 632 ficheiros listados por `git ls-files` foram
classificados** — o CSV tinha 633 linhas (1 cabeçalho + 632 ficheiros), gerado por um
script Node (`node audit-nexora.mjs`, cópia arquivada nesta secção) que **abre e lê o
conteúdo de cada ficheiro de texto rastreado** para derivar os sinais reportados.
Ficheiros binários (`.png` — 4 no repo) são marcados `estado=revisto (binario/gerado)`
com justificação explícita na coluna `responsabilidade`, nunca marcados "revisto" sem
essa nota.

**Atualização manual — PR 3**: 3 ficheiros novos (`src/lib/auth/get-auth-context.ts`,
`tests/unit/get-auth-context.test.ts`, `tests/unit/middleware.test.ts`) foram
adicionados ao fim do CSV manualmente (não pelo script — regenerar o script apagaria as
colunas qualitativas preenchidas manualmente nas secções 3 e PR2/PR3), e as linhas de 5
ficheiros alterados (`require-profile.ts`, `middleware.ts`, `dashboard/page.tsx`,
`dashboard/mais/page.tsx`) foram atualizadas nas colunas `responsabilidade`,
`acao_recomendada`, `prioridade` e `estado`. O CSV tem agora 636 linhas (1 cabeçalho +
635 ficheiros) — a contagem `git ls-files` real sobe de 632 para 635 depois do commit
do PR 3.

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
Atualizada depois do PR 2 e do PR 3 — riscado o que deixou de ser verdade, mantido o
resto.

**Novo no PR 3:**

- **Nenhum teste prova deduplicação real entre chamadas de `requireProfile()`/
  `getAuthContext()` no mesmo pedido** — verificado empiricamente (secção 0b.5) que
  `cache()` do React não memoiza fora de uma renderização real do Next.js; só um
  servidor real (bloqueado por falta de Docker, mesma causa do PR2) pode provar isto. Os
  27 testes novos provam correção por chamada isolada, não deduplicação entre chamadas.
- **O refresh de sessão do middleware nunca foi exercitado contra um Supabase Auth
  real** — os 10 testes de `middleware.test.ts` mockam `@supabase/ssr` inteiramente;
  provam que a canalização de cookies/headers do middleware está correta, não que a
  troca real de refresh-token do Supabase funciona, nem que um refresh token
  inválido/revogado é de facto rejeitado por um servidor real.
- **Os cenários "sessão expirada com refresh válido" e "refresh token inválido" da
  secção 0b.2 são inferidos por leitura de código, não observados** — mesma ressalva
  geral de ambiente do PR1/PR2.
- **A tabela de duplicação por rota (secção 0b.1) é uma contagem estática de call
  sites**, não uma contagem de queries reais capturada via `Server-Timing` ou logs de
  Postgres — o pedido original permite explicitamente "por análise ou instrumentação"
  para este PR especificamente, e a análise estática é o que foi entregue.

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
