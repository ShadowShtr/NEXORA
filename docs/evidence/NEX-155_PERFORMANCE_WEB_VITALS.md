# NEX-155 — Performance e Web Vitals

## Implementação

- **Budget de tamanho de bundle, imposto automaticamente**: `scripts/check-bundle-budget.mjs`
  (novo) mede o total de JS em `.next/static/chunks` depois de `next build` e falha
  (`process.exit(1)`) se ultrapassar 2500 KiB no total ou 400 KiB num único chunk —
  medida real na altura desta tarefa: 43 chunks, ~1478 KiB total, maior chunk ~277 KiB
  (o `zod`, usado em quase todos os schemas de validação da app). Lógica pura extraída
  para `scripts/lib/bundle-budget.mjs` (com `.d.mts` para o TypeScript verificar o
  import no teste) para poder ser testada sem tocar no sistema de ficheiros. Corre como
  novo passo `npm run budget`, adicionado ao fim de `npm run verify` — é a parte de
  "budgets" que fica realmente imposta em CI, não só documentada.
- **`lighthouse-budgets.json`** (novo) — alvos de tamanho de recurso (script/CSS/
  imagem/fonte/total) e de tempo (interactive, LCP, CLS) documentados no formato nativo
  do Lighthouse. **Nota importante**: a versão instalada do CLI Lighthouse (`13.4.1`,
  via `npx lighthouse`) já não tem a flag `--budget-path` (confirmado com
  `lighthouse --help` — não aparece na lista) — este ficheiro fica como referência de
  alvos documentados, não como um portão de CI automatizado. Só o budget de bundle
  acima é imposto de facto.
- **Sem alterações de código de otimização**: a investigação (abaixo) não encontrou
  nenhuma otimização de bundle/render com relação custo/benefício justificável para
  esta tarefa — ver "Resultado".

## Testes

- **Lighthouse real, executado nesta sessão** (não só documentado como indisponível,
  ao contrário de tarefas anteriores) — `npx lighthouse` funciona neste ambiente
  apontado ao Chromium já instalado pelo Playwright
  (`CHROME_PATH=.../ms-playwright/chromium-.../chrome.exe`), contra
  `next build && next start` real:

  | Página      | Performance | Accessibility | Best Practices | SEO | LCP   |
  | ----------- | ----------- | ------------- | -------------- | --- | ----- |
  | `/login`    | 95          | 100           | 100            | 100 | 2,9 s |
  | `/`         | 95          | 100           | 100            | 100 | 2,9 s |
  | `/marcacao` | 95          | 100           | 100            | 100 | 2,8 s |

  Peso total de página: 264–273 KiB. Nenhuma página tem falhas de acessibilidade,
  boas práticas ou SEO.

- `tests/unit/bundle-budget.test.ts` (novo, 5 casos) — testa `evaluateBundleBudget()`
  diretamente: passa dentro do orçamento, falha só por tamanho total, falha só por um
  chunk demasiado grande, falha por ambos em simultâneo, e o caso de build vazio.
- **Nota**: não foi criado nenhum teste E2E novo — não há nenhuma UI nova nesta
  tarefa (script de build + documentação).
- `npm run verify` (format, lint, typecheck, 439 testes, build, **budget**) — ✅.

## Investigação de otimização (resultado: nada corrigido, tudo documentado)

- **Achado real, quantificado, não corrigido**: `render-blocking-insight` do Lighthouse
  aponta `globals.css` (15,7 KiB, um único ficheiro CSS partilhado por toda a app) como
  render-blocking, custando ~210–307 ms estimados no primeiro paint. Corrigir isto a
  sério exigiria dividir `globals.css` (>4700 linhas) em CSS crítico/não-crítico por
  rota — uma reescrita grande e arriscada para um ganho de ~0,2–0,3 s numa app que já
  pontua 95/100 em performance. Fora do âmbito desta tarefa; registado como risco
  residual quantificado, não como dívida técnica não registada.
- `unused-javascript` (~27 KiB) e `unused-css-rules` (~14 KiB) — inspecionados; o JS
  não usado está dentro do runtime do próprio React/React-DOM (normal, não é código
  desta app), o CSS não usado é a consequência esperada de uma única folha de estilos
  partilhada por toda a app (decisão de arquitetura já tomada, não desta tarefa).
  Nenhum dos dois vale a pena perseguir isoladamente.
- `<img>` em vez de `next/image` em 6 ficheiros (fotos de serviços/clientes/negócio
  carregadas pela dona) — já tinham `// eslint-disable-next-line @next/next/no-img-element`
  explícito, uma decisão já tomada e documentada por uma tarefa anterior (URLs
  dinâmicas do Supabase Storage por tenant). Não revisitado.
- `qrcode` (biblioteca client-side) só é importada em `PublishStep.tsx`
  (`/onboarding`, um passo do wizard visitado uma vez). Já beneficia do code-splitting
  automático por rota do Next.js App Router — `next/dynamic` não traria ganho adicional
  que justifique a complexidade extra.

## Resultado

A app já tinha boa performance antes desta tarefa (95/100 Lighthouse, medido agora pela
primeira vez com números reais em vez de suposição). O budget de bundle fica imposto
automaticamente em CI a partir de agora — protege contra uma regressão futura (ex.:
uma dependência pesada importada sem querer num chunk partilhado), que é o objetivo
real de "budgets" nesta fase do produto, mais do que perseguir otimizações marginais
numa app já rápida.

## Riscos residuais

- "p75 alvo" não é mensurável sem tráfego real de utilizadoras — os números acima são
  de laboratório (Lighthouse), não percentis de campo. Precisaria de uma ferramenta de
  RUM (ex.: Vercel Analytics/Web Vitals reporting) — não configurada, decisão fora do
  âmbito desta tarefa (introduzir uma nova integração externa sem necessidade já
  demonstrada, `CLAUDE.md`).
- `lighthouse-budgets.json` não é imposto automaticamente (CLI Lighthouse instalado já
  não suporta `--budget-path`) — só documenta alvos.
- CSS render-blocking (`globals.css`) quantificado (~210–307 ms) mas não corrigido —
  candidato a uma tarefa dedicada de divisão de CSS crítico, se o ganho vier a
  justificar-se.

## Próxima tarefa desbloqueada

Nenhuma dependente direta — EPIC-15 fica assim concluído (`NEX-150` a `NEX-155`, todas
concluídas). Próximo épico não iniciado: EPIC-16 — Privacidade, segurança e direitos
(`NEX-160`, depende de `NEX-004`/`NEX-011`, ambas já concluídas).
