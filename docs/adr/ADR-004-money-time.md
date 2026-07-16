# ADR-004 — Dinheiro em cêntimos e tempo em UTC

## Estado

Aceite

## Decisão

Valores são inteiros em cêntimos. Eventos são armazenados como `timestamptz` UTC e exibidos no timezone IANA do tenant.

## Motivo

Evitar erros de ponto flutuante e ambiguidades de horário de verão.
