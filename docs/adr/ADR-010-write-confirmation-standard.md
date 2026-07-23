# ADR-010 — Confirmação de linhas afetadas em mutações diretas

## Estado

Aceite

## Contexto

Aplicámos as regras do repositório `saas-foundation-shadowshtr` (uma norma de engenharia própria do dono, derivada em parte das lições da auditoria de reversões da Mó Limpezas — `docs/evidence/MO_LIMPEZAS_AUDIT_V_LESSONS.md` nesse repositório) contra a NEXORA.

Corremos os dois scripts de auditoria só-leitura desse repositório (`scripts/audit-repository.mjs`, `scripts/check-sql-safety.mjs`) contra este projeto. Os 5 alertas gerados foram todos confirmados manualmente como falsos positivos:

- `.env.local` — corretamente ignorado pelo git, nunca commitado.
- "privilégio admin num Client Component" (`src/lib/supabase/admin.ts`) — a heurística apanhou a string `'use client'` dentro de um **comentário** explicativo, não uma diretiva real.
- "SQL destrutivo" (`0004_audit_logs_immutable.sql`) — apanhou a frase "DELETE FROM tenants is not a designed..." dentro de um **comentário**; a migração na verdade adiciona triggers que _bloqueiam_ deletes.
- 2× "cliente admin sem escopo de tenant visível" — um é o próprio ficheiro que define `createAdminClient()` (nada para ele próprio escopar), o outro é `resolveBookingByLookupCode`, uma RPC pública de lookup anónimo, já corretamente `security definer` (ADR-008).

Comparando com o template Next.js/Supabase desse repositório, encontrámos uma lacuna real e pequena (corrigida em separado): `/api/health` não expunha o commit implantado, contrariando a regra "produção deve provar o commit implantado por endpoint seguro".

A comparação também revelou uma lacuna estrutural maior. As mutações mais críticas do produto (conclusão de atendimento, marcar pagamento como pago, marcar lembrete como enviado, criação de marcação) já passam por RPCs `security definer` com `select ... for update` seguido de `raise exception` se a linha não existir — isto já satisfaz "zero linhas afetadas produz erro visível" ao nível da transação da base de dados. Mas cerca de 13 outras mutações, em 6 ficheiros (`catalog/actions.ts`, `catalog/photo-actions.ts`, `clients/actions.ts`, `onboarding/actions.ts`, `reminders/template-actions.ts`, `settings/no-show-policy-actions.ts`), faziam `.update()`/`.delete()` diretos no cliente Supabase que só verificavam `error`, nunca linhas afetadas. Sob RLS, um `id` inválido, de outro tenant, ou apagado concorrentemente faz o Supabase devolver sucesso com zero linhas alteradas — não um erro. A ação reportava "guardado com sucesso" sem ter mudado nada: exatamente a classe de bug "gravei mas desapareceu" que esta norma existe para prevenir.

`tests/integration/rls-tenant-isolation.test.ts` já prova este mecanismo ao nível da RLS ("authenticated owner cannot update another tenant client row" → `error: null, data: []`) — a política RLS genérica por tabela (`0001_initial.sql`) é idêntica em todas as tabelas `tenant_id`-scoped, por isso este comportamento generaliza estruturalmente a qualquer mutação direta no cliente Supabase.

## Opções

1. Não fazer nada — confiar em `error` continuar a ser suficiente, como até agora.
2. Adotar a utilidade `write-confirmation.ts` do `saas-foundation` tal como está (lança exceção), forçando todas as ações a adotar tratamento por exceção.
3. Adaptar o padrão ao estilo já estabelecido neste projeto: uma função pura que devolve `boolean`, usada para decidir entre `{ok:true}`/`{ok:false, error:{code:'NOT_FOUND',...}}` — o tipo `Result<T>` já usado em todas as Server Actions deste projeto, sem introduzir um segundo estilo de erro (exceções) a conviver com o primeiro.

## Decisão

Opção 3. Criámos `src/lib/write-confirmation.ts` com `hasAffectedRows<T>(rows)`, e adicionámos `.select()` + esta verificação a toda mutação direta (`.update()`/`.delete()`) identificada que ainda não confirmava linhas afetadas:

- `catalog/actions.ts`: `renameCategory`, `toggleCategoryVisibility`, `moveCategory` (as duas trocas), `updateService`, `toggleServiceActive`, `updatePackage` (a atualização do pacote — o delete de `package_services` fica sem verificação, de propósito: apagar zero linhas aí é um estado legítimo, não uma escrita perdida), `togglePackageActive`.
- `catalog/photo-actions.ts`: `uploadServicePhoto` (com limpeza do objeto órfão no Storage se a linha não for confirmada), `removeServicePhoto`.
- `clients/actions.ts`: `updateClientPreferences` (já tinha a verificação; uniformizado para usar `hasAffectedRows`).
- `onboarding/actions.ts`: `submitBusinessStep`, `submitHoursStep` (o avanço do passo do wizard não tinha sequer verificação de `error` antes), `submitRulesStep`.
- `reminders/template-actions.ts`: `updateReminderTemplate`.
- `settings/no-show-policy-actions.ts`: `updateNoShowPolicy`.

`clients/photo-actions.ts` e `app/b/[slug]/draft-actions.ts` já seguiam o padrão corretamente (verificação prévia de existência ou `.select().maybeSingle()`) — sem alterações.

`onboarding/actions.ts`'s `moveStep` (chamada por `goToNextStep`/`goToPreviousStep`) foi deixada sem a verificação, documentada com um comentário: é uma ação `void` sem contrato `Result` para reportar falha, e `business_settings` é criada uma-por-tenant no aprovisionamento (`provision_tenant_owner`) — não existe um "tenant errado" possível para um `tenantId` vindo de uma sessão autenticada, ao contrário de um `id` vindo de um formulário.

## Consequências positivas

- Fecha a classe de bug "ação reporta sucesso, nada mudou" nas ~13 mutações identificadas, sem introduzir um segundo estilo de tratamento de erro no projeto.
- `hasAffectedRows` é testada isoladamente (`tests/unit/write-confirmation.test.ts`) e reutilizável por qualquer ação futura.
- Não duplicámos a prova da RLS já existente em `rls-tenant-isolation.test.ts` — o mecanismo é o mesmo em todas as tabelas `tenant_id`-scoped (política genérica de `0001_initial.sql`), por isso essa prova generaliza.

## Consequências negativas

- Mais uma chamada `.select()` por mutação (custo desprezível para uma tabela indexada por `id`).
- Não escrevemos testes de integração novos, por ação, provando o `NOT_FOUND` end-to-end — apoiámo-nos na prova já existente ao nível da RLS mais o facto de o padrão ser mecanicamente idêntico em todos os pontos corrigidos. Se uma ação futura desviar desse padrão, precisa do seu próprio teste.
- A lacuna estrutural maior só foi fechada nas mutações diretas já identificadas nesta auditoria — uma auditoria futura pode encontrar mais.

## Segurança e privacidade

Sem impacto direto em dados pessoais ou segredos. Reduz o risco de um utilizador (ou um bug futuro) acreditar que uma alteração foi persistida quando não foi — closes a integrity gap, não introduz nenhuma superfície de ataque nova (a autorização real continua a ser a RLS, `hasAffectedRows` só torna visível uma falha que já acontecia silenciosamente).
