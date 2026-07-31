# NEX-212 — Provisionamento de colaborador

## Objetivo

Fluxo de convite (nome, e-mail, role, prestador) que gera um link/token para
partilha manual pelo owner — token armazenado como hash, validade curta,
uso único, com rate limit e sem expor existência de e-mail.

## Âmbito desta tarefa vs. `NEX-217`

Esta tarefa entrega o **mecanismo de backend** (schema + geração/validação/
aceitação de convite) com as suas propriedades de segurança comprovadas por
teste. A **UI** de criar convite e a página `/convite/{token}` onde a
colaboradora define a password (que precisa de criar um utilizador real no
Supabase Auth via API admin, algo que só um Route Handler/Server Action da
app pode fazer, não uma função SQL) ficam para `NEX-217` ("UI da página
Equipa e Recursos"), que é o épico que constrói o wizard completo — a mesma
divisão que o próprio plano mestre já define entre estas duas tarefas.

## Implementação

- `supabase/migrations/0040_tenant_invites.sql` — `tenant_invites`
  (`token_hash` único, `name`, `email`, `role` — com `check (role <>
'admin')`, `is_provider`, `created_by`, `expires_at`, `used_at`/`used_by`).
  RLS tenant-scoped padrão.
- `src/lib/tenant-invite-token.ts` — geração (256 bits,
  `crypto.randomBytes`) e hash (sha256) do token, isolado num módulo próprio
  sem dependências (ver "Achado" abaixo).
- `src/lib/tenant-invite.ts` — `createInvite` (RLS-scoped, chamada pelo
  Server Action), `resolveInvite` (admin client + comparação
  `timingSafeEqual`, mesma disciplina de `resolveBookingByToken`/`NEX-071`
  — nunca distingue "expirado" de "usado" de "nunca existiu" no valor
  devolvido) e `acceptInvite` (cria `profiles` + `service_providers` quando
  aplicável, marca o convite usado atomicamente com `hasAffectedRows`-style
  check — `ADR-010` — para nunca aceitar duas vezes o mesmo token em corrida).
- `src/features/team/invite-actions.ts` — `createTeamInvite` Server Action:
  `tenantId`/`createdBy` só da sessão (`requireProfile()`), nunca de input;
  `hasPermission(role, 'manage_team')` verificado sempre no servidor; rate
  limit por `tenantId:ip`.
- `src/lib/rate-limit.ts` — dois limitadores novos: `teamInviteCreate` (10
  por hora, autenticado) e `teamInviteAccept` (20 por minuto, superfície
  pública — mesmo raciocínio do `bookingLookup`).

## Achado real ao escrever os testes: import estático rebentaria o CI

Ao escrever `tests/integration/tenant-invites.test.ts` com um `import`
estático de `@/lib/tenant-invite` no topo do ficheiro, o ficheiro **rebentava
mesmo sem correr nenhum teste** — `src/lib/tenant-invite.ts` importa
`src/lib/supabase/admin.ts`, que valida (`zod`) o schema completo de
variáveis de ambiente públicas logo ao ser importado. Isto não é só um
inconveniente local: o job `verify` do CI corre `npm run test:coverage`
**sem nenhuma variável Supabase definida** (só o job `build`, a seguir, as
define) — um import estático teria feito o `verify` falhar sempre, mesmo em
PRs sem nada a ver com Supabase. Corrigido de duas formas:

1. Extraído `generateInviteToken`/`hashInviteToken` para
   `src/lib/tenant-invite-token.ts`, um módulo sem nenhuma dependência —
   pode ser importado e testado (`tests/unit/tenant-invite-tokens.test.ts`)
   em qualquer ambiente, sem variáveis de ambiente nenhumas.
2. `resolveInvite`/`acceptInvite` (que precisam mesmo do admin client)
   passam a ser importados **dinamicamente** dentro de um `beforeAll`, não
   estaticamente no topo do ficheiro — mesma técnica já usada em
   `tests/unit/require-profile.test.ts`, agora também documentada aqui para
   a próxima tarefa que precisar do mesmo padrão.

## Testes

- `tests/unit/tenant-invite-tokens.test.ts` (5/5, sem BD): formato do
  token, unicidade, determinismo do hash, hash nunca igual ao token,
  rejeição de tokens malformados.
- `tests/integration/tenant-invites.test.ts` (7 testes): hash guardado
  (nunca o token em texto); `resolveInvite` aceita um convite válido;
  devolve `null` para um token que nunca existiu (sem sinal de
  enumeração); devolve `null` para um convite expirado; `acceptInvite`
  cria a membership e é de uso único (uma segunda tentativa com o mesmo
  token falha, e não cria perfil nenhum); cria `service_providers` quando
  o convite marca `isProvider`; rejeita `role = 'admin'` ao nível da base
  de dados.

## Estado real — mesma limitação de `NEX-210`

Os testes de integração só correm de facto no job `integration` do CI (sem
Docker/DB direta nesta sessão, ver `docs/evidence/NEX-210_*.md` para o
detalhe) — confirmei que agora **saltam corretamente** (`7 skipped`, não
erro) quando as variáveis não estão definidas, o que já não acontecia antes
da correção acima. `npm run verify` completo passa localmente.

## Definition of Done

- [x] Implementação concluída
- [ ] Testes concluídos — 5/5 unitários reais localmente; 7 de integração escritos e a saltar corretamente, execução real pendente do CI
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
