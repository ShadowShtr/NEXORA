# NEX-166 — Threat model atualizado e security review

## Abordagem

Duas partes, em paralelo:

1. **Atualização do threat model** (`docs/05_SECURITY_PRIVACY.md`) com a implementação
   real — a tabela de ameaças T1-T10 (mais uma nova, T11) e várias secções ainda
   descreviam a intenção de desenho de quando o projeto começou, não o que
   efetivamente foi construído entre a `NEX-001` e a `NEX-165`.
2. **Review independente** — o teste obrigatório desta tarefa. Um agente sem contexto
   da implementação (Explore, sem ferramentas de escrita) auditou o código real
   (migrações SQL, Server Actions, rotas públicas, middleware, `npm audit`) contra o
   threat model e o `CLAUDE.md`, sem assumir que a documentação estava correta.
   Relatório completo (achados classificados por severidade + confirmações de
   controlos bem implementados) preservado na íntegra no histórico da conversa; esta
   tarefa resume o que foi corrigido e o que ficou como risco residual.

## Achado que não era real

A suspeita registada na evidência da `NEX-164` — `/b/[slug]` a devolver 200 em vez de
404 para um tenant suspenso/não publicado — foi investigada a fundo pelo review e
**refutada**: as policies RLS `public_tenant_lookup` (`tenants.status = 'active'`) e a
de `business_settings` (`published_at is not null`) cobrem corretamente as quatro
páginas principais do fluxo público, e nunca foram alteradas desde `0001_initial.sql`.
Vale a pena registar isto tão claramente quanto os achados reais — uma suspeita não
confirmada não devia continuar a pairar sobre o threat model indefinidamente.

## Achados corrigidos nesta tarefa

| #   | Achado                                                                                                               | Severidade        | Correção                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login/recuperação de password sem rate limit aplicativo (só o limite nativo do Supabase Auth)                        | Alto              | `checkLoginIpRateLimit`/`checkLoginEmailRateLimit`/`checkPasswordResetRateLimit` (`src/lib/rate-limit.ts`), ligados a `src/features/auth/actions.ts` |
| 2   | Overload de 9 args de `create_public_booking` sem `revoke`/`grant` explícito (desvio do ADR-008, sem teste negativo) | Médio             | `0037_create_public_booking_grant_fix.sql` + teste `42501` para `authenticated`                                                                      |
| 3   | `get_public_business_hours` não validava `status`/`published_at` do tenant internamente                              | Baixo             | `0038_public_business_hours_tenant_check.sql` + `tests/integration/public-business-hours-grant.test.ts`                                              |
| 4   | `/b/[slug]/dados` sem o mesmo check de `published_at` das páginas irmãs                                              | Baixo             | `src/app/b/[slug]/dados/page.tsx` alinhado + teste E2E                                                                                               |
| 5   | `proxy.ts` (raiz) e `src/lib/supabase/proxy.ts` eram código morto, mas pareciam um controlo de segurança ativo       | Médio/Informativo | Ambos apagados                                                                                                                                       |
| 6   | Comentário desatualizado em `next.config.ts` (`src/proxy.ts`, inexistente desde a NEX-164)                           | Informativo       | Corrigido para `src/middleware.ts`                                                                                                                   |

Detalhe do achado 1 (o mais relevante): a mensagem de erro do login funde o resultado
do rate limit no mesmo erro genérico ("E-mail ou palavra-passe incorretos.") já usado
para credenciais erradas — uma mensagem "demasiadas tentativas" distinta seria, ela
própria, um novo oráculo para diferenciar uma tentativa limitada de uma password
errada, quebrando a disciplina que o próprio código já tinha ("never reveal whether
the e-mail exists").

Detalhe do achado 2: `0023_create_public_booking_observation.sql` adicionou
`p_client_observation` como parâmetro final — em Postgres isto cria um _overload_
novo de 9 argumentos, distinto do de 8, não uma alteração in-place. Toda a
`create or replace` de função `security definer` neste projeto reaplica o seu próprio
`revoke`/`grant` exceto esta. Exploração real é baixa (a função já é intencionalmente
chamável por qualquer visitante anónimo, e valida `tenant_id` internamente), mas era
um desvio real e não testado da política documentada.

## Risco residual registado, não corrigido nesta tarefa

- Ações do GitHub não fixadas por SHA de commit (só tags major) — endurecimento de
  CI/DevSecOps, não uma vulnerabilidade explorável hoje.
- CodeQL configurado com upload de alertas desativado — limitação de plataforma
  (GitHub Advanced Security indisponível em repositório privado de conta pessoal), não
  corrigível pelo código da app.
- `exceljs` (dependência de produção) → `archiver` → ... → `brace-expansion`, CVE alta
  sem correção não destrutiva disponível a montante (já identificado na `NEX-165`/`PR
#116`) — exploração prática baixa.
- `getRequestIp()` confia em `x-forwarded-for` sem validar proxy de confiança —
  assunção razoável para a plataforma atual (Vercel), não documentada explicitamente
  nem testada contra um deployment diferente.
- Rate limit/Turnstile do fluxo público continuam sem conta real provisionada em
  produção — risco residual já conhecido (`docs/ENVIRONMENTS_AND_SECRETS.md`,
  `docs/DATA_MAP.md`), reconfirmado por este review.

Todos os cinco documentados em `docs/05_SECURITY_PRIVACY.md`, secção "Achados do
review independente (NEX-166)".

## Testes

- `tests/integration/create-public-booking-grant.test.ts` (novo `describe`) — sessão
  `authenticated` real (não `service_role`) rejeitada com `42501` no overload de 9
  argumentos.
- `tests/integration/public-business-hours-grant.test.ts` (novo) — tenant
  publicado/ativo devolve horário; tenant não publicado e `tenant_id` desconhecido
  devolvem `[]`, não erro nem dados.
- `tests/e2e/public-business-page.spec.ts` — novo caso, `/b/[slug]/dados` devolve 404
  para tenant ativo mas não publicado.
- `tests/unit/rate-limit.test.ts` + `tests/integration/rate-limit.test.ts` — os três
  novos limitadores de auth, mesmo contrato de "falha aberto sem credenciais Upstash"
  dos limitadores já existentes, e o caso real de 429 (contra Upstash de verdade,
  quando as credenciais existirem — hoje ainda não provisionado, como o resto do fluxo
  público).
- `npm run verify` (format, lint, typecheck, testes unitários, build, budget) — ✅.
  Migrações novas (`0037`, `0038`) e os testes de integração que dependem delas não
  correm localmente (sem Docker/WSL2, `ADR-007`) — verificados via CI (`integration`).

## Resultado

O threat model deixou de ser um documento de intenção de 2026-início-de-projeto e
passa a citar, para cada ameaça, o ficheiro/tarefa que a mitiga de facto. O review
independente encontrou e fechou uma lacuna real de rate limiting em autenticação (a
mais impactante), dois desvios pontuais da política de grants em RPCs públicas, um
código morto que parecia — mas não era — um controlo ativo, e refutou formalmente a
única suspeita que ainda pairava sobre o `/b/[slug]` desde a `NEX-164`.

## Próxima tarefa desbloqueada

NEX-167 — Pentest proporcional (depende de NEX-166).
