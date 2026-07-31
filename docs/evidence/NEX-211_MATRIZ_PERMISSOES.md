# NEX-211 — Matriz de permissões

## Objetivo

Documentar, por role, as permissões de agenda, marcações, valores, clientes,
notas privadas, fichas sensíveis, serviços, equipa, stock, relatórios,
exportação e definições — e ter código testável que a implemente, não só
prosa.

## Implementação

- `docs/PERMISSION_MATRIX.md` — tabela Sim/Não para as 14 permissões × 5
  roles (`owner`, `manager`, `receptionist`, `provider`, `viewer`), com
  racional por role explicando as decisões (ex.: porque `manager` não gere
  equipa nem definições, porque `provider` só vê a própria agenda).
- `src/lib/auth/permissions.ts` — `hasPermission(role, permission)`, fonte
  única de verdade em código para a matriz. Padrão deliberado (mesmo
  motivo do `entitlements`/`canUseFeature` planeado para `EPIC-31`): nunca
  espalhar `if (role === 'owner' || role === 'manager')` pelo código.

## Testes

`tests/unit/permissions.test.ts` transcreve a tabela de
`docs/PERMISSION_MATRIX.md` linha a linha (70 combinações
permissão×role) e confirma `hasPermission` contra ela — se os dois
alguma vez divergirem, é este teste que apanha, não uma reafirmação da
própria implementação. Mais 3 testes de resumo (owner tem tudo; só owner
gere equipa/definições; viewer não tem nenhuma permissão de escrita).
73/73 a passar, sem precisar de base de dados nem Docker — corre em
qualquer ambiente.

## Estado real

Esta tarefa é só a **camada de decisão** (o quê cada role pode fazer) — a
sua **aplicação real** a rotas/Server Actions específicas ainda não existe
(não há UI de equipa nem RLS por role ainda; `RLS` continua a ser
tenant-scoped por `current_tenant_id()`, sem distinguir role dentro do
mesmo tenant). `hasPermission` fica pronta para as tarefas seguintes
(`NEX-217` UI de equipa e recursos, e cada funcionalidade que precisar de
verificar "esta pessoa pode fazer X?") a chamarem, em vez de inventarem a
sua própria lógica de autorização por role. Isto está declarado como não
sendo um gap escondido — é a ordem natural do épico (modelo → matriz →
provisionamento → UI → aplicação real).

## Definition of Done

- [x] Implementação concluída — `docs/PERMISSION_MATRIX.md` + `src/lib/auth/permissions.ts`
- [x] Testes concluídos — 73/73, sem dependência de BD
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
