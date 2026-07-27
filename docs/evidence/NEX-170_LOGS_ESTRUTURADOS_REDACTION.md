# NEX-170 — Logs estruturados e redaction

## Implementação

- **`src/lib/logger.ts`** (novo) — `logEvent(level, event, fields?, requestId?)`
  escreve uma linha JSON por chamada a `console.log`/`warn`/`error` (Vercel já
  captura e indexa stdout/stderr como logs estruturados pesquisáveis, sem precisar
  provisionar nenhum serviço externo — `CLAUDE.md`, "Não introduzir Redis, filas ou
  serviços externos sem necessidade demonstrada"). Dois níveis de proteção contra
  PII, ambos automáticos, não dependentes de disciplina no call site:
  - **Allowlist de tipos**: `LogFields` só aceita `string | number | boolean | null`
    — nunca um objeto aninhado, que poderia deixar passar um registo completo de
    cliente/pagamento para lá de uma revisão de código apressada.
  - **Redaction automática**: por **nome da chave** (`email`, `telefone`, `password`,
    `token`, `morada`, etc. — inglês e português, case-insensitive) e por **forma do
    valor** (e-mail ou telemóvel E.164), esta última especificamente para apanhar PII
    que acabe sob uma chave inócua (ex. `identifier: client.email`) — a allowlist de
    chaves sozinha não apanharia isso.
  - `null` nunca é redigido (não há nada para proteger, e substituir por
    `'[REDACTED]'` destruiria informação real — "o campo não estava preenchido" vira
    indistinguível de "estava preenchido e escondido").
  - Chaves reservadas do envelope (`level`, `event`, `timestamp`, `requestId`) nunca
    podem ser substituídas por um campo do chamador com o mesmo nome.
- **`errorMessage(error)`** (também em `logger.ts`) — extrai `.message` tanto de um
  `Error` real como de um erro do Supabase (`PostgrestError`/`AuthError`/
  `StorageError`, objetos simples com propriedade `message`, nunca instâncias de
  `Error`). Existe porque a primeira versão do wiring abaixo fazia `String(error)`
  num erro do Supabase e produzia literalmente o texto `"[object Object]"` no log —
  confirmado contra o servidor real antes de corrigir.
- **Correlation id por pedido** — `src/middleware.ts` gera um `crypto.randomUUID()`
  por pedido (mesma lógica já usada para o nonce do CSP), define `x-request-id` no
  pedido (para `src/lib/request-id.ts` ler via `next/headers`) e na resposta (para um
  visitante poder citar o id ao reportar um problema). `getRequestId()` devolve
  `null` fora de um contexto de pedido em vez de inventar um id — uma linha de log
  com `requestId: null` é honesta ("sem contexto de pedido"), não uma correlação
  falsa que nunca vai coincidir com mais nada.
- **Ligado ao único ponto de logging já existente**: `api/cron/cleanup-booking-drafts/route.ts`
  (`NEX-161`) — substituídos os `console.log`/`console.error` ad-hoc por `logEvent`
  com `errorMessage()` no branch de erro. `src/app/b/[slug]/error.tsx` (um error
  boundary de cliente, `'use client'`) foi deixado como estava — corre no browser do
  visitante, não no servidor, e o `console.error` aí é uma ajuda de debug local, não
  um log que a Vercel alguma vez veria.

## Testes

- `tests/unit/logger.test.ts` (novo, 33 casos) — cobre o teste obrigatório desta
  tarefa ("log tests"): redaction por cada uma das ~20 chaves sensíveis suportadas,
  redaction por forma do valor (e-mail/telemóvel) sob chave inócua, não-redaction de
  valores ordinários, `null` nunca redigido, chaves reservadas do envelope
  protegidas contra substituição, e um teste de regressão dedicado para o
  `errorMessage()`/bug do `[object Object]`.
- `tests/e2e/security-headers.spec.ts` (novo caso) — confirma contra um `next build
&& next start` real que `x-request-id` chega ao cliente, tem forma de UUID, e é
  genuinamente diferente entre dois pedidos (não uma constante de build time que
  tornaria a correlação inútil).
- Verificação manual adicional contra o servidor real: o endpoint de cron foi
  chamado com uma autorização inválida (falha aberta sem `CRON_SECRET`, decisão já
  documentada) e o log resultante foi inspecionado diretamente — confirmou tanto o
  `requestId` a aparecer corretamente como o bug do `[object Object]` antes da
  correção do `errorMessage()`, e a mensagem real do Postgres depois.
- `npm run verify` (format, lint, typecheck, 485 testes, build, budget) — ✅.

## Resultado

Fecha a lacuna que a `NEX-166` tinha deixado registada em T8 ("sem mecanismo de
redaction automática dedicado") com um controlo real, não só disciplina de code
review. O correlation id por pedido é a base que a `NEX-171` (métricas e alertas)
vai poder usar para agregar eventos do mesmo pedido sem depender de PII para os
juntar.

## Riscos residuais

- A redação por forma do valor cobre e-mails e telemóveis E.164 completos — não
  deteta PII como uma _substring_ dentro de uma mensagem de erro mais longa (ex.
  `"duplicate key ... (phone_e164)=(+351911222333)"` continuaria a passar, porque o
  valor inteiro do campo não tem exatamente a forma de um telefone). A allowlist de
  nomes de chave continua a ser a proteção principal; a deteção por forma do valor é
  uma rede de segurança adicional para o caso da chave inócua, não uma garantia
  contra qualquer PII embutida em texto livre.
- Nenhum ponto de logging novo foi adicionado além do único já existente
  (cron de limpeza) — instrumentar eventos de negócio (marcação criada, login
  falhado, etc.) é o âmbito da `NEX-171` (métricas e alertas), não desta tarefa.

## Próxima tarefa desbloqueada

NEX-171 — Métricas e alertas (depende de NEX-170).
