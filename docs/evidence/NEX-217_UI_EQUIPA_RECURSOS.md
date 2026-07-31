# NEX-217 — UI da página Equipa e Recursos

## O que foi feito

Nova página `/dashboard/equipa`, acessível em **Mais → Gestão → Equipa e recursos**
(mobile, `src/app/(dashboard)/dashboard/mais/page.tsx`) e **Sidebar → Gestão → Equipa e
recursos** (desktop, `src/features/shell/AppShell.tsx`) — em ambos os casos só
visível/acessível a quem tem a permissão `manage_team` (`hasPermission`, NEX-211); a
própria página repete o gate server-side (não confia só na navegação estar escondida).

### Estrutura

- `src/app/(dashboard)/dashboard/equipa/page.tsx` — server component, 3 tabs via
  `?tab=` (`pessoas` default, `recursos`, `permissoes`), cabeçalho com botão voltar
  (para `/dashboard/mais`) e subtítulo de apoio.
- `src/features/team/queries.ts` — leitura combinada de `profiles` + `service_providers`
  (ADR-011: profiles já é a tabela de membros) para a lista de pessoas,
  `tenant_invites` pendentes, `resources` + contagem de `resource_services`, e serviços
  ativos do tenant para os pickers.
- `src/features/team/PeopleTabClient.tsx` / `ResourcesTabClient.tsx` — client
  components: filtros (Todos/Prestadores/Gestão/Inativos para pessoas), estado vazio
  com o texto exato do plano mestre, listas de cards, abertura do editor em
  `BottomSheet`.
- `src/features/team/PersonCard.tsx` / `ResourceCard.tsx` — cards de 88 a ~104px, sem
  e-mail completo no card de pessoa (só nome, role, indicador de prestadora, nº de
  serviços, badge inativa).
- `src/features/team/PersonEditorWizard.tsx` — wizard de 4 passos (Dados, Acesso,
  Serviços, Horários), ver limitações abaixo.
- `src/features/team/ResourceEditorSheet.tsx` — formulário único (nome, tipo, ícone
  por tipo, localização, serviços associados, estado) — o plano mestre não pede um
  wizard para recursos, só para pessoas.
- `src/features/team/PermissionsTab.tsx` — tabela só de leitura da matriz de
  permissões (`src/lib/auth/permissions.ts`, NEX-211/`docs/PERMISSION_MATRIX.md`).
- `src/features/team/member-actions.ts` / `resource-actions.ts` — Server Actions:
  `updateMemberRole`, `setMemberActive` (ambas chamam `assert_not_last_owner` antes de
  demover/desativar uma dona), `setProviderServices`, `revokeInvite`, `createResource`,
  `updateResource`, `setResourceActive`. Todas seguem o padrão já estabelecido em
  `invite-actions.ts`: Zod no limite, `requireProfile()` para `tenantId`/`role` (nunca
  do cliente), `hasPermission(role, 'manage_team')` antes de qualquer escrita,
  `hasAffectedRows` (ADR-010) em todo `.update()`/`.delete()` direto.

## Limitações honestas (documentadas, não escondidas)

1. **Serviços/Horários no fluxo de convite de uma pessoa nova**: uma pessoa convidada
   ainda não tem `service_providers`/conta própria até aceitar o convite
   (`acceptInvite`, NEX-212) — não há `provider_id` a que atribuir
   `provider_services`/`provider_business_hours` antes disso. Os passos 3 e 4 do
   wizard, no modo "nova pessoa", mostram uma explicação em vez de um formulário sem
   destino real, e ficam plenamente funcionais assim que a pessoa é editada depois de
   já ativa (member !== null).
2. **Horário próprio por prestadora**: não existe ainda um editor de
   `provider_business_hours` (NEX-213) nesta versão — o passo "Horários" explica que a
   prestadora segue o horário do negócio por predefinição (o mesmo fallback que
   `resolveProviderDayHours` já implementa corretamente no motor de disponibilidade,
   NEX-216). Construir esse editor fica para uma iteração futura.
3. **Sem página de aceitação de convite**: `acceptInvite()`/`resolveInvite()`
   (`src/lib/tenant-invite.ts`, NEX-212) existem e estão testados, mas não há ainda
   uma rota pública que os consuma — o wizard mostra o token gerado para partilha
   manual (tal como o comentário da migração `0040_tenant_invites.sql` prevê:
   "partilha manual pelo owner"), mas quem o receber ainda não tem para onde o usar.
   Fora do âmbito literal de NEX-217 (UI de gestão, não a superfície de aceitação),
   mas é um gap real a resolver antes do lançamento de multi-prestador.
4. **"Próximo horário de trabalho" no card de pessoa**: o plano mestre pede este dado
   no card; não existe ainda uma query que calcule o próximo turno de uma prestadora, e
   fabricar um valor violaria a regra do CLAUDE.md contra dados inventados. Omitido do
   card por agora.

## Verificação

- `npm run verify` completo: format, lint (`--max-warnings=0`), typecheck, 635 testes
  unitários/integração (224 skipped por falta de credenciais reais), `next build`
  (rota `/dashboard/equipa` compilada com sucesso), bundle budget — tudo verde.
- **Verificação visual/axe real não foi possível**: este ambiente sandboxed não tem
  Docker nem uma base de dados local com as migrações 0039–0043 aplicadas, e o
  Supabase configurado em `.env.local` é o projeto partilhado dev/prod da NEXORA — não
  é seguro nem apropriado autenticar-se aí para testar visualmente uma funcionalidade
  ainda não aplicada à base de dados de produção. Em vez disso, confirmei
  comportamento sem sessão: `npx next dev` local, `GET /dashboard/equipa` devolve
  `307` para `/login` (o mesmo comportamento de qualquer página do dashboard sem
  sessão, via `requireProfile()`), sem nenhum erro no log do servidor — confirma que a
  página compila e renderiza no primeiro passo sem exceções, mas não substitui a
  verificação visual mobile/tablet/desktop e axe pedida no épico.

## Estado

`[~]` parcial — implementação completa e coerente com os padrões existentes, testada
ao nível de compilação/lint/tipos; verificação visual/axe e a superfície de aceitação
de convite ficam como risco residual documentado, não como trabalho escondido.
