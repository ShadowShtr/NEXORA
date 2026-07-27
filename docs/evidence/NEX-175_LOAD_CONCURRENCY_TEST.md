# NEX-175 — Load/concurrency test

## Objetivo

Medir o comportamento de `availability` (disponibilidade) e `booking` (criação
de marcação pública) sob carga concorrente real, incluindo o caso de
contenção pelo mesmo horário, sem introduzir dependências novas de load
testing.

## Metodologia

Os fluxos medidos são Server Actions do Next.js (App Router), não endpoints
REST simples — cada pedido é um `POST` para o URL da própria página, com um
cabeçalho `Next-Action: <hash>` que muda a cada build, e um corpo
`text/plain;charset=UTF-8` contendo um array JSON com os argumentos exatos da
função. Em vez de adicionar uma dependência de load testing (desproporcional
para este âmbito) ou instanciar dezenas de browsers Playwright completos
(pesado, mede tempo de renderização em vez de tempo de servidor), usou-se uma
técnica híbrida em `scripts/load-test.mjs`:

1. **Descoberta** — uma única passagem real com Playwright pelo fluxo público
   completo (`/b/{slug}/servicos` → `/horario` → `/dados` → `/resumo`),
   capturando todos os pedidos `POST` com cabeçalho `next-action` via
   `page.on('request')`. Extrai o hash da ação de disponibilidade
   (`getPublicAvailability`, chamado em `/horario`) e o hash da ação de
   criação de marcação (`createPublicBooking`, chamado em `/resumo`), além do
   formato exato do corpo (incluindo o literal `"$undefined"` que o React
   Server Components usa para argumentos omitidos, em vez de `undefined`
   real).
2. **Repetição via `fetch` cru** — com os hashes e o formato do corpo
   conhecidos, disparam-se N pedidos `fetch` concorrentes (Node nativo,
   `Promise.all`) diretamente contra os mesmos URLs e cabeçalhos, medindo
   `performance.now()` por pedido. Isto é fiel ao caminho de código real
   (validação Zod, rate limiting, RLS, constraint de exclusão na base de
   dados) sem o overhead de renderizar um browser completo por pedido
   concorrente.

Script: `scripts/load-test.mjs`. Uso: `node scripts/load-test.mjs --apply
--concurrency 15 --base-url http://localhost:3000` (dry-run por omissão, só
imprime o plano). Requer `NEXT_PUBLIC_SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` no ambiente (`.env.local`).

### Fases medidas

1. **Disponibilidade** — `concurrency` pedidos concorrentes a
   `getPublicAvailability` para o mesmo serviço/tenant.
2. **Throughput de marcação** — `concurrency` marcações concorrentes, cada uma
   num horário diferente (espaçados o suficiente para não colidirem pelo
   buffer — ver nota abaixo), telefone e `idempotencyKey` distintos por
   pedido. Mede o caso comum: muitos clientes a marcar horários diferentes ao
   mesmo tempo.
3. **Contenção** — até 10 pedidos concorrentes tentando marcar exatamente o
   **mesmo** horário, com telefones/`idempotencyKey` distintos. Valida a
   proteção contra dupla reserva: espera-se exatamente 1 sucesso e o resto
   `SLOT_TAKEN`.

Cada corrida provisiona um tenant descartável (`loadtest-<hex>`, RPC
`provision_tenant_owner`), publica-o, abre todos os dias `00:00–23:30` e cria
um serviço de 30 min / 2500 cêntimos. O `finally` do script apaga sempre os
dados de teste (appointments, clients, soft-delete do tenant), mesmo em caso
de erro nas fases anteriores.

### Achado durante o desenvolvimento: espaçamento de buffer

A primeira corrida da fase de throughput obteve só 7/15 sucessos, o que
pareceu inicialmente um bug de concorrência. Investigação confirmou que é
comportamento correto: `appointments.buffer_minutes` tem default `15`
(`supabase/migrations/0001_initial.sql:44`), e o serviço de teste dura 30 min
— cada marcação bloqueia `30+15=45` min para a frente. Como a disponibilidade
devolve horários espaçados só `slot_interval_minutes` (30 min) entre si,
entradas **adjacentes** de uma mesma lista de disponibilidade podem
legitimamente colidir entre si se marcadas ao mesmo tempo — é a constraint de
exclusão (`appointments_no_overlap`) a fazer o que deve. Corrigido no script
espaçando os horários usados na fase de throughput (`i % 2 === 0`, garantindo
≥60 min de intervalo, folgado acima dos 45 min necessários). Depois da
correção: 15/15 em ambas as corridas seguintes.

## Resultados (2026-07-27, `next build && next start`, `--concurrency 15`)

Duas corridas completas, ambas contra o build de produção local (não `next
dev`), ligadas ao projeto Supabase partilhado de desenvolvimento
(`znakuwpmapkhzuntzorj`, o único existente — ver `NEX-172`).

### Corrida 1

| Fase                                  | Sucesso         | p50      | p95      | p99      | min | max |
| ------------------------------------- | --------------- | -------- | -------- | -------- | --- | --- |
| Disponibilidade                       | 15/15           | 485.5 ms | 561.9 ms | 561.9 ms | —   | —   |
| Throughput (horários diferentes)      | 15/15           | 160.6 ms | 177.7 ms | 177.7 ms | —   | —   |
| Contenção (mesmo horário, 10 pedidos) | 1/10 (esperado) | 105.1 ms | 118.3 ms | 118.3 ms | —   | —   |

### Corrida 2

| Fase                                  | Sucesso         | p50      | p95      | p99      | min | max |
| ------------------------------------- | --------------- | -------- | -------- | -------- | --- | --- |
| Disponibilidade                       | 15/15           | 417.4 ms | 505.0 ms | 505.0 ms | —   | —   |
| Throughput (horários diferentes)      | 15/15           | 133.0 ms | 141.4 ms | 141.4 ms | —   | —   |
| Contenção (mesmo horário, 10 pedidos) | 1/10 (esperado) | 105.1 ms | 110.5 ms | 110.5 ms | —   | —   |

Em ambas as corridas de contenção: exatamente 1 sucesso e 9 `SLOT_TAKEN` —
sem duas marcações a vencerem o mesmo horário, sem falsos negativos (todos os
9 restantes devolveram o código de erro esperado, não um erro genérico).

`p95`/`p99` coincidem com o máximo porque a amostra é pequena
(`concurrency=15` e `10`, não centenas) — não há um percentil 95/99 distinto
com tão poucos pontos; o valor reportado é o maior latência observada, que é
o comportamento correto do cálculo (`percentile(sorted, p) =
sorted[min(length-1, ceil(p/100*length)-1)]`) para amostras pequenas.

## Interpretação

- **Disponibilidade** é a fase mais lenta (~400-560ms sob 15 pedidos
  concorrentes) porque calcula slots livres varrendo `business_hours`,
  `appointments` existentes e regras de bloqueio — aceitável para o volume
  esperado de uma profissional independente (não é um endpoint de alto
  tráfego), mas é o candidato natural a otimizar primeiro se o volume
  crescer (ex.: memoização por tenant+dia com invalidação em escrita).
- **Criação de marcação** é consistentemente mais rápida que disponibilidade
  (~105-180ms) mesmo sob concorrência — a escrita é mais barata que o cálculo
  de disponibilidade.
- **Proteção contra dupla reserva funciona sob concorrência real**, não só em
  teste unitário sequencial — 10 pedidos verdadeiramente simultâneos pelo
  mesmo horário resultam em exatamente 1 sucesso, nas duas corridas.

## Limitações conhecidas

- Testado com `concurrency=15`/`10`, não com centenas ou milhares de pedidos
  — proporcional ao volume esperado (uma profissional independente, não uma
  plataforma de grande escala) mas não representa um cenário de pico viral.
- Testado contra `localhost`, não contra o deployment real do Vercel —
  Deployment Protection do Vercel bloqueia pedidos automatizados não
  autenticados ao domínio `*.vercel.app` (redireciona para
  `vercel.com/sso-api`), tornando um load test remoto impraticável nesta
  sessão.
- **Utilizadores de teste órfãos em `auth.users`**: o `finally` do script
  tenta apagar o utilizador Auth criado para cada corrida, mas isto falha
  sempre — `provision_tenant_owner`/`publish_business` escrevem em
  `audit_logs`, que tem uma FK `RESTRICT` para o autor (comportamento
  intencional, já confirmado noutra tarefa: impede apagar um utilizador com
  rasto de auditoria). O tenant fica corretamente soft-deleted e sem dados
  associados (appointments/clients apagados), mas o registo em `auth.users`
  e a linha em `audit_logs` permanecem. Sem impacto funcional (é um e-mail
  `@example.test` aleatório, sem qualquer acesso), mas corridas repetidas
  deste script acumulam utilizadores órfãos — se este script vier a ser
  usado com frequência, vale a pena um script de limpeza periódica dedicado
  fora do âmbito desta tarefa. O script agora avisa explicitamente no log
  quando isto acontece, em vez de falhar silenciosamente.
- Dados de teste de corridas anteriores ao ajuste de cleanup (anteriores à
  versão final do script) foram encontrados e limpos manualmente nesta
  tarefa (dois tenants, dois utilizadores Auth associados com o mesmo
  problema de `audit_logs` acima).

## Testes

- `node scripts/load-test.mjs --apply --concurrency 15` — duas corridas
  completas, resultados acima.
- `npm run verify` — ver secção Definition of Done em `tasks/epics/EPIC-17.md`.

## Próxima tarefa desbloqueada

NEX-176 — Checklist beta privado (depende também de NEX-154, NEX-167).
