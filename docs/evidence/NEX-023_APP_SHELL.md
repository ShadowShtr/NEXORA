# Evidência — NEX-023 Implementar shell responsivo autenticado

**Data:** 17 de julho de 2026
**Estado:** concluído

## Implementação

- `src/features/shell/AppShell.tsx`: menu conforme `01_PRODUCT_REQUIREMENTS.md` #14 — mobile: barra inferior fixa (Início, Agenda, Clientes, Serviços, Mais); "Mais" abre um painel com Financeiro, Relatórios, Definições e Terminar sessão. Desktop: sidebar persistente mostra tudo diretamente (amplia, não duplica, `CLAUDE.md`), sem "Mais".
- Skip link (`Saltar para o conteúdo`) primeiro elemento focável; `<main id="main-content" tabIndex={-1}>` recebe o foco real quando ativado (não só scroll — técnica WCAG G1).
- `aria-current="page"` em ambos os layouts; painel "Mais" fecha com Escape (devolve foco ao botão) ou clique fora; `aria-expanded` no botão.
- Rotas do menu ainda não implementadas (`/dashboard/agenda`, `/clientes`, `/servicos`, `/financeiro`, `/relatorios`, `/definicoes`) receberam páginas mínimas "em breve" — necessário porque `typedRoutes: true` exige que `<Link href>` aponte para rotas reais existentes; serão substituídas pelas tarefas dos respetivos épicos (`EPIC-04`, `08`, `09`, `13`, `14`).
- `LogoutButton` retirado da página do dashboard (estava lá temporariamente desde `NEX-020`) — agora vive só no shell.

## Achados corrigidos

1. **Contraste insuficiente (Axe, real):** item de navegação ativo tinha `color: var(--pink-600)` sobre fundo `var(--pink-100)` — ratio 4.37:1, abaixo do mínimo AA (4.5:1). Corrigido para `color: var(--text)` (mais escuro) + peso de fonte maior nos três locais (desktop, mobile bottom bar, painel "Mais") — o destaque de "ativo" deixa de depender só da cor, mais acessível e mais robusto.
2. **`LogoutButton` da sidebar sobrepunha o overlay de dev do Next.js:** `flex: 1` na lista de navegação empurrava o botão para o canto inferior esquerdo do ecrã, exatamente onde o `next dev` posiciona o seu próprio indicador flutuante — bloqueava cliques em testes locais (só em `next dev`, não afeta produção). Corrigido removendo o `flex: 1`, o botão fica logo a seguir à lista.
3. **`useSearchParams`/nested `<main>`:** ao integrar o shell, a página do dashboard passou a ter dois elementos `<main>` aninhados (o seu próprio + o do shell) — corrigido trocando o elemento raiz da página para `<div>`.

## Testes — Axe + Playwright mobile/desktop

`tests/e2e/dashboard-shell.spec.ts` (5 testes) + atualização de `tests/e2e/login.spec.ts` (o fluxo de logout mudou de posição), corridos em `chromium` e `webkit-mobile`:

1. **0 violações Axe** (`@axe-core/playwright`) na página do dashboard autenticada.
2. **Nav correta por viewport:** mobile mostra barra inferior + botão "Mais" (Financeiro escondido); desktop mostra tudo diretamente (sem "Mais").
3. **Painel "Mais" (mobile):** abre, `aria-expanded=true`; Escape fecha, `aria-expanded=false`, foco volta ao botão.
4. **Skip link:** focável, ao ativar move o foco real para `#main-content` (verificado com `toBeFocused`, não só a URL/scroll).
5. **`aria-current`** correto nos dois layouts, incluindo o escondido por CSS (`includeHidden: true` no locator — por omissão o Playwright ignora elementos `display:none`).

## Resultado

- `npm run verify`: aprovado.
- 25/26 testes E2E aprovados (1 skip esperado por design — teste mobile-only não corre no projeto desktop). Suite completa: smoke, login, password-recovery, protected-routes, dashboard-shell.
- Fecha `EPIC-02` (Autenticação e sessão da dona): `NEX-020` a `NEX-023` concluídas.
- Próxima tarefa desbloqueada: `NEX-030` (`EPIC-03` — motor de wizard persistente).
