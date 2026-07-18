# NEX-051 — Criar pré-cadastro temporário

## Implementação

- `src/lib/validation/client.ts` (`clientContactSchema`, já existia mas nunca usada — reforçada nesta tarefa): nome ≥2 carateres, telefone normalizado para E.164 via `normalizePhoneE164` (reaproveita a função de `NEX-031`), e-mail opcional mas validado (`z.email()`) se preenchido.
- `src/app/b/[slug]/PreRegistrationStep.tsx` (novo): formulário Passo 1 do fluxo público — nome e telemóvel `required` (validação nativa do browser; não há round-trip ao servidor neste componente para "obrigatório" ser reforçado de outra forma), e-mail opcional. Ao submeter, valida com `clientContactSchema`; se válido, chama `onComplete(registration)` — **nada é persistido**, é só estado React em memória.
- `src/app/b/[slug]/PublicBookingCart.tsx`: passa a exigir `registration` preenchido antes de mostrar o catálogo — sem pré-cadastro, mostra só `PreRegistrationStep`. Depois de completo, mostra um resumo ("Nome · Telefone" + botão "Alterar dados") e os passos ficam renumerados (Passo 2 · Escolher, Passo 3 · Confirmar). A mensagem de WhatsApp em "Confirmar" passa a incluir o nome do cliente ("Olá! Chamo-me X e vim através da página de Y...").
- `src/app/globals.css`: `.public-registration-summary`.

## Testes

- `tests/unit/client-contact.test.ts` (novo, 9/9 ✅): normalização de telefone local → E.164; telefone já em E.164 mantido; e-mail opcional (omitido/válido/inválido); nome vazio/curto rejeitado; telefone irreconhecível rejeitado.
- `tests/e2e/public-pre-registration.spec.ts` (novo, 9/9 ✅ em `chromium` e `webkit-mobile`): Axe; nome/telefone marcados `required` (nativo); nome de 1 caráter rejeitado (mensagem "nome"); telefone irreconhecível rejeitado (mensagem "telemóvel"); e-mail inválido rejeitado (mensagem "e-mail"); avança só com nome+telefone, e-mail vazio; "Alterar dados" volta ao formulário; **completar o pré-cadastro e sair da página antes de "Confirmar" não escreve nenhuma linha em `clients`** — critério de aceite central desta tarefa.
- `tests/e2e/public-business-page.spec.ts` (`NEX-050`) atualizado: o catálogo agora está atrás do Passo 1, o teste completa o pré-cadastro antes de verificar os serviços — 5/5 continuam a passar.
- `npm run verify` — ✅.

## Nota de correção durante os testes

Os testes iniciais para "nome obrigatório" e "telefone obrigatório" falharam porque o atributo HTML `required` já bloqueia a submissão no browser antes de qualquer JavaScript correr — não há forma de o Zod ver um valor vazio nesse cenário. Substituídos por um teste direto ao atributo `required` (nativo cobre o critério) e por um teste de nome com 1 caráter (não vazio, passa a validação nativa, chega ao Zod, falha por `min(2)`). O campo de e-mail também tinha `type="email"`, cuja validação nativa de formato bloqueava "not-an-email" antes do Zod — mudado para `type="text" inputMode="email"` (mantém o teclado otimizado em telemóvel), validação de formato passa a ser só do Zod.

## Resultado

O fluxo público de `/b/{slug}` já pede os dados de contacto antes de mostrar o catálogo, tal como documentado no Fluxo B (`docs/02_UX_FLOWS.md`) — sem qualquer escrita em `clients` até haver mesmo uma marcação (que ainda não existe, `EPIC-06`).

## Riscos residuais

- O pré-cadastro não sobrevive a um refresh da página nem a fechar o browser — isso é exatamente o escopo de `NEX-052` (draft com token, recuperável no mesmo dispositivo).

## Próxima tarefa desbloqueada

NEX-052 — Implementar draft e recuperação (depende de NEX-051, concluída).
