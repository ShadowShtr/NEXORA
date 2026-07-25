# NEX-153 — Estratégia de cache segura

## Implementação

- **Service worker novo** (`public/sw.js`, antes inexistente) — só faz cache de
  `/​_next/static/*` (assets com hash de conteúdo, imutáveis) e `/icons/*` (ícones
  PWA); qualquer outro pedido nunca é intercetado (`event.respondWith` nunca é chamado
  para ele), pelo que o comportamento normal de rede — e o `Cache-Control: no-store`
  explícito das rotas sensíveis — se aplica sem alteração. Escrito à mão (sem
  Workbox/`next-pwa`) por ser uma política pequena e bem definida; `CLAUDE.md` pede para
  não introduzir dependências sem necessidade demonstrada.
  - Também resolve um problema levantado mas não fechado na `NEX-152`: o
    `beforeinstallprompt` do Chrome/Android exige um service worker registado como
    parte dos critérios de instalabilidade — sem ele, o botão "Instalar" do
    `InstallAppCard` podia nunca aparecer.
- **Registo do service worker**: `src/features/shell/ServiceWorkerRegistration.tsx`
  (novo, cliente, sem UI), montado em `layout.tsx`. Falha de registo é ignorada em
  silêncio de propósito — instalabilidade é um extra progressivo, não um requisito
  para a app funcionar.
- **`Cache-Control: no-store` para auth/booking token — bug real encontrado a meio da
  implementação**: a primeira tentativa foi um `headers()` normal em `next.config.ts`
  a apontar `no-store` para `/login`, `/dashboard/:path*`, `/marcacao/:path*`, etc.
  Verificado com `next build && next start` + `curl -I`, esse header **nunca chegava à
  resposta real** — o Next.js define o seu próprio `Cache-Control` internamente ao
  renderizar rotas dinâmicas (`no-cache, must-revalidate`, tecnicamente mais fraco que
  `no-store`: ainda permite guardar a resposta, só exige revalidação), e esse valor
  sobrepõe-se ao do `next.config.ts`. Resolvido com `src/proxy.ts` (novo — a convenção
  `proxy` substitui `middleware` desde o Next.js 16;
  `npx @next/codemod middleware-to-proxy` confirma o padrão), que corre por último no
  pipeline de resposta e por isso é o que realmente chega ao cliente. Âmbito do
  `matcher`: `/login`, `/definir-password`, `/recuperar-password`, `/onboarding`,
  `/dashboard/:path*`, `/marcacao/:path*` (token de marcação na URL),
  `/api/bookings/:path*` (token de marcação). Deliberadamente **não** inclui
  `/b/[slug]` — página pública sem token secreto, destinada a ser partilhável/rápida.
  `next.config.ts` mantém só os `securityHeaders` já existentes; a tentativa falhada de
  `no-store` por `headers()` foi removida (ficaria morta/enganosa).

## Testes

- `tests/unit/service-worker-cache-policy.test.ts` (novo, 13 casos) — extrai
  `isCacheableAssetPath` diretamente do texto-fonte real de `public/sw.js` (mesma
  técnica de `design-tokens-contrast.test.ts` para `globals.css`, sem cópia
  duplicada): confirma que assets e ícones são elegíveis, e que 11 caminhos sensíveis
  (`/api/bookings/...`, `/marcacao/...`, `/login`, `/dashboard`, `/onboarding`, etc.)
  nunca são.
- `tests/e2e/cache-security.spec.ts` (novo) — cobre o teste obrigatório desta tarefa
  ("Inspeção service worker"): após duas navegações reais com o service worker já
  ativo, inspeciona a Cache Storage API (`caches.keys()`/`cache.keys()`) e confirma que
  tudo o que lá está começa por `/_next/static/` ou `/icons/`, nunca por `/dashboard`,
  `/api/` ou `/login`; mais dois testes que confirmam
  `Cache-Control: no-store` na resposta real de `/dashboard` e de
  `/api/bookings/[token qualquer]`.
- **Nota**: tal como os restantes specs E2E deste repositório, não corre no CI atual
  (sem job de Playwright configurado). Não foi possível correr localmente por falta de
  Docker/WSL2 (`ADR-007`).
- **Verificação manual real com `next build && next start` + `curl -I`** (não apenas
  leitura de código): confirmado `cache-control: no-store` em `/login`, `/dashboard`,
  `/marcacao/abc`, `/api/bookings/faketoken`; confirmado que `/b/some-slug` e `/`
  **não** ficaram afetados (mantêm o `Cache-Control` cacheável do Next.js). Foi assim
  que o bug do `next.config.ts` original foi encontrado — a primeira tentativa não
  passou neste teste manual antes de ser substituída pelo `proxy.ts`.
- `npm run verify` (format, lint, typecheck, 432 testes, build) — ✅.

## Resultado

Existe agora uma política de cache explícita e verificada: só assets estáticos passam
pelo service worker, e as rotas de autenticação/token de marcação são servidas com
`Cache-Control: no-store` de facto (confirmado por curl, não só suposto pelo código).
Como efeito colateral, o service worker cumpre um pré-requisito de instalabilidade que
faltava desde a `NEX-152`.

## Riscos residuais

- `public/icons/*` não tem hash de conteúdo — se os ícones voltarem a mudar (ex.: numa
  futura `NEX-154`), `CACHE_NAME` em `public/sw.js` tem de ser incrementado manualmente
  para invalidar a cópia em cache; documentado em comentário no próprio ficheiro.
- O botão "Instalar" (`NEX-152`) continua sem confirmação end-to-end de que o Chrome
  dispara `beforeinstallprompt` num dispositivo real — o service worker (pré-requisito)
  agora existe, mas isso não foi validado num browser/dispositivo real nesta sessão.

## Próxima tarefa desbloqueada

NEX-154 — Auditoria WCAG 2.2 AA (depende de NEX-151, já concluída — não bloqueada por
esta tarefa, mas relacionada; há risco residual de contraste já registado em NEX-151
que pode ser resolvido aí).
