# NEX-044 — Interface extremamente simples de catálogo

## Decisão de scope

Discutido com o dono antes de implementar: "extremamente simples" é o critério aprovado (`CLAUDE.md`, `docs/01_PRODUCT_REQUIREMENTS.md`) para a utilizadora-alvo (profissional independente sem conhecimento técnico), não uma escolha arbitrária. Confirmado que esta tarefa é **polimento visual sobre a mesma interação simples já existente** (`NEX-040`–`NEX-043`) — não uma adoção de padrões de concorrentes (Fresha/Booksy: arrastar para reordenar, ações em lote, etc.), que ficaria registada como decisão de scope à parte se algum dia for pedida.

## Implementação

- `src/components/ui/Button.tsx`: novo `variant?: 'primary' | 'secondary'` (default `primary`, comportamento inalterado para todo o resto da app). `secondary` = contorno rosa claro, sem sombra, usado nas ações não-primárias de cada linha do catálogo (Ocultar/Mostrar, Ativar/Desativar, mover ↑/↓, Remover do carrinho) — cria hierarquia visual clara com a ação principal ("Guardar", que continua `primary`).
- `CategoriesManager.tsx` / `ServicesManager.tsx` / `PackagesManager.tsx`: ícone `lucide-react` (`Tags`/`Scissors`/`Gift`, `aria-hidden`) junto ao título de cada secção; estados vazios com nova classe `.catalog-empty` (caixa tracejada); formulário de criação separado da lista por `.catalog-add-form` (divisória tracejada); preço/duração em `.catalog-service-summary` agora é uma pílula rosa em vez de texto simples.
- `src/app/globals.css`: **bug real encontrado e corrigido** — vários `display: grid` de coluna única (`.stack`, `.catalog-list`, `.catalog-row`, `.catalog-package-items`, `.catalog-cart-list`, `.hours-list`, `.hours-day`, `.services-list`, menus de navegação) não tinham `grid-template-columns`, deixando os itens crescerem pelo conteúdo intrínseco em vez de encolher — em mobile isto forçava overflow horizontal e a página inteira "dava zoom"/scroll lateral. Corrigido com `grid-template-columns: minmax(0, 1fr)` (coluna única) ou `repeat(N, minmax(0, 1fr))` (`.dashboard-grid`, `.hours-times`, `.mobile-nav`, grids multi-coluna). A regra partilhada `input, select` ganhou `min-width: 0` (mesmo problema em contexto `flex`). Este bug já afetava a página pública de demonstração (`/b/[slug]`, corrigido antes, fora do processo formal) — agora corrigido na origem, para toda a aplicação.

## Testes

- `tests/e2e/catalog-mobile-layout.spec.ts` (novo, 4/4 ✅ em `chromium` e `webkit-mobile`): `document.documentElement.scrollWidth` nunca excede `clientWidth` em `/dashboard/servicos`, com categorias/serviços/pacotes vazios e depois com uma categoria + um serviço + um pacote criados — fixa a regressão do bug de overflow encontrado nesta tarefa.
- Regressão completa: `tests/e2e/catalog-categories.spec.ts` (6), `catalog-services.spec.ts` (6), `catalog-packages.spec.ts` (6) e `dashboard-shell.spec.ts` (4, 1 skip esperado) — 45/46 ✅ em `chromium` + `webkit-mobile` (Axe incluído em todos). `tests/e2e/onboarding-*.spec.ts` (30/30 ✅, chromium) confirmam que as mudanças de CSS partilhado (`.stack`, `input`/`select`, `.hours-list`/`.hours-day`, `.services-list`) não regrediram nenhum passo do onboarding.
- `npm run verify` — ✅.

## Resultado

`/dashboard/servicos` fica visualmente mais claro (ícones, hierarquia de botões, badges) sem ganhar nenhuma complexidade de interação nova — e deixa de "dar zoom" em telemóvel, um bug que já afetava silenciosamente várias partes da aplicação (não só o catálogo).

## Riscos residuais

Nenhum identificado.

## Próxima tarefa desbloqueada

EPIC-04 concluída. Próxima: NEX-050 — Criar página pública por slug (início da `EPIC-05 — Página pública e pré-cadastro`), que deve rever/formalizar o trabalho de demonstração já existente em `src/app/b/[slug]/` (feito fora do processo formal — ver `docs/02_UX_FLOWS.md`).
