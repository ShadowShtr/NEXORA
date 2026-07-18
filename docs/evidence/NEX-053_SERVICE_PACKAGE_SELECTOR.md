# NEX-053 — Criar seletor Serviços/Pacotes

## Implementação

- `src/app/b/[slug]/domain/booking-selection.ts` (novo, puro, sem UI): `cartLines(selection, services, packages)` — devolve a lista de linhas a cobrar: a linha do pacote escolhido (se houver) mais cada serviço avulso selecionado que **não** esteja já coberto pelo pacote (`PRD 01 §4`: "A cliente pode combinar pacote com extras, sem duplicação de itens já incluídos"). `cartTotals(lines)` soma preço/duração dessa lista já deduplicada. `dropServicesCoveredByPackage(ids, pkg)` — usado ao escolher um pacote, para remover do conjunto de "extras" qualquer serviço que esse pacote já cubra (evita um checkbox marcado-mas-desativado ambíguo).
- `src/app/b/[slug]/page.tsx`: cada `PackageOption` passa a incluir `serviceIds: string[]` (antes só tinha `itemNames`, o texto legível) — necessário para o cliente calcular a sobreposição.
- `src/app/b/[slug]/domain/draft.ts`: `draftPayloadSchema` — `selectedIds: uuid[]` (plano) passou a `selectedPackageId: uuid | null` + `selectedServiceIds: uuid[]`, refletindo o novo modelo de seleção. Sem migração — é só o formato do payload cifrado em `booking_drafts.encrypted_payload` (`NEX-052`), nunca uma coluna.
- `src/app/b/[slug]/PublicBookingCart.tsx`: reescrito para o novo modelo.
  - Pacotes passam de checkboxes múltiplos para um `<fieldset>` de `radio` (escolha única — "escolher pacote promocional" é singular no PRD) com uma opção explícita "Nenhum pacote" (permite desmarcar).
  - Cada serviço já coberto pelo pacote escolhido aparece com o checkbox `checked` + `disabled` e um selo "· Incluído no pacote" — visualmente impossível de duplicar, além do `cartLines` já deduplicar defensivamente no cálculo.
  - Escolher um pacote remove automaticamente do conjunto de extras qualquer serviço que esse pacote passe a cobrir (`dropServicesCoveredByPackage`) — evita que uma seleção manual feita antes do pacote fique "presa" num estado sem efeito no total.
  - Total/resumo/mensagem de WhatsApp usam `cartLines`/`cartTotals` em vez do antigo `Set` plano — um único ponto de verdade para a dedução.
- `src/app/globals.css`: `input[type='radio']` reaproveita o estilo do checkbox; `.public-service-included` (selo "incluído"); `.public-package-fieldset` (reset de `fieldset`/`legend` nativo, mantém o "Pacotes" como título visual igual ao anterior `<h2>`).

## Testes

- `tests/unit/booking-selection.test.ts` (novo, 12/12 ✅): `cartLines` sem seleção → vazio; serviços avulsos sem pacote; pacote sozinho; serviço já coberto pelo pacote excluído (não duplica); extra genuíno somado ao lado do pacote; `selectedPackageId` desconhecido tratado como "sem pacote". `cartTotals` soma corretamente, `{0,0}` vazio, confirma que o total pós-dedup nunca conta o pacote+serviço incluído em dobro. `dropServicesCoveredByPackage` mantém ids sem pacote, remove só os cobertos, não muta o array de entrada.
- `tests/e2e/public-service-package-selector.spec.ts` (novo, 5/5 ✅ em `chromium` e `webkit-mobile`): Axe com pacote selecionado; escolher o pacote cobra-o uma vez só e o serviço incluído fica marcado+desativado, e um extra genuíno (não incluído) soma normalmente por cima; marcar um serviço primeiro e só depois escolher o pacote que o cobre remove a duplicação automaticamente (ordem inversa do teste anterior); "Nenhum pacote" repõe a seleção normal (checkbox volta a ficar ativo e desmarcado); **operável só por teclado** — `Tab`+`Space` marca um checkbox e um rádio sem qualquer clique de rato.
- Regressão: `tests/e2e/public-business-page.spec.ts` (NEX-050, 5/5), `tests/e2e/public-pre-registration.spec.ts` (NEX-051, 9/9) e `tests/e2e/public-booking-draft.spec.ts` (NEX-052, 3/3) — todos continuam a passar sem alterações, em `chromium` e `webkit-mobile` (46 testes no total nesta ronda de regressão, incluindo `catalog-mobile-layout`).
- `npm run verify` — ✅ (format, lint, typecheck, `vitest run` — 116 testes passados, `next build`).

## Resultado

O visitante público já não escolhe pacotes "às cegas": ao selecionar um pacote, vê de imediato quais serviços já estão incluídos (marcados, sem poder duplicá-los) e pode ainda adicionar serviços genuinamente extra, com o total e a duração sempre corretos — nunca a somar duas vezes o mesmo item. `docs/02_UX_FLOWS.md` atualizado para já não descrever isto como uma "demonstração" com extras em falta.

## Riscos residuais

Nenhum identificado.

## Próxima tarefa desbloqueada

NEX-054 — Criar carrinho fixo (depende de NEX-053, concluída).
