# ADR-001 — Monólito modular Next.js

## Estado

Aceite

## Contexto

O MVP precisa de rapidez, baixo custo operacional e forte consistência em agenda/financeiro.

## Opções

1. Monólito modular Next.js.
2. Microsserviços.
3. Frontend SPA + backend separado.

## Decisão

Monólito modular Next.js App Router, com PostgreSQL/Supabase.

## Consequências positivas

- menos infraestrutura;
- transações simples;
- deploy e observabilidade centralizados.

## Consequências negativas

- exige disciplina de módulos;
- escala organizacional futura pode pedir extração de serviços.

## Segurança e privacidade

RLS na base e autorização no servidor permanecem obrigatórias.
