# ADR-012 — Exclusão de sobreposição deixa de ser só tenant-wide

## Estado

Aceite

## Contexto

`appointments_no_overlap` (`0001_initial.sql`, `NEX-063`) impede duas
marcações confirmadas de se sobreporem, `exclude using gist (tenant_id
with =, tstzrange(...) with &&)` — ou seja, **duas marcações no mesmo
tenant nunca podem coincidir no tempo, sem exceção**. Correto enquanto o
tenant representa uma única profissional independente (a agenda inteira é
uma pessoa só), mas incompatível com `EPIC-19`: um tenant com vários
prestadores (`NEX-210`) precisa que Prestador A e Prestador B tenham
marcações simultâneas, servindo clientes diferentes ao mesmo tempo — é
literalmente o motivo de ter uma equipa. `NEX-215`/`216` exigem
explicitamente "a reserva impede conflito de prestador e de recurso" e
códigos de conflito distintos (`PROVIDER_TAKEN`, `RESOURCE_TAKEN`,
`SLOT_TAKEN`), que pressupõem que o "recurso partilhado" que não pode
colidir já não é sempre "o tenant inteiro".

## Opções

1. Manter a exclusão tenant-wide e resolver conflitos de prestador só em
   código (aplicação), sem garantia ao nível da base de dados — mesma
   classe de risco que motivou originalmente ter uma constraint de exclusão
   em vez de só verificação na aplicação (`NEX-063`/`ADR-005`,
   concorrência real já corrigida uma vez, `NEX-178`).
2. Substituir a exclusão tenant-wide por uma exclusão scoped a
   `provider_id` — quebra o caso de uma marcação sem prestador atribuído
   (nenhuma proteção nenhuma) e o caso de conflito de recurso (uma sala
   reservada por dois prestadores diferentes ao mesmo tempo continuaria a
   passar).
3. **Três exclusões distintas, cada uma scoped ao seu próprio "recurso
   partilhado"**: `provider_id` (quando preenchido), `resource_id` (quando
   preenchido), e `tenant_id` só para marcações sem nenhum dos dois
   (preserva exatamente o comportamento de hoje para esse caso).

## Decisão

Opção 3. Preserva a garantia ao nível da base de dados (não só na
aplicação) para os três casos que agora coexistem, sem regressão para o
caso solo (uma marcação sem `provider_id`/`resource_id` continua protegida
tenant-wide, byte a byte como antes). Uma marcação com prestador **e**
recurso fica protegida pelas duas exclusões de prestador/recurso em
simultâneo — nenhuma delas depende da outra.

## Consequências positivas

- Zero regressão para tenants sem equipa (o caso de hoje, "solo"):
  qualquer marcação sem prestador/recurso atribuído continua com a mesma
  exclusão tenant-wide de sempre.
- Conflito de prestador e conflito de recurso continuam a ser garantidos
  pela própria base de dados (`gist exclude`), não só por uma verificação
  otimista na aplicação — mesma filosofia de `NEX-063`/`ADR-005`.
- Um prestador ocupado não bloqueia outro prestador livre no mesmo
  horário — o requisito central de ter uma equipa.

## Consequências negativas

- Uma marcação com `provider_id` preenchido mas **sem** `resource_id`
  (comum — nem todo serviço precisa de sala/equipamento dedicado) só está
  protegida contra sobrepor-se a **outras marcações do mesmo prestador**,
  não contra nada relacionado ao tenant como um todo — correto e
  intencional (é exatamente o comportamento pretendido de uma equipa), mas
  significa que "duas marcações no mesmo tenant, ambas sem conflito de
  prestador/recurso porque são prestadores/recursos diferentes" deixam de
  soar como uma contradição perante o nome antigo da constraint.
- Uma tarefa futura (`NEX-216`, motor de disponibilidade multi-recurso)
  ainda precisa de mapear cada violação de exclusão para o código de
  conflito certo (`PROVIDER_TAKEN` vs. `RESOURCE_TAKEN` vs. `SLOT_TAKEN`) —
  esta migração só garante a integridade dos dados, não a mensagem de erro
  amigável (isso é aplicação, não constraint).

## Segurança e privacidade

Sem impacto direto em dados pessoais. Risco de integridade mitigado, não
introduzido: a garantia de "nunca dupla marcação" mantém-se ao nível da
base de dados para os três casos, incluindo sob concorrência real (mesmo
padrão de `exclude using gist` já testado sob carga em `NEX-175`).
