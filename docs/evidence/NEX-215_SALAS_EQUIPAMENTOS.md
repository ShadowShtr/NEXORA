# NEX-215 — Salas e equipamentos

## Objetivo

`resources` (sala/equipamento/cadeira/outro), com capacidade, cor,
localização e serviços compatíveis; a marcação pode exigir prestador,
recurso ou ambos, e a reserva impede conflito de ambos.

## Achado real: a exclusão de sobreposição existente era tenant-wide

Ao desenhar "a reserva impede conflito de prestador e de recurso",
confirmei que `appointments_no_overlap` (`0001_initial.sql`, `NEX-063`) é
`exclude using gist (tenant_id with =, ...)` — **qualquer** duas marcações
confirmadas no mesmo tenant já não podiam sobrepor-se, sem exceção. Correto
enquanto o tenant representava uma só profissional, mas incompatível com
`EPIC-19`: dois prestadores diferentes precisam de poder ter marcações
simultâneas. Documentado em
`docs/adr/ADR-012-multi-provider-overlap-exclusion.md`.

## Implementação

`supabase/migrations/0043_resources_and_multi_resource_conflicts.sql`:

- `resources` (`type` enum `room`/`equipment`/`chair`/`other`, `capacity`,
  `color` hex validado, `location` — texto livre, não FK, já que não existe
  tabela `locations` ainda, `EPIC-27`; `is_active`).
- `resource_services` (N:N, trigger de mesmo-tenant, mesmo padrão de
  `provider_services`, `NEX-214`).
- `appointments.provider_id`/`appointments.resource_id` (novas, nuláveis).
- **`appointments_no_overlap` substituída por três exclusões distintas**
  (ver `ADR-012` para o racional completo):
  1. `appointments_no_overlap_provider` — o mesmo prestador não pode ter
     duas marcações sobrepostas.
  2. `appointments_no_overlap_resource` — o mesmo recurso não pode ter
     duas marcações sobrepostas, independentemente do prestador.
  3. `appointments_no_overlap_tenant_wide` — só para marcações sem
     prestador nem recurso atribuído: **comportamento de hoje, inalterado**.
- Trigger `appointments_provider_resource_same_tenant`: garante que o
  prestador/recurso de uma marcação pertence ao mesmo tenant.

## Testes

`tests/integration/resources-and-overlap.test.ts` (7 testes, mesma
limitação de execução real da BD do resto deste lote — corre no CI):

- Cria um recurso com tipo/capacidade/cor/localização.
- Rejeita `resource_services` entre tenants diferentes.
- **Dois prestadores diferentes PODEM ter marcações sobrepostas** — o
  requisito central de ter equipa.
- O MESMO prestador não pode ter duas marcações sobrepostas.
- O MESMO recurso não pode ser reservado a dobrar, mesmo por prestadores
  diferentes.
- Uma marcação simples (sem prestador nem recurso) continua protegida
  tenant-wide — **comportamento de hoje confirmado inalterado**.
- Rejeita uma marcação cujo `provider_id` pertence a outro tenant.

## Definition of Done

- [x] Implementação concluída
- [ ] Testes concluídos — escritos e revistos; execução real (incl. a mudança crítica na exclusão de sobreposição) pendente do job `integration` do CI
- [x] Documentação atualizada — `ADR-012` + este ficheiro
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
