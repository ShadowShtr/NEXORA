# Matriz de permissões (NEX-211)

> Fonte da verdade em código: `src/lib/auth/permissions.ts` (`hasPermission`),
> testada linha a linha contra esta tabela em `tests/unit/permissions.test.ts`.
> Atualizar os dois em conjunto — este documento nunca deve divergir do código.

## Roles

Definidos em `profiles.role` (`public.user_role`, `NEX-210`):

- **owner** — dona/proprietária. Sempre pelo menos uma por tenant
  (`assert_not_last_owner`, `NEX-210`).
- **manager** — gestora de confiança, opera o dia a dia mas não gere a
  equipa nem as definições do negócio.
- **receptionist** — rececionista: agenda e clientes, sem acesso a valores
  nem dados sensíveis.
- **provider** — prestadora que ocupa agenda; vê e conclui só os seus
  próprios atendimentos.
- **viewer** — acesso de leitura (ex.: contabilista externo): agenda e
  relatórios, sem poder de edição em nada.

`admin` (legado, `docs/adr/ADR-011-tenant-members-extends-profiles.md`) nunca
é atribuído — não consta desta matriz.

## Matriz

| Permissão            | Owner | Manager | Rececionista |           Prestador            | Viewer |
| -------------------- | :---: | :-----: | :----------: | :----------------------------: | :----: |
| Ver agenda           |  Sim  |   Sim   |     Sim      |       Sim (só a própria)       |  Sim   |
| Criar marcação       |  Sim  |   Sim   |     Sim      |              Não               |  Não   |
| Editar marcação      |  Sim  |   Sim   |     Sim      |              Não               |  Não   |
| Concluir atendimento |  Sim  |   Sim   |     Não      |       Sim (só a própria)       |  Não   |
| Ver valores          |  Sim  |   Sim   |     Não      |              Não               |  Sim   |
| Gerir clientes       |  Sim  |   Sim   |     Sim      |              Não               |  Não   |
| Ver notas privadas   |  Sim  |   Sim   |     Não      |              Não               |  Não   |
| Ver fichas sensíveis |  Sim  |   Sim   |     Não      |              Não               |  Não   |
| Gerir serviços       |  Sim  |   Sim   |     Não      |              Não               |  Não   |
| Gerir equipa         |  Sim  |   Não   |     Não      |              Não               |  Não   |
| Gerir stock          |  Sim  |   Sim   |     Não      |              Não               |  Não   |
| Ver relatórios       |  Sim  |   Sim   |     Não      | Não (fora de âmbito por agora) |  Sim   |
| Exportar dados       |  Sim  |   Sim   |     Não      |              Não               |  Não   |
| Alterar definições   |  Sim  |   Não   |     Não      |              Não               |  Não   |

## Racional por role

- **Owner**: sim a tudo — é quem responde legalmente pelo negócio.
- **Manager**: sim a quase tudo (opera o negócio como a owner faria no
  dia a dia), exceto **gerir equipa** (adicionar/remover pessoas, mudar
  roles) e **alterar definições** — decisões estruturais reservadas à
  owner, para que uma manager de confiança não possa, por engano ou má fé,
  alterar quem tem acesso ao sistema nem a configuração do negócio.
- **Rececionista**: agenda e clientes (a razão de ser do papel), sem
  visibilidade sobre dinheiro, notas privadas ou fichas sensíveis — a
  mesma reserva já explícita em `CLAUDE.md`/`docs/05_SECURITY_PRIVACY.md`
  para dados sensíveis.
- **Prestador**: vê e conclui só os atendimentos atribuídos a si própria —
  nunca a agenda ou os valores de outra prestadora. "Ver valores" fica
  fora do âmbito desta versão (a comissão/valor próprio do prestador é
  tema do `EPIC-24`, ainda por implementar) — não inventado aqui.
- **Viewer**: leitura pura de agenda e relatórios (o caso de uso é um
  contabilista externo a acompanhar o negócio) — zero permissões de
  escrita em qualquer linha desta matriz.

## Como isto se liga ao resto do sistema

`hasPermission(role, permission)` é a função central — qualquer
funcionalidade futura que precise de decidir "esta pessoa pode fazer X?"
chama-a, em vez de espalhar `if (role === 'owner' || role === 'manager')`
pelo código (o mesmo motivo por trás de `entitlements`/`canUseFeature`
planeados para `EPIC-31`). RLS continua a ser a garantia final ao nível da
base de dados (tenant-scoped via `current_tenant_id()`); esta matriz é a
camada de **autorização por role dentro do mesmo tenant**, que a RLS atual
não distingue (hoje qualquer membro autenticado do tenant passa a mesma
política RLS, independentemente do role — `NEX-217`/tarefas futuras vão
gradualmente ligar `hasPermission` a cada rota/Server Action à medida que a
UI de equipa for construída).
