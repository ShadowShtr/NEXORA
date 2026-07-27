# NEX-164 — Headers/CSP completos

## Implementação

- **Achado crítico, encontrado ao implementar esta tarefa**: `src/proxy.ts`
  (renomeado de `middleware.ts` na `NEX-153`, seguindo o aviso de depreciação do
  próprio Next.js) **nunca foi realmente compilado pelo build de produção
  (Turbopack) do Next.js 16.2.10**. `.next/server/middleware-manifest.json` saía
  sempre `"middleware": {}` — vazio — de um `next build` limpo. Confirmado por
  rebuild A/B direto: renomear o mesmo ficheiro de volta para `middleware.ts`
  (`export function middleware`, não `proxy`) é o que faz o Turbopack compilar e
  popular o manifest corretamente; `proxy.ts` no mesmo sítio, com o mesmo conteúdo,
  produz sempre manifest vazio. **Consequência real**: o `Cache-Control: no-store`
  da `NEX-153` nunca esteve realmente ativo em produção desde esse rename — a app
  esteve a usar só o `no-cache, must-revalidate` mais fraco que já era o
  comportamento por omissão do Next.js nessas rotas, sem eu me aperceber, porque a
  verificação manual da `NEX-153` (com `curl`) foi feita antes do rename final para
  `proxy.ts`. Corrigido nesta tarefa: `src/middleware.ts` (nome revertido), com um
  comentário extenso no topo do ficheiro a explicar isto e a avisar para nunca
  renomear de volta para `proxy.ts` sem reverificar o manifest depois de um
  `next build` limpo.
- **CSP com nonce por pedido**: `src/middleware.ts` gera um nonce novo em cada
  pedido (`crypto.randomUUID()`), define `Content-Security-Policy` na resposta e
  propaga-o via cabeçalho `x-nonce` no pedido — o Next.js deteta esse nonce
  automaticamente e aplica-o aos seus próprios scripts (confirmado: os cabeçalhos
  `Link` de preload de fontes também saem com o mesmo `nonce=...`). `app/layout.tsx`
  chama `headers()` (novo `await`, tornando o componente `async`) — é o que ativa a
  deteção do nonce pelo Next.js; sem isto, não há contexto por pedido nenhum para
  threading. Efeito colateral aceite: `/`, `/login`, `/definir-password`,
  `/recuperar-password` e `/marcacao` deixam de poder ser pré-renderizadas
  estaticamente (passam de `○` a `ƒ` no output do build) — inerente a um nonce por
  pedido, não uma regressão evitável.
- **Fontes CSP escolhidas por leitura real do código, não suposição**:
  `challenges.cloudflare.com` (Turnstile, `TurnstileWidget.tsx`, carrega um script e
  renderiza um iframe) e `https://*.supabase.co` (todas as chamadas cliente de
  auth/dados, e imagens do Storage). Confirmado que WhatsApp/Instagram/Google Maps
  são só `<a href>` de navegação (CSP não os governa) e que Resend/verificação
  Turnstile são `fetch` só do servidor (CSP é um mecanismo só de browser, nunca se
  aplica aí).
- **`style-src` sem nonce, deliberadamente**: emparelhar um nonce com
  `'unsafe-inline'` na mesma diretiva faz browsers modernos ignorarem
  `'unsafe-inline'` por completo (regra CSP2) — partiria os `style={{...}}` que a
  app usa mesmo em 5 ficheiros (barras dinâmicas, esqueletos de carregamento), já
  que não existe mecanismo de nonce para atributos de estilo inline, só para
  elementos `<style>`. `script-src` (o limite realmente relevante para XSS) mantém-se
  estrito com nonce + `'strict-dynamic'`.
- **HSTS** adicionado a `next.config.ts` (`max-age=63072000; includeSubDomains`),
  sem `preload` — submeter à lista de preload dos browsers é uma decisão difícil de
  reverter (meses a propagar a remoção) que a dona deve tomar conscientemente mais
  tarde, não algo para ativar silenciamente aqui.

## Testes

- **Verificação empírica com browser real** (não só leitura de cabeçalhos):
  `next build && next start` + Chromium headless (Playwright) a navegar `/login`,
  `/` e `/marcacao` — zero erros de consola (incluindo violações CSP), preenchimento
  do campo de e-mail confirma hidratação real (não só HTML estático), e uma
  screenshot confirma que o CSS/fontes carregam e renderizam por completo
  (claymorphism, gradientes, tipografia — nada partido).
- **Lighthouse antes/depois**: performance mantém-se em 95/100 (mesma pontuação da
  baseline da `NEX-155`) apesar da perda de pré-renderização estática nessas 5
  rotas — o nonce por pedido não introduziu regressão de performance mensurável.
- `tests/e2e/security-headers.spec.ts` (novo, 4 casos) — cobre o teste obrigatório
  desta tarefa ("Header tests"): CSP e HSTS presentes com a forma esperada; o nonce é
  o mesmo em toda a resposta (nunca dois valores diferentes no mesmo pedido); uma
  navegação real de login → dashboard nunca dispara uma violação CSP na consola, e o
  formulário permanece interativo; a página pública de consulta de marcação carrega
  sem violação.
- **Estes testes correram de verdade nesta sessão** (não só ficaram escritos) —
  usando as credenciais reais do projeto Supabase de dev (`.env.local`, mesmo projeto
  cloud da `ADR-007`) contra o build de produção: `4/4 passaram`. Também reconfirmei
  `tests/e2e/cache-security.spec.ts` (`NEX-153`) contra o mesmo build de produção:
  `3/3 passaram`, incluindo o caso que tinha ficado silenciosamente por verificar
  desde o rename para `proxy.ts`.
- `npm run verify` (format, lint, typecheck, 446 testes, build, budget) — ✅.

## Achado adicional fora do âmbito desta tarefa (reportado, não corrigido)

Ao correr uma amostra mais larga de specs E2E existentes contra o mesmo build de
produção (para confirmar que o CSP não regride nada), fiquei com evidência real,
pela primeira vez nesta sessão, de que os testes E2E deste projeto **podem correr de
facto** (as credenciais de dev já configuradas localmente chegam, sem precisar de
Docker/WSL2). Isso revelou dois problemas pré-existentes, sem qualquer relação com
CSP/headers, nunca antes detetados porque nenhum destes specs tinha corrido de
verdade neste projeto:

1. **Violações de acessibilidade reais** (`axe`) em `/dashboard`, nas 7 subpáginas de
   `/dashboard/definicoes`, em Agenda/Clientes/Mais, e na página pública `/b/[slug]`
   — a mais concreta: "Some page content is not contained by landmarks" (região não
   coberta por landmark) em `.public-platform-credit`/`.public-booking-footer`.
2. **Potencialmente mais grave**: `/b/[slug]` devolve `200` (não `404`) para uma
   tenant suspensa, uma tenant ativa mas não publicada, e um slug inexistente —
   contrariando o que `docs/04_DATA_MODEL.md`/o comentário do próprio código
   (`page.tsx`, linha 28) descrevem como o comportamento esperado via RLS
   (`tenants.status='active'`, `business_settings.published_at is not null`). Não
   investigado a fundo — pode ser uma RLS realmente permissiva (exposição pública de
   perfis suspensos/não publicados) ou um artefacto do próprio teste; qualquer uma
   das duas merece triagem prioritária, dado o tema.

Não corrigido nesta tarefa — seria expandir muito o âmbito de "headers/CSP" para uma
auditoria de acessibilidade e de RLS. Reportado à dona separadamente.

## Resultado

O maior resultado real desta tarefa não é o CSP em si, mas encontrar e corrigir um
bug crítico e silencioso: o mecanismo de middleware/proxy desta app estava
inteiramente inativo em produção desde a `NEX-153`, sem que nada (build, lint,
`npm run verify`, nem a verificação manual anterior) o detetasse. O CSP com nonce
está agora implementado, verificado com browser real, e sem regressão de
performance.

## Riscos residuais

- Achado adicional acima (violações de acessibilidade + página pública de tenant
  suspensa/não publicada a responder 200) — não investigado nem corrigido, reportado
  para triagem.
- Turnstile (script/iframe de `challenges.cloudflare.com`) não foi exercitado ao
  vivo — sem conta real provisionada (`NEX-160`), não há como a página realmente
  carregar o widget para confirmar a diretiva CSP na prática; a permissão foi
  concedida por leitura de código, não por carregamento real.
- `Strict-Transport-Security` sem `preload` — decisão consciente, ver acima.

## Próxima tarefa desbloqueada

NEX-165 — Hardening de uploads (depende de NEX-094, já concluída).
