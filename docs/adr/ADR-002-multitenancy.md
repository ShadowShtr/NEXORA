# ADR-002 — Multi-tenancy por schema partilhado com RLS

## Estado

Aceite

## Decisão

Todos os recursos de negócio usam `tenant_id`; PostgreSQL RLS aplica isolamento. A primeira UI mostra apenas uma profissional.

## Consequências

Menor custo e boa escalabilidade inicial, com maior exigência de testes de isolamento e disciplina em queries.
