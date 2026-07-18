# NEX-052 — Implementar draft e recuperação

## Implementação

- `src/lib/env.ts`: novo `BOOKING_DRAFT_ENCRYPTION_KEY` (`serverSchema`, 64 carateres hex = 32 bytes, opcional no schema mas obrigatório em runtime para quem chamar `encryptDraftPayload`/`decryptDraftPayload`). `.env.example` e `.env.local` atualizados; chave local gerada com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `src/lib/supabase/admin.ts` (novo): cliente Supabase com a `service_role` key. O visitante anónimo não tem sessão nenhuma para um RPC `security definer` proteger por `auth.uid()` — ao contrário dos fluxos autenticados (`ADR-008`), aqui não há um "dono" a validar, só um `tenant_id` explícito verificado como ativo antes de qualquer escrita. A chave nunca sai do servidor (só usada em `'use server'` files).
- `src/lib/booking-draft-crypto.ts` (novo): `generateResumeToken` (32 bytes aleatórios, hex), `hashResumeToken` (SHA-256 — só o hash é guardado, nunca o token, mesmo princípio dos outros tokens públicos do produto), `encryptDraftPayload`/`decryptDraftPayload` (AES-256-GCM; `iv` + `authTag` + ciphertext concatenados em base64).
- `src/app/b/[slug]/domain/draft.ts` (novo): `draftPayloadSchema` (Zod) — valida `registration` (nome/telefone/e-mail) e `selectedIds` (array de UUIDs) antes de cifrar.
- `src/app/b/[slug]/draft-actions.ts` (novo, `'use server'`): `saveBookingDraft(tenantId, existingToken, payload)` e `resumeBookingDraft(resumeToken)`, usando a tabela `booking_drafts` já existente (`0001_initial.sql`, `resume_token_hash` único, `encrypted_payload`, `expires_at` limitado pelo `CHECK (expires_at <= created_at + interval '24 hours')`) — nenhuma migração nova foi necessária.
  - `saveBookingDraft` reutiliza a linha existente quando recebe `existingToken` (faz `update`, não `insert`) — sem isto, cada autosave (debounced, mas ainda assim uma vez por cada pausa nas alterações) criaria uma linha nova, e como só o último token fica no `localStorage`, as linhas anteriores nunca mais seriam visitadas nem, portanto, limpas: violaria diretamente "Não guardar rascunhos abandonados indefinidamente" (`CLAUDE.md`). Com uma única linha por dispositivo, ela expira e é apagada da próxima vez que alguém (o próprio dono do rascunho, tipicamente) tentar retomá-la.
  - `resumeBookingDraft` faz **limpeza preguiçosa** (lazy, on-access): ao encontrar um rascunho com `expires_at` no passado, apaga a linha imediatamente e devolve `NOT_FOUND` — não há cron nem fila nova (`CLAUDE.md`: "Não introduzir Redis, filas ou serviços externos sem necessidade demonstrada"); o `CHECK` constraint já limita o dano de uma linha nunca revisitada a, no máximo, 24h de dados cifrados e inúteis passada a validade.
- `src/app/b/[slug]/page.tsx`: passa `tenantId`/`tenantSlug` ao `PublicBookingCart`.
- `src/app/b/[slug]/PublicBookingCart.tsx`: gate em `resumeChecked` (evita mostrar o Passo 1 por instantes antes de a tentativa de retoma terminar); tenta retomar uma vez no mount a partir do token em `localStorage` (`nexora-draft-{slug}`); grava (debounced, 600ms) sempre que `registration` ou a seleção mudam, reutilizando o token existente.

## Testes

- `tests/unit/booking-draft-crypto.test.ts` (novo, 9/9 ✅): `generateResumeToken` produz hex de 64 carateres, sempre diferente; `hashResumeToken` determinístico, 64 carateres, diferente por token; `encryptDraftPayload`/`decryptDraftPayload` fazem round-trip fiel, nunca expõem o texto original no ciphertext, produzem ciphertext diferente a cada chamada (IV aleatório), e falham (auth tag) perante um ciphertext adulterado.
- `tests/e2e/public-booking-draft.spec.ts` (novo, 3/3 ✅ em `chromium` e `webkit-mobile`, corridos em duplicado sem flakiness):
  - retoma registo e seleção após reload, no mesmo dispositivo, sem qualquer passo de e-mail — e voltar a editar reutiliza o mesmo token (mesma linha, sem acumular rascunhos órfãos);
  - um token desconhecido/inválido em `localStorage` é ignorado sem crash — página carrega normalmente (200), mostra o Passo 1 e o token morto é removido;
  - um rascunho expirado é rejeitado (Passo 1 mostrado de novo) **e a linha é mesmo apagada de `booking_drafts`** (critério "limpeza").
- `tests/e2e/public-business-page.spec.ts` (NEX-050) e `tests/e2e/public-pre-registration.spec.ts` (NEX-051): regressão completa, 13/13 ✅ em `chromium` e `webkit-mobile` — `PublicBookingCart.tsx` foi reescrito o suficiente nesta tarefa para justificar re-correr ambos.
- `npm run verify` — ✅ (format, lint, typecheck, `vitest run` — 104 testes passados, 45 skipped por falta de Supabase local nalguns integration tests —, `next build`).

## Nota de correção durante os testes

O primeiro rascunho do teste de retoma tinha uma condição de corrida: esperar apenas por "existe algum token em `localStorage`" não chega, porque o primeiro autosave (logo a seguir ao registo, com seleção vazia) já preenche essa chave antes de o autosave seguinte (depois de marcar o checkbox) ter tido tempo de terminar — um `reload()` nesse intervalo retomava o registo mas com a seleção antiga. Corrigido com duas fases: `waitForFunction` (sem orçamento fixo — o primeiro pedido a uma rota nova sofre a compilação on-demand do `next dev`, que pode ser lenta) para o primeiro save aparecer, e só depois uma margem fixa de 700 ms (600 ms de debounce + folga, já com o servidor "quente") para o save seguinte assentar antes de recarregar.

Também foi encontrado (e corrigido, fora do ficheiro de testes) um `BOOKING_TOKEN_PEPPER=` vazio em `.env.local` — um placeholder de uma tarefa futura ainda não implementada, nunca antes exercitado porque `serverEnv()` só passou a ser chamada nesta tarefa (`createAdminClient`). Uma string vazia falha `.min(32).optional()` do Zod (o schema aceita "ausente", não "vazio"). `.env.local` não é versionado; a variável continua documentada em `.env.example` para quando essa tarefa futura existir.

## Resultado

O visitante público consegue fechar o browser ou trocar de aba a meio da escolha e, ao voltar ao mesmo link no mesmo dispositivo, encontra o registo e a seleção exatamente como as deixou — sem introduzir e-mail nem qualquer autenticação. Nenhum dado de outro tenant é acedido (`saveBookingDraft`/`resumeBookingDraft` sempre filtram por `tenant_id` explícito, nunca por input livre interpretado como identidade). Nenhum segredo ou PII é escrito em log — os erros devolvidos ao cliente são mensagens genéricas (`Result<T>`), o payload nunca é logado.

## Riscos residuais

- Um rascunho cujo token é perdido (ex.: limpar `localStorage`) ou cujo dispositivo nunca mais volta à página fica na tabela até, na pior das hipóteses, expirar (24h) sem nunca ser fisicamente apagado — limitação inerente à limpeza preguiçosa (sem cron). Dado o `CHECK` de 24h e o payload cifrado, o risco residual é armazenamento (não segurança) e considerado aceitável para o MVP; uma tarefa futura pode adicionar uma limpeza periódica via `pg_cron` (nativo do Postgres/Supabase, não é "serviço externo" na aceção do `CLAUDE.md`) caso o volume o justifique.
- A recuperação é apenas para o mesmo dispositivo/browser (o próprio critério de aceite desta tarefa); não há envio de link de retoma por SMS/e-mail — fora de escopo aprovado.

## Próxima tarefa desbloqueada

NEX-053 — Criar seletor Serviços/Pacotes (depende de NEX-052, concluída).
