# 05 — Cybersecurity e privacidade

## Escopo

A aplicação trata dados pessoais de clientes em Portugal/UE. A aplicabilidade jurídica final e bases legais devem ser validadas por profissional competente. Este documento transforma princípios de RGPD e privacy by design em controlos técnicos, sem declarar conformidade formal.

## Ativos

- credenciais da dona;
- dados de contacto das clientes;
- agenda e disponibilidade;
- observações e fotografias;
- registos financeiros internos;
- tokens de links públicos;
- chaves Supabase/Vercel/e-mail;
- logs e backups.

## Ameaças principais

> Atualizado em `NEX-166` — a coluna "Controlo principal" passou a citar a implementação real (ficheiro/tarefa), não só a intenção de desenho registada na versão inicial deste documento.

| ID  | Ameaça                                    | Impacto                                 | Controlo principal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Acesso entre tenants                      | violação de dados                       | RLS em todas as tabelas de tenant + `tenant_id` derivado de `requireProfile()` (nunca de input) + FK composta `(tenant_id, id)` (`0002_harden_tenant_fk_integrity.sql`) + padrão `hasAffectedRows` para mutações diretas fora de RPC (`ADR-010`, `src/lib/write-confirmation.ts`) + testes negativos cross-tenant em cada feature (ex.: `tests/integration/delete-or-anonymize-client.test.ts`, `NEX-163`)                                                                                                                                                                                                                                                 |
| T2  | Dupla reserva concorrente                 | perda operacional                       | constraint GiST + transação na criação de marcações                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| T3  | Enumeração de links                       | exposição de marcações                  | token aleatório 256-bit, hash em DB, rate limit; código de consulta curto (`/marcacao`) usa alfabeto de 32 símbolos × 8 caracteres (~1e12 combinações), hash em DB, mesmo rate limit — decisão de produto rejeitou um código de 6 caracteres sem telefone/e-mail emparelhado por ser varrível por força bruta                                                                                                                                                                                                                                                                                                                                              |
| T4  | Abuso de marcação pública                 | spam/DoS                                | rate limit distribuído via Upstash Redis + Cloudflare Turnstile (`NEX-066`) — código já degrada com segurança para "sem limite"/"tratar como humano" sem credenciais, mas **nenhum dos dois tem conta real provisionada em produção ainda** (`docs/ENVIRONMENTS_AND_SECRETS.md`, `docs/DATA_MAP.md`): até serem provisionados, esta mitigação não está de facto ativa                                                                                                                                                                                                                                                                                      |
| T5  | Sequestro de sessão                       | acesso à agenda                         | cookies de sessão Supabase, verificação server-side em cada página privada (`requireProfile()`), `Cache-Control: no-store` em rotas de auth/dashboard (`src/middleware.ts`, `NEX-153`/`NEX-164` — ver T11 sobre o bug de deteção do Turbopack corrigido aí)                                                                                                                                                                                                                                                                                                                                                                                                |
| T6  | Service role exposta                      | comprometimento total                   | `SUPABASE_SERVICE_ROLE_KEY` só usada em código server-only (nunca em ficheiros `'use client'`), `gitleaks` no CI, separação de env por ambiente                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T7  | Upload malicioso                          | malware/exposição                       | allowlist de MIME + limite de tamanho antes de ler o ficheiro, reencode obrigatório para JPEG via `sharp` (EXIF removido por omissão, verificação por assinatura via decode-or-throw), bucket privado com nomes aleatórios, limite explícito de pixels de entrada contra decompression bombs e quota de 40 fotos/cliente (`NEX-165`)                                                                                                                                                                                                                                                                                                                       |
| T8  | Logs com PII                              | vazamento secundário                    | ver achados do review independente (`NEX-166`, secção abaixo) — sem mecanismo de redaction automática dedicado; mitigado por disciplina de não logar objetos completos de cliente/pagamento nas rotas revistas                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| T9  | Alteração financeira sem rasto            | fraude/erro                             | `audit_logs` append-only (grant só a `security definer`), preserva before/after e motivo em reabertura/correção de marcações (`NEX-115`) e em apagar/anonimizar cliente (`NEX-163`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| T10 | Supply chain                              | execução de código                      | lockfile commitado, Dependabot ativo, `gitleaks`/`analyze` no CI, PRs pequenos por tarefa — alertas triados e fechados 2026-07-27 (`PR #114`-`#116`): Next.js 16.2.10→16.2.12 (9 CVEs, incl. bypass de middleware/proxy em Turbopack), `sharp`/`uuid` deduplicados, `eslint` 9→10 com shim oficial `@eslint/compat` porque `eslint-plugin-react` ainda não publicou suporte a ESLint 10 — `npm audit` em 0 vulnerabilidades                                                                                                                                                                                                                                |
| T11 | Comportamento silencioso de build tooling | controlo de segurança inativo sem aviso | descoberto na `NEX-164`: renomear `src/middleware.ts` para `src/proxy.ts` (seguindo o próprio aviso de depreciação do Next.js) fazia o build de produção Turbopack do Next.js 16.2.10 **nunca detetar o ficheiro** — `middleware-manifest.json` saía vazio, desativando CSP/no-store silenciosamente, sem erro nem aviso, invisível em `next dev` e nos logs de `next build`. Corrigido revertendo o nome do ficheiro; mitigação permanente é `tests/e2e/security-headers.spec.ts` correr contra `next build && next start` real (não `next dev`), mais o comentário de aviso no topo de `src/middleware.ts` a proibir o rename sem reverificar o manifest |

## Autenticação

- Supabase e-mail/palavra-passe.
- Conta criada pelo administrador.
- Recuperação por e-mail.
- Verificar claims no servidor para páginas privadas.
- Rate limit em login e reset.
- Política de palavra-passe configurada no Supabase.
- MFA fica no backlog para contas privilegiadas e escala SaaS.

## Autorização

- RLS em todas as tabelas privadas.
- Policies baseadas em `auth.uid()` → profile → tenant.
- Nenhuma policy de cliente anónimo para appointments/clients/payments.
- Operações públicas passam por endpoint/RPC com dados mínimos.
- Service role é usada apenas em funções server-side estritamente limitadas.

## Links públicos

- Token gerado por CSPRNG.
- Armazenar `sha256(token)`.
- Comparar hash no servidor.
- Não incluir nome/telemóvel na URL.
- Permitir revogar/regenerar.
- Não expor link completo em logs.

## Uploads

- Bucket privado.
- Signed URLs de curta duração.
- Limite de tamanho configurado.
- Allowlist de MIME e verificação por assinatura quando possível.
- Remover EXIF no processamento ou impedir preservação de geolocalização.
- Sem SVG ou executáveis.

## Segurança HTTP

- HTTPS obrigatório.
- HSTS em produção.
- CSP com nonce e allowlist mínima.
- `frame-ancestors 'none'`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` restritiva.
- Cookies `Secure`, `HttpOnly`, `SameSite=Lax` ou mais restritivo.

## Rate limiting e bot protection

Não usar mapa em memória no serverless (`CLAUDE.md`) — implementado com Upstash Redis
(`NEX-066`, `src/lib/rate-limit.ts`), sliding window por identificador (IP), com
limites diferenciados por custo/risco de cada endpoint público:

- `getPublicAvailability` (leitura, mas cara — várias queries por chamada): 30/min.
- `createPublicBooking` (escrita com efeitos reais): 5/min, mais restritivo.
- `GET /api/bookings/{token}`: 60/min — o token de 256-bit já torna força bruta
  impraticável, isto é defesa em profundidade.
- Cloudflare Turnstile no passo de resumo do formulário público (`NEX-066`).

Login e recuperação de password **não têm rate limit próprio no código da app** —
dependem do limite nativo do Supabase Auth em `signInWithPassword`/
`resetPasswordForEmail` (a mensagem de erro é sempre genérica, nunca distingue
"conta não existe" de "limitado", `src/features/auth/actions.ts`).

**Risco residual ativo**: nem Upstash nem Turnstile têm conta real provisionada em
produção — o código degrada com segurança (`getLimiters()` devolve `null` sem
credenciais → "sem limite"; Turnstile ausente → todo o visitante tratado como humano),
mas isto significa a mitigação de T4 não está de facto ativa até serem
provisionados (`docs/ENVIRONMENTS_AND_SECRETS.md`, `docs/DATA_MAP.md`).

## Privacidade

### Minimização

Obrigatórios no booking: nome e telemóvel. E-mail é opcional. Campos de preferência/fotografia são preenchidos pela dona quando necessários.

### Finalidades a validar

- executar e gerir marcações;
- comunicar confirmação/lembrete;
- manter histórico de atendimento;
- controlo financeiro interno;
- segurança e auditoria.

Marketing não faz parte do MVP e exige tratamento separado.

### Direitos

- Localizar/corrigir dados por cliente: já suportado pelo fluxo normal de edição da
  ficha de cliente.
- Exportar dados estruturados: `NEX-162` — `/api/clientes/[id]/export`, JSON
  minimizado (sem IDs internos, `tenant_id` ou caminhos de Storage).
- Apagar/anonimizar: `NEX-163` — `delete_or_anonymize_client(p_client_id)`; hard
  delete se a cliente não tem marcações associadas, anonimização in-place (nome,
  telefone, e-mail, observações) se tem, preservando o registo financeiro/auditoria
  (`appointments.client_id` é `on delete restrict`, decisão de produto construída em
  cima dessa restrição da BD, não contornando-a).
- Registar pedido e decisão: cada apagar/anonimizar grava em `audit_logs`
  (`client.deleted`/`client.anonymized`); não existe ainda um registo formal do
  _pedido_ em si (só da execução) — backlog.

### Subprocessadores

Lista completa (com região, dados envolvidos, DPA e owners) em
`docs/DATA_MAP.md` (`NEX-160`). Resumo: Vercel (hospedagem, EUA — `iad1`), Supabase
(BD/Auth/Storage, UE), GitHub (código/CI, sem dados de produção), Resend/Upstash
Redis/Cloudflare Turnstile (schema pronto, sem conta real provisionada).

Manter lista, regiões, DPA e transferências internacionais documentadas antes de produção.

## Incidentes

- Severidade e owner definidos em `docs/08_OPERATIONS.md`.
- Preservar timeline e evidências.
- Avaliar impacto em titulares e países.
- Não assumir prazo regulatório sem validação jurídica atual.

## Achados do review independente (NEX-166)

Revisão de código feita por um agente sem contexto da implementação (sem assumir que
esta documentação estava atualizada), cobrindo RLS/isolamento multi-tenant,
autorização server-side, IDOR/BOLA, rotas públicas, segredos/logs, uploads, rate
limiting, headers e supply chain. Corrigido nesta tarefa:

- **Login e recuperação de password sem rate limit aplicativo** (achado alto) — só o
  limite nativo, não configurável, do Supabase Auth existia. Adicionados
  `checkLoginIpRateLimit`/`checkLoginEmailRateLimit`/`checkPasswordResetRateLimit`
  (`src/lib/rate-limit.ts`), ligados a `src/features/auth/actions.ts`. Login funde o
  resultado no mesmo erro genérico já existente — uma mensagem "demasiadas
  tentativas" distinta seria, ela própria, um novo oráculo para diferenciar uma
  password errada de uma tentativa limitada.
- **Overload de 9 argumentos de `create_public_booking` sem `revoke`/`grant`
  explícitos** (`0023_create_public_booking_observation.sql`, desvio real do
  `ADR-008`, sem teste negativo) — corrigido em
  `0037_create_public_booking_grant_fix.sql` + teste novo confirmando `42501` para
  uma sessão `authenticated` real.
- **`get_public_business_hours` não validava `status`/`published_at` do tenant
  internamente**, apesar de concedida diretamente a `anon`/`authenticated` — um
  `tenant_id` já conhecido/adivinhado dava acesso ao horário de tenants
  suspensos/não publicados por fora do fluxo normal de `/b/[slug]`. Corrigido em
  `0038_public_business_hours_tenant_check.sql` (mesmo predicado do
  `create_public_booking`) + `tests/integration/public-business-hours-grant.test.ts`.
- **`/b/[slug]/dados` não verificava `business_settings.published_at`** como as
  páginas irmãs (`page.tsx`, `servicos`, `horario`, `resumo`) — não explorável hoje
  (`status='active'` só é definido junto com `published_at`, nunca separadamente),
  mas inconsistente e frágil a um futuro fluxo de despublicar. Alinhado + teste E2E.
- **`proxy.ts` (raiz) e `src/lib/supabase/proxy.ts` eram código morto** — o Next.js só
  deteta convenções `middleware`/`proxy` dentro de `src/` neste projeto (`appDir =
src/app` → `rootDir = src`), confirmado por leitura do código-fonte do Next.js
  instalado, não só do comentário em `src/middleware.ts`. A validação de sessão que
  implementavam nunca corria; a única imposição de autenticação real já é
  `requireProfile()` nos layouts `(dashboard)`/`(onboarding)`. Apagados ambos — deixar
  código morto que _parece_ um controlo de segurança ativo é, por si, um risco (um
  futuro engenheiro pode assumir que protege algo, ou tentar "reativá-lo"
  reintroduzindo exatamente o ficheiro `proxy.ts` cujo nome já causou o bug do
  Turbopack na `NEX-164`).
- Comentário desatualizado em `next.config.ts` (referia `src/proxy.ts`, inexistente
  desde a `NEX-164`) corrigido para `src/middleware.ts`.

A suspeita registada na `NEX-164` — `/b/[slug]` a devolver 200 em vez de 404 para
tenant suspenso/não publicado — foi **investigada a fundo e refutada**: a policy RLS
`public_tenant_lookup` (`status = 'active'`) e a de `business_settings`
(`published_at is not null`) cobrem corretamente as quatro páginas principais; nunca
foi alterada por nenhuma migração desde `0001_initial.sql`. Não era um bug real.

### Risco residual registado, não corrigido nesta tarefa

- **Ações do GitHub não fixadas por SHA de commit** (só tags major, ex.
  `actions/checkout@v4`) — desvio do "pin actions" que o próprio T10 lista como
  controlo. Endurecimento de CI, não uma vulnerabilidade explorável hoje; fica para
  tarefa própria de CI/DevSecOps.
- **CodeQL configurado com upload de alertas desativado** (`.github/workflows/codeql.yml`,
  `upload: never`) porque GitHub Advanced Security não está disponível num repositório
  privado de conta pessoal — limitação de plataforma já documentada no próprio
  workflow, não corrigível pelo código da app.
- **`exceljs` (dependência de produção) → `archiver` → ... → `brace-expansion`** com
  CVE alta sem correção não destrutiva disponível a montante (`PR #116`) —
  exploração prática baixa (exige um padrão glob controlado pelo atacante, que este
  fluxo nunca recebe), acompanhar para quando `exceljs`/`archiver` publicarem uma
  correção.
- **`getRequestIp()` confia em `x-forwarded-for` sem validar proxy de confiança**
  (`src/lib/request-ip.ts`) — assunção implícita de que a Vercel controla este
  cabeçalho na borda; razoável para a plataforma atual, mas não documentada
  explicitamente nem testada contra um deployment diferente.
- Rate limit/Turnstile do fluxo público continuam sem conta real provisionada em
  produção (ver secção "Rate limiting e bot protection" acima) — já era um risco
  residual conhecido, reconfirmado por este review.

## Testes de segurança

- RLS positivo e negativo — `tests/integration/*-rls.test.ts`, um por recurso
  tenant-scoped.
- IDOR/BOLA em todas as rotas por ID — padrão `hasAffectedRows`/RPC com verificação
  de tenant, coberto por teste negativo em cada feature.
- brute force/rate limit — `tests/unit/rate-limit.test.ts`,
  `tests/integration/rate-limit.test.ts` (inclui login/password-reset desde a
  `NEX-166`).
- token enumeration — mitigação T3, formato/entropia do token coberto onde é gerado.
- upload adversarial — `tests/unit/image-processing.test.ts` (`NEX-165`: dimensões
  extremas/decompression bomb, bytes não-imagem).
- concorrência de slots — `tests/e2e/public-booking-race.spec.ts`,
  `tests/integration/create-public-booking.test.ts`.
- secret scanning — `gitleaks` no CI (`.github/workflows/secret-scan.yml`).
- SAST/SCA/CodeQL — `.github/workflows/codeql.yml` +
  `.github/workflows/dependency-review.yml`; alertas do Dependabot triados
  2026-07-27 (ver T10).
- pentest proporcional antes de produção pública — `NEX-167`, ainda não feito.
