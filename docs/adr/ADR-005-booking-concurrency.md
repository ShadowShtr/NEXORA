# ADR-005 — Reserva atómica protegida na base

## Estado

Aceite

## Decisão

Usar constraint de exclusão GiST e função transacional para impedir sobreposição, inclusive sob concorrência.

## Consequência

A UI pode mostrar um slot que seja tomado milissegundos antes; a API retorna `SLOT_TAKEN` e exige nova escolha.

## Nota de implementação (NEX-178)

Duas causas adicionais de falha só se manifestam sob concorrência real (não
mockada): (1) um cliente React que trata o resultado da confirmação com
`fetch()` inline e vários `useState` booleanos independentes pode nunca
concluir o estado da UI, dependendo da ordem de resolução das promises —
requer uma máquina de estados discriminada, `AbortController` e `finally`
garantido; (2) sob contenção alta, o Postgres pode escolher a transação
como vítima de deadlock (`40P01`), uma categoria de erro distinta da
exclusion constraint (`23P01`) — requer um retry único da operação, tratado
como caso recuperável, não como erro fatal. Ver
`docs/evidence/NEX-178_PUBLIC_BOOKING_CLIENT_CONCURRENCY.md` para a
investigação completa e a correção aplicada.
