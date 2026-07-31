# NEX-214 — Serviços por prestador

## Objetivo

Relação N:N prestador-serviço com preço/duração opcionais, ativo e
prioridade; sem override, usa o preço/duração do serviço base.

## Implementação

`supabase/migrations/0042_provider_services.sql`:

- `provider_services` — `provider_id`/`service_id` (FK), `price_cents`/
  `duration_minutes` nuláveis (a ausência é o sinal de "usar o valor base",
  não zero), `is_active`, `priority`. `unique(provider_id, service_id)`.
- Trigger `provider_services_same_tenant`: rejeita associar um prestador ou
  serviço de outro tenant (mesma garantia de `service_providers`, `NEX-210`).
- RLS tenant-scoped padrão.

`src/features/appointments/domain/provider-service.ts` —
`resolveEffectiveProviderService(base, override)`: `null` em qualquer campo
do override cai para o valor do serviço base; um valor definido (incl. `0`
cêntimos, um preço válido embora invulgar) é sempre respeitado.

## Testes

- `tests/unit/provider-service.test.ts` (5/5, sem BD, **corridos e a
  passar de facto**): herança total sem override; override só de preço;
  override só de duração; ambos os overrides ("Personalizar para esta
  pessoa"); `0` cêntimos tratado como valor válido, não como "por definir".
- `tests/integration/provider-services.test.ts` (5 testes, mesma limitação
  de execução real de `NEX-210`/`212`/`213` — corre no CI): associação sem
  override com defaults corretos; associação com override; rejeita par
  duplicado; rejeita prestador de tenant diferente do serviço; rejeita
  preço negativo.

## Definition of Done

- [x] Implementação concluída
- [ ] Testes concluídos — lógica de fallback 5/5 real; schema/RLS pendentes do CI
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
