# NEX-043 — Regras de combinação pacote/extras

## Implementação

- `src/features/catalog/domain/package-cart.ts` (novo, pura, sem UI): `addToCart(cart, item)` — adiciona um serviço ao carrinho, ou devolve `{ cart inalterado, blocked: true }` se o serviço já lá estiver (bloqueia a duplicação em vez de a ignorar silenciosamente ou duplicar); `removeFromCart(cart, serviceId)`; `cartTotals(cart)` — soma preço e duração de todos os itens (recalcula).
- `src/features/catalog/PackageCart.tsx` (novo): substitui os checkboxes simples de `NEX-042` nos formulários de criar/editar pacote. Um `<select>` que só lista serviços **ainda não adicionados** (torna um pedido de duplicado impossível pela própria interface, além do bloqueio na lógica pura) + botão "Adicionar"; cada item do carrinho tem "Remover"; um resumo "Duração total · Soma dos preços dos serviços" recalcula a cada alteração, ainda antes de guardar — os itens vão para o formulário como `<input type="hidden" name="serviceIds">`, pelo que as actions de `NEX-042` (`createPackage`/`updatePackage`) não precisaram de nenhuma alteração.
- `src/features/catalog/PackagesManager.tsx`: usa `<PackageCart>` em vez do antigo `ServiceCheckboxes` (removido). Correção de um bug real encontrado pelos testes (ver abaixo).
- `src/app/globals.css`: `.catalog-cart-list`, `.catalog-cart-item`, `.catalog-cart-total`, `.catalog-cart-add` (substituem `.catalog-package-item`, removida).

## Bug encontrado e corrigido durante os testes

O primeiro teste E2E do carrinho a recalcular em tempo real apanhou um bug real: `PackageCart` guarda o carrinho em estado local do React (`useState`), que uma submissão bem-sucedida do formulário de criação **não limpava** — ao criar um segundo pacote a seguir a um primeiro, o carrinho começava já com os itens do pacote anterior (e, se esse serviço fosse o único disponível, o seletor ficava vazio e o teste bloqueava). Corrigido em `PackagesManager.tsx`: o `PackageCart` do formulário de criação agora remonta (via `key`) sempre que `createPackage` tem sucesso. O ajuste do estado acontece durante o render (não em `useEffect`) ao detetar a mudança de `createState` — o projeto já tem uma regra de lint (`react-hooks/set-state-in-effect`) que impede `setState` síncrono dentro de efeitos, e este é exatamente o padrão que a documentação do React recomenda para "repor estado quando uma prop muda".

## Testes

- `tests/unit/package-cart.test.ts` (10/10 ✅): adicionar a carrinho vazio; adicionar segundo item diferente; **bloquear adicionar o mesmo serviço duas vezes, carrinho inalterado**; não mutar o array original; remover item existente/inexistente/o último restante; `cartTotals` soma corretamente, `{0,0}` vazio, recalcula bem após um "adicionar" seguido de "remover".
- `tests/e2e/catalog-packages.spec.ts` (6/6 ✅ em `chromium` e `webkit-mobile`, ampliado de 5 para 6): novo teste "the cart recalculates totals as services are added and removed" — resumo evolui 0 → 60 min/25,00€ → 105 min/55,00€ → 45 min/30,00€ ao longo de adicionar/adicionar/remover; confirma que o serviço já adicionado desaparece do seletor e reaparece ao ser removido; os 5 testes existentes (Axe, criar, nome duplicado, ativar/desativar, mensagem sem serviços) adaptados ao novo fluxo de carrinho e continuam a passar.
- Regressão: `npm run verify` completo (131 testes unit/integration) e `catalog-categories`/`catalog-services` (12/12) sem quebras.

## Resultado

Montar um pacote deixa de ser "marcar caixas às cegas": a dona vê logo quanto tempo e quanto valor em serviços está a incluir, à medida que adiciona, sem conseguir adicionar o mesmo serviço duas vezes.

## Riscos residuais

Nenhum identificado (o único encontrado foi corrigido antes do merge — ver acima).

## Próxima tarefa desbloqueada

NEX-044 — Interface extremamente simples de catálogo (depende de NEX-043, concluída). Início do próximo bloco de 5 tarefas.
