# Sessão 2026-07-20 — Redesign do fluxo público de marcação + código de consulta

Trabalho fora da sequência normal do `TASKS.md` — pedido direto do utilizador para refinar
visualmente o fluxo público (`/b/[slug]`) e adicionar consulta de marcação por código curto.
Este documento é o handoff para continuar amanhã: o que está feito, o que falta, e como
retomar.

## Branch

`feature/public-booking-flow-redesign`, empilhada sobre `task/NEX-112-descontos`. Ainda
**não commitado nem pushed** no momento em que este documento foi escrito — ver secção
"Próximo passo imediato".

## O que foi feito

### 1. Reordenação do fluxo público (commit `d5762b9`, já feito)

Antes: dados da cliente → serviços+horário (mesmo ecrã) → confirmar.
Agora: **serviços → horário/calendário → dados da cliente → confirmar**.

- `src/app/b/[slug]/SlotPicker.tsx`: reescrito para incluir um calendário mensal real
  (grelha Domingo-primeiro, navegação de mês) além da lista de horários — antes só
  mostrava uma lista plana de dias. Novo módulo `src/app/b/[slug]/domain/month-calendar.ts`
  (`buildCalendarMonth`, `shiftMonthKey`), testado em `tests/unit/month-calendar.test.ts`.
- `src/app/b/[slug]/domain/slot-formatting.ts`: `groupSlotsByDay` ganhou um parâmetro
  opcional `durationMinutes` para mostrar "início - fim" em vez de só o início.
- `src/app/b/[slug]/PublicBookingCart.tsx`: reordenado; registo (`PreRegistrationStep`)
  passou a renderizar `embedded` (sem o próprio Card/label, já que o pai agora
  fornece isso).
- **7 ficheiros de teste E2E atualizados** para a nova ordem (`tests/e2e/public-*.spec.ts`
  e `tests/e2e/support/public-page.ts`).

### 2. Refino visual (parcial, commit pendente)

Baseado em iteração com o utilizador usando artifacts de prévia (3 rondas de feedback).
Decisões fechadas:

- **Fonte**: trocada de Inter para a fonte nativa do sistema (`-apple-system,
BlinkMacSystemFont, 'Segoe UI', ...`) — aplicado globalmente em `src/app/globals.css`.
- **Escala tipográfica única** para o fluxo público (`.text-eyebrow`, `.text-title`,
  `.text-subtitle`, `.text-support`, `.text-meta`, `.text-numeral` em `globals.css`) —
  todo texto em `/b/[slug]` e `/marcacao` usa exatamente estas classes, nada de
  tamanhos soltos por componente.
- **Cartões de serviço**: `.public-service-item` ganhou borda que fica rosa + fundo
  suave quando selecionado (`:has(input:checked)`), espaçamento padronizado.
- **Contactos (WhatsApp/Ligar/Mapa)**: movidos do cabeçalho para um **rodapé** no fim
  da página (`src/app/b/[slug]/page.tsx`, secção `.public-contact-footer`) — não
  competem mais com o nome do negócio.
- **Ecrã de confirmação** (`BookingConfirmation.tsx`): reformulado — ícone de check
  verde, "Ver marcação" como botão principal cheio, Calendário/Mapa/WhatsApp como
  3 botões de ícone lado a lado (não mais 4 botões empilhados de peso igual).

**O que NÃO foi aplicado ainda** (ficou só na prévia/artifact, não no código real):

- Círculos de seleção customizados (checkbox/radio nativos escondidos, substituídos por
  um círculo desenhado) — a prévia tinha isto, o código real ainda usa
  `input[type=checkbox]`/`radio` nativos estilizados via `accent-color`. Se quiser esse
  visual mais "Apple", é o próximo ajuste de CSS a fazer em `.public-service-choice
input`.
- Não houve tempo para aplicar a escala tipográfica a **todo o resto do site**
  (dashboard, onboarding) — só ao fluxo público (`/b/[slug]`, `/marcacao`). A troca de
  fonte é global; a escala de classes `.text-*` não.

### 3. Código de consulta de marcação (`/marcacao`)

Pedido do utilizador: uma forma da cliente consultar a marcação mais tarde sem precisar
do link original — um código que recebe por e-mail (e no ecrã de confirmação).

**Decisão de segurança importante**: um código de 6 caracteres sozinho é varrível por
força bruta mesmo com rate limit (60 tentativas/min × muitos IPs = ~1M combinações
varridas em horas), expondo nome/telefone/morada de outra cliente. Depois de eu explicar
isso, o utilizador escolheu **código de 8 caracteres, sozinho, sem telefone emparelhado**
— alfabeto de 32 símbolos (exclui `0/O/1/I/L` por ambiguidade), ~1e12 combinações, mesma
margem de segurança do token de 256 bits já existente.

**Migração**: `supabase/migrations/0018_booking_lookup_code.sql`

- Nova coluna `appointments.booking_lookup_code_hash` (hash SHA-256, único, mesma
  disciplina do `booking_token_hash`).
- `create_public_booking` (0007) reescrita — **diff mínimo sobre a versão real
  verificada**, não uma reescrita da lógica: adiciona geração do código (loop de retry
  para colisão, astronomicamente rara) e passa `lookup_code` no `return query`. Toda a
  validação de idempotência, hash de payload, verificação de tenant publicado, etc.
  ficaram exatamente como estavam.
- Nova função `resolve_booking_lookup_code(p_code)` — devolve o **detalhe completo da
  marcação diretamente** (não um token), porque o token em texto claro nunca é
  armazenado e não pode ser re-derivado a partir do código. Resposta uniformemente
  vazia para código malformado ou desconhecido (mesma disciplina anti-enumeração do
  `resolveBookingByToken`).

**Aplicação**:

- `src/lib/booking-lookup-code-pattern.ts`: regex pura (separada do resto para não
  arrastar `createAdminClient`/`env.ts` em testes unitários).
- `src/lib/booking-lookup-code.ts`: `resolveBookingByLookupCode()`.
- `src/app/marcacao/lookup-actions.ts`: `lookupBookingByCode` (server action,
  rate-limited via `checkBookingLookupRateLimit`, mesmo limiter de `GET
/api/bookings/{token}`).
- `src/app/marcacao/LookupForm.tsx` + `src/app/marcacao/page.tsx`: formulário de
  código, renderiza o resultado **inline na mesma página** (decisão deliberada — não
  navega para um novo URL com o `appointment_id` em claro, o que criaria uma segunda
  credencial permanente não pretendida).
- `src/app/b/[slug]/booking-actions.ts`, `PublicBookingCart.tsx`,
  `BookingConfirmation.tsx`: threading do `lookupCode` desde a RPC até ao ecrã final.
- `src/lib/email/booking-confirmation-template.ts`: e-mail de confirmação agora inclui
  o código.

**Bug real encontrado e corrigido pelo próprio teste unitário**: o alfabeto regex
`[2-9A-HJ-NP-Za-hj-np-z]` que escrevi inicialmente **deixava passar `L`** (o intervalo
`J-N` inclui `L`) — só excluía `I` e `O` corretamente. Corrigido para spellar o alfabeto
carácter a carácter em vez de usar intervalos, exatamente igual ao SQL
(`23456789ABCDEFGHJKMNPQRSTUVWXYZ`). Ver `tests/unit/booking-lookup-code.test.ts`.

## Testes

- `tests/unit/month-calendar.test.ts`, `tests/unit/booking-lookup-code.test.ts`,
  `tests/unit/slot-formatting.test.ts` (estendido).
- `tests/integration/resolve-booking-lookup-code.test.ts` (novo, via Postgres direto,
  `TEST_DATABASE_URL`).
- `tests/integration/create-public-booking.test.ts` /
  `create-public-booking-grant.test.ts`: estendidos com asserts de `lookup_code`.
- `tests/e2e/booking-lookup-code.spec.ts` (novo): fluxo completo confirmar → ver código
  → `/marcacao` → resolver.
- `npm run verify` completo passou (format, lint, typecheck, 272 unit tests, build) —
  **mas sem Docker/Supabase local disponível neste ambiente**, os testes de
  integração/E2E nunca correram de verdade aqui, só foram escritos e compilam.

## Próximo passo imediato

1. **Aplicar a migração `0018_booking_lookup_code.sql` no Supabase** (colar no SQL
   Editor, como sempre) — sem isto, `create_public_booking` fica com a assinatura
   antiga em produção e o deploy desta branch parte o booking público.
2. **Rodar `npm run verify` com Docker disponível** para confirmar os testes de
   integração/E2E passam de verdade (nunca correram nesta sessão).
3. **Testar manualmente** o fluxo completo em `/b/[slug]`: escolher serviço → calendário
   → dados → confirmar → ver o código de 8 caracteres → ir a `/marcacao` → colar o
   código → confirmar que resolve corretamente.
4. Decidir se aplica os círculos de seleção customizados (ver "O que NÃO foi aplicado
   ainda" acima) e/ou estende a escala tipográfica ao resto do site.
5. Commit + push desta branch (`feature/public-booking-flow-redesign`) — **ainda não
   fiz isto**, ver nota abaixo.

## Riscos residuais

- Migração 0018 reescreve `create_public_booking`, uma função já em produção — revisei
  linha a linha contra o ficheiro original (`0007_create_public_booking.sql`) para
  garantir que só a geração do código foi adicionada, mas vale a pena o utilizador
  também confirmar visualmente o diff antes de aplicar em produção.
- Sem Docker neste ambiente, **nenhum teste de integração/E2E correu de verdade** —
  só a compilação/lint/typecheck foi verificada. Corrigir isto é o item 2 acima.
- O e-mail de confirmação (`booking-confirmation-template.ts`) agora inclui o código em
  texto simples no corpo — isto é intencional (é assim que a cliente recebe o código),
  mas vale registar que um e-mail comprometido expõe esse código tal como já expunha o
  link completo.
