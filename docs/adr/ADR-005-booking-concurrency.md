# ADR-005 — Reserva atómica protegida na base

## Estado

Aceite

## Decisão

Usar constraint de exclusão GiST e função transacional para impedir sobreposição, inclusive sob concorrência.

## Consequência

A UI pode mostrar um slot que seja tomado milissegundos antes; a API retorna `SLOT_TAKEN` e exige nova escolha.
