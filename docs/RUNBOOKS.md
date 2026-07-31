# Runbooks de incidentes (NEX-174)

> Detalhe passo-a-passo dos cenários listados em `docs/08_OPERATIONS.md` →
> "Runbooks mínimos". Severidades conforme a mesma secção (SEV1 a SEV4).
> Owner único nesta fase: a dona (`ShadowShtr`), sem equipa de suporte.
>
> Cada runbook segue o mesmo esqueleto: **Deteção**, **Impacto**,
> **Contenção imediata**, **Diagnóstico**, **Recuperação**, **Comunicação**,
> **Pós-incidente**.

## Índice

1. [Login indisponível](#1-login-indisponível)
2. [Supabase indisponível](#2-supabase-indisponível)
3. [Deploy falhado](#3-deploy-falhado)
4. [E-mail degradado](#4-e-mail-degradado)
5. [Reserva pública a falhar](#5-reserva-pública-a-falhar)
6. [Erro de concorrência](#6-erro-de-concorrência)
7. [Storage indisponível](#7-storage-indisponível)
8. [Exportação financeira a falhar](#8-exportação-financeira-a-falhar)
9. [Suspeita de acesso cross-tenant](#9-suspeita-de-acesso-cross-tenant)
10. [Fuga de token público](#10-fuga-de-token-público)
11. [Restore de backup](#11-restore-de-backup)

---

## 1. Login indisponível

**Severidade:** SEV1 (bloqueia toda a operação da dona).

**Deteção:** dona reporta não conseguir entrar; ou volume de
`auth.login.failed` (warn, `src/features/auth/actions.ts`) muito acima do
baseline nos logs Vercel.

**Impacto:** ninguém consegue aceder ao dashboard; página pública de
marcação (`/b/{slug}`) continua a funcionar normalmente (não depende de
sessão autenticada).

**Contenção imediata:**

1. Confirmar que não é só um esquecimento de password — usar
   `/recuperar-password`.
2. Verificar `vercel.com` → Deployments → o deployment de produção atual está
   "Ready" (não houve deploy falhado a meio, ver runbook 3).
3. Verificar `status.supabase.com` — se o Supabase Auth está em incidente
   confirmado (ver runbook 2).

**Diagnóstico:**

- Ver logs de `auth.login.failed`/`auth.login.rate_limited` no dashboard
  Vercel (Functions → Logs) para o período do incidente.
- Confirmar se `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  no Vercel (Production) ainda têm os valores corretos (`vercel env ls`) —
  ver histórico de incidente de variáveis partilhadas em
  `docs/evidence/NEX-172_DEPLOY_PREVIEW_PROD_SEPARADOS.md`.

**Recuperação:**

- Se for variável de ambiente errada: corrigir no Vercel, sem tentar separar
  Preview/Produção sem plano (risco já documentado), e forçar redeploy
  (`vercel --prod --force` ou re-trigger no dashboard).
- Se for rate limit legítimo após tentativas falhadas repetidas: aguardar a
  janela de rate limit (`src/lib/rate-limit.ts`) ou, em caso de emergência,
  rodar a password diretamente no dashboard do Supabase (Auth → Users).

**Comunicação:** não aplicável a clientes externos (login é só da dona);
registar o incidente no runbook de "Pós-incidente" abaixo.

**Pós-incidente:** documentar causa raiz em `docs/evidence/` se revelar um
bug novo; se for configuração, atualizar `docs/ENVIRONMENTS_AND_SECRETS.md`.

---

## 2. Supabase indisponível

**Severidade:** SEV1.

**Deteção:** `status.supabase.com` reporta incidente; ou toda a app (login,
agenda, marcação pública) falha ao mesmo tempo com erros de conexão à BD.

**Impacto:** total — nem a página pública nem o dashboard funcionam sem
Supabase.

**Contenção imediata:**

1. Confirmar no `status.supabase.com` se é um incidente confirmado do
   fornecedor (não um problema local de configuração).
2. Se confirmado, não há ação de contenção possível do nosso lado — é um
   incidente de terceiro. Documentar início e acompanhar o status page.

**Diagnóstico:** verificar se é só a região/projeto da NEXORA ou uma
indisponibilidade global do Supabase.

**Recuperação:** aguardar resolução pelo fornecedor; validar com um smoke
test manual (`/login`, criar uma marcação de teste) assim que o status page
reportar resolvido.

**Comunicação:** se a indisponibilidade for longa (>1h) e houver clientes
reais a tentar marcar, considerar aviso manual (WhatsApp/redes sociais da
dona) — não há mecanismo automático de status page próprio nesta fase.

**Pós-incidente:** registar duração e impacto; reavaliar plano Supabase
(Free → Pro) se incidentes de disponibilidade se tornarem recorrentes.

---

## 3. Deploy falhado

**Severidade:** SEV2 a SEV3 (produção continua a servir a versão anterior
até um deploy ser promovido — ver nota abaixo).

**Deteção:** GitHub Actions (`ci.yml`) falha num PR; ou o deployment de
produção no Vercel aparece como "Error"/"Failed" no dashboard.

**Impacto:** nenhum imediato se for falha de **build** — o Vercel só
substitui o deployment de produção ativo por um novo depois de o build
passar; um build falhado nunca fica "no ar" (confirmado durante o incidente
real do `NEX-172`, ver `docs/evidence/NEX-172_DEPLOY_PREVIEW_PROD_SEPARADOS.md`).
Risco real só existe se o deploy anterior tiver um bug que só se manifesta
depois de promovido.

**Contenção imediata:**

1. Ver o log do build falhado no Vercel (Deployments → clicar no deployment
   → "Building" logs).
2. Se for erro de variável de ambiente (`ZodError` em `src/lib/env.ts`),
   confirmar `vercel env ls` contra `docs/ENVIRONMENTS_AND_SECRETS.md`.
3. Se for falha de CI (`verify`/`integration`/`E2E crítico`/`gitleaks`/
   `analyze`), o merge para `main` já está bloqueado pela proteção de
   branch — corrigir o PR antes de mesclar, não há produção em risco.

**Diagnóstico:** ler o log completo do job que falhou; reproduzir localmente
(`npm run verify`) se for falha de lint/types/testes/build.

**Recuperação:**

- Corrigir o problema no PR e reabrir/re-executar o CI.
- Se já mesclado em `main` e o deployment de produção ficou com um bug
  visível: usar "Instant Rollback" no dashboard Vercel para o deployment
  anterior conhecido-bom, enquanto se prepara o fix.

**Comunicação:** interna (só a dona nesta fase).

**Pós-incidente:** se o bug só apareceu em produção (não capturado por
`verify`/`integration`/`E2E crítico`), considerar novo teste automatizado
que o capture.

---

## 4. E-mail degradado

**Severidade:** SEV3 (o booking nunca depende de entrega de e-mail — ver
`CLAUDE.md`/`ADR` relevante — mas a cliente perde a confirmação por e-mail).

**Deteção:** `EMAIL_PROVIDER_API_KEY`/Resend a devolver erro; ou a dona
reporta que clientes dizem não ter recebido e-mail de confirmação.

**Impacto:** limitado — o envio de e-mail é fire-and-forget
(`booking-actions.ts`); a marcação em si é sempre criada com sucesso
independentemente do e-mail. Cliente só perde o lembrete/confirmação por
e-mail (continua a ter o ecrã de confirmação + ICS + WhatsApp manual).

**Contenção imediata:**

1. Confirmar no dashboard do Resend se há um incidente reportado ou se a
   conta atingiu limites/foi suspensa.
2. Confirmar `EMAIL_FROM`/domínio ainda verificado (`molimpezas.pt`-style
   DNS na Cloudflare, mesma mecânica noutros projetos do dono — confirmar
   config específica da NEXORA em `docs/ENVIRONMENTS_AND_SECRETS.md`).

**Diagnóstico:** não instrumentado com métrica dedicada nesta versão (ver
gap registado em `docs/08_OPERATIONS.md` → Observabilidade); verificar
manualmente no dashboard do provedor de e-mail.

**Recuperação:** se for chave inválida/expirada, rotacionar
`EMAIL_PROVIDER_API_KEY` no Vercel; se for domínio não verificado, corrigir
DNS. Sem ação nenhuma disponível, o sistema já degrada de forma segura
(sem e-mail, sem bloquear booking).

**Comunicação:** avisar a dona para usar o lembrete manual/WhatsApp
enquanto o e-mail estiver em baixo.

**Pós-incidente:** candidato a instrumentar `email.send.failed` como
métrica futura (mencionado como gap em `docs/08_OPERATIONS.md`).

---

## 5. Reserva pública a falhar

**Severidade:** SEV2 (afeta a receita/reputação diretamente — é o fluxo
crítico do negócio).

**Deteção:** volume de `booking.public.failed` (error,
`src/app/b/[slug]/booking-actions.ts`) acima do baseline; ou reclamação
direta de uma cliente que não conseguiu confirmar.

**Impacto:** clientes não conseguem marcar — perda direta de receita
potencial.

**Contenção imediata:**

1. Verificar se é um problema geral (todos os tenants) ou específico de um
   `slug` (`business_settings` de um tenant com dados inconsistentes).
2. Testar manualmente o fluxo público (`/b/{slug}` → serviços → horário →
   dados → resumo) com um serviço/horário conhecido-bom.

**Diagnóstico:** ler `booking.public.failed` nos logs Vercel — o campo de
erro (sem PII) indica a causa (`SLOT_TAKEN` é esperado/normal,
não é falha; erros 5xx genuínos indicam bug ou indisponibilidade Supabase).

**Recuperação:**

- Se for `SLOT_TAKEN` em volume anómalo: verificar `NEX-063` (constraint de
  não sobreposição) não está a rejeitar slots válidos por erro de timezone
  (ver regressão histórica de DST, `fix/week-start-dst-bug`).
- Se for erro 5xx genuíno: seguir runbook 2 (Supabase indisponível) ou 6
  (erro de concorrência) conforme a causa.
- Workaround imediato para a dona: criar a marcação manualmente
  (`NEX-085`, `/dashboard/agenda/nova`) enquanto o fluxo público é
  corrigido.

**Comunicação:** se prolongado, a dona pode desativar temporariamente o
link público e avisar clientes por WhatsApp para contactar diretamente.

**Pós-incidente:** documentar em `docs/evidence/` se revelar um bug de
concorrência ou de disponibilidade não coberto pelos testes `@critical`.

---

## 6. Erro de concorrência

**Severidade:** SEV2 a SEV3 conforme o impacto (dupla marcação seria SEV1,
mas é impedida por constraint de base de dados — ver `NEX-063`/`NEX-064`).

**Deteção:** cliente reporta ficar "presa" em "A confirmar…"; ou logs com
`40P01` (deadlock) / `SLOT_TAKEN` inesperado.

**Impacto:** experiência degradada (cliente não sabe se a marcação foi
feita), mas nunca dupla marcação real — a constraint de exclusão na base de
dados (`NEX-063`) é a garantia final, testada em `NEX-175`
(load/concurrency test) até 15 pedidos concorrentes.

**Contenção imediata:** já corrigido de forma estrutural em `NEX-178`
(`ResumoClient.tsx` com máquina de estados `useReducer`,
`AbortController`+`finally`, retry no deadlock `40P01`) — ver
`docs/evidence/NEX-178_PUBLIC_BOOKING_CLIENT_CONCURRENCY.md` para o
incidente original e o fix. Se reaparecer:

1. Confirmar se é o mesmo padrão (cliente preso a meio) ou um caso novo.
2. Pedir à cliente para recarregar a página — o booking já feito
   (se aconteceu) não se perde; se não aconteceu, o slot continua
   disponível para nova tentativa.

**Diagnóstico:** `tests/e2e/public-booking-race.spec.ts`
(`test:e2e:race`) reproduz o cenário de dois pedidos concorrentes pelo
mesmo slot — correr localmente/CI para confirmar se a proteção ainda
funciona.

**Recuperação:** se for um caso novo (não coberto pelo fix de `NEX-178`),
tratar como bug — abrir tarefa, reproduzir com `scripts/load-test.mjs`
(`NEX-175`), corrigir, adicionar ao suite `@critical`.

**Comunicação:** não aplicável externamente se resolvido rápido.

**Pós-incidente:** qualquer novo padrão de concorrência descoberto deve
ganhar um teste `@critical` dedicado (mesmo motivo que levou à criação do
job `e2e-critical` em `NEX-178`).

---

## 7. Storage indisponível

**Severidade:** SEV3 (fotografias privadas de clientes ficam inacessíveis;
não bloqueia booking/financeiro).

**Deteção:** upload/download de fotografias (`NEX-094`) a falhar
consistentemente.

**Impacto:** dona não consegue ver/anexar fotografias privadas; resto da
app não é afetado (Storage é isolado do Postgres/Auth no Supabase).

**Contenção imediata:** confirmar no `status.supabase.com` se é
indisponibilidade do serviço Storage especificamente (pode estar em baixo
sem o resto do Supabase estar afetado).

**Diagnóstico:** testar upload/download manual de uma fotografia de teste;
confirmar políticas RLS de Storage (`NEX-165`) não foram alteradas
inadvertidamente.

**Recuperação:** aguardar resolução do fornecedor se for indisponibilidade
confirmada; se for política/permissão, rever `NEX-165` (hardening de
uploads).

**Comunicação:** não aplicável externamente.

**Pós-incidente:** sem ação adicional a menos que se torne recorrente.

---

## 8. Exportação financeira a falhar

**Severidade:** SEV3 (afeta relatórios/contabilidade, não o dia-a-dia da
agenda).

**Deteção:** `finance.export.failed` (error,
`api/financeiro/export*`/`api/clientes/[id]/export`) nos logs; ou dona
reporta download vazio/com erro.

**Impacto:** dona não consegue extrair CSV/Excel/PDF para o período
pedido; dados subjacentes não são afetados (é só a geração do ficheiro).

**Contenção imediata:** confirmar o período/filtro pedido não é
anormalmente grande (relatório com muitos meses pode atingir limite de
tempo de função serverless).

**Diagnóstico:** ler `finance.export.failed`/`clients.export.failed` nos
logs Vercel para a mensagem de erro específica.

**Recuperação:** se for timeout por volume grande, pedir para exportar em
períodos mais curtos (mitigação manual); se for bug de formatação
(`NEX-132`/`NEX-133`/`NEX-134`), tratar como bug normal.

**Comunicação:** não aplicável externamente.

**Pós-incidente:** se recorrente por volume, considerar paginação de
exportação (mencionado em `EPIC-28`/relatórios avançados).

---

## 9. Suspeita de acesso cross-tenant

**Severidade:** SEV1 (violação de isolamento multi-tenant é o incidente
mais grave possível neste produto).

**Deteção:** dona ou cliente reporta ver dados que não deveriam ser
visíveis; ou uma anomalia nos testes de isolamento RLS (`NEX-015`) falha
em CI.

**Impacto:** potencial exposição de dados pessoais de clientes de um
tenant para outro — risco de confiança e legal.

**Contenção imediata:**

1. **Não esperar** — tratar como SEV1 desde a primeira suspeita, mesmo sem
   confirmação completa.
2. Identificar a rota/ação exata que expôs o dado (qual página, qual
   query/RPC).
3. Se confirmado e ativamente explorável, considerar desativar
   temporariamente a funcionalidade afetada (feature flag ou revert de
   deploy) até corrigir.

**Diagnóstico:**

- Rever a policy RLS da tabela envolvida (`supabase/migrations/`) — confirmar
  `tenant_id` vem sempre de `requireProfile()`/sessão, nunca de input livre
  (`CLAUDE.md`).
- Rever se a rota usa o cliente Supabase correto (anon/RLS vs. service role
  — service role bypassa RLS por definição, só deve ser usado server-side
  com filtragem explícita por `tenant_id`).
- Rever `audit_logs` do tenant afetado para reconstituir o que foi acedido.

**Recuperação:** corrigir a policy/query, adicionar teste de isolamento
negativo específico ao caso (`tests/integration/`), fazer deploy do fix
com prioridade máxima.

**Comunicação:** se confirmado que dados reais de um cliente foram
expostos a outro tenant, a dona deve ser informada de imediato para
decidir sobre notificação aos titulares dos dados (obrigação legal
potencial, ver `docs/05_SECURITY_PRIVACY.md`) — não é uma decisão técnica
automática.

**Pós-incidente:** threat model (`docs/05_SECURITY_PRIVACY.md`) deve ser
atualizado; postmortem completo com timeline, causa raiz e teste de
regressão adicionado.

---

## 10. Fuga de token público

**Severidade:** SEV1 a SEV2 (tokens de marcação/ficha de cliente dão acesso
a dados pessoais sem autenticação tradicional).

**Deteção:** token de marcação (`NEX-071`) ou, no futuro, token de área do
cliente (`NEX-220`) partilhado/indexado publicamente por engano (ex.:
aparece no Google, foi colado num local público).

**Impacto:** quem tiver o token consegue ver os dados da marcação/cliente
associados a esse token específico (não a outros tenants — tokens são
armazenados como hash e escopados a uma única marcação/cliente).

**Contenção imediata:**

1. Revogar o token afetado imediatamente (marcar como revogado na tabela
   correspondente) — a marcação/ficha deixa de ser acessível por esse link.
2. Emitir novo link/token se a cliente ainda precisar de acesso.

**Diagnóstico:** confirmar como o token foi exposto (indexação por
motor de busca — tokens não devem estar em páginas indexáveis,
`noindex`/`no-store`; partilha indevida; log acidental).

**Recuperação:** se for indexação, confirmar headers `noindex`/`no-store`
nas rotas de token (`NEX-228` para a futura área do cliente) e pedir
remoção ao motor de busca se necessário.

**Comunicação:** avisar a cliente afetada se os dados expostos forem
sensíveis.

**Pós-incidente:** rever geração de tokens (aleatoriedade, armazenamento
só como hash, rate limit no lookup) — já é a prática atual (`CLAUDE.md`),
confirmar que nenhuma exceção foi introduzida.

---

## 11. Restore de backup

**Severidade:** depende do gatilho (normalmente segue um SEV1 de perda de
dados).

**Deteção:** perda de dados confirmada (erro humano, corrupção,
incidente do fornecedor sem recuperação própria).

**Impacto:** potencial perda de marcações/clientes/financeiro desde o
último backup válido (RPO de 24h, ver `NEX-173`).

**Contenção imediata:** parar qualquer escrita adicional no tenant afetado
se possível (evitar agravar a inconsistência antes do restore).

**Diagnóstico:** confirmar o âmbito exato da perda (um tenant, vários,
tabela específica) e a data/hora do último backup válido
(`docs/evidence/NEX-173_BACKUPS_RESTORE_TEST.md`).

**Recuperação:**

1. Obter o dump mais recente (artifact do workflow
   `.github/workflows/backup-restore-test.yml`, retenção de 7 dias, ou um
   dump manual mais recente se disparado entretanto).
2. Se o projeto Supabase original ainda está saudável: restaurar para um
   projeto novo (`supabase db dump`/`psql` conforme o mesmo procedimento do
   workflow), validar integridade (contagem de linhas), e só depois trocar
   `NEXT_PUBLIC_SUPABASE_URL`/chaves no Vercel para o projeto novo.
3. Se for só uma tabela/registo específico corrompido: considerar restaurar
   apenas essa tabela para uma base temporária e copiar os dados
   corretos de volta (mais seguro que um restore completo).

**Comunicação:** informar a dona do RPO real (quanto tempo de dados pode
ter sido perdido) assim que confirmado.

**Pós-incidente:** documentar em `docs/evidence/`; se o RPO de 24h se
revelar insuficiente, considerar aumentar a frequência do workflow ou
migrar para o plano Pro do Supabase (backups geridos + PITR).
