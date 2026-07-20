# 06 — APIs e contratos

## Convenções

- Rotas internas usam Server Actions quando adequadas e Route Handlers para contratos HTTP explícitos.
- JSON padronizado: `{ data, error, meta }`.
- Erros não revelam stack nem detalhes de DB.
- Request ID em todas as respostas.
- Validação Zod de input e output crítico.
- Idempotency key em criação pública e operações financeiras sensíveis.

## Erros semânticos

| Código               | HTTP | Significado                             |
| -------------------- | ---: | --------------------------------------- |
| VALIDATION_ERROR     |  400 | dados inválidos                         |
| UNAUTHENTICATED      |  401 | sessão ausente/inválida                 |
| FORBIDDEN            |  403 | sem permissão                           |
| NOT_FOUND            |  404 | recurso inexistente no escopo           |
| SLOT_TAKEN           |  409 | horário ocupado durante confirmação     |
| IDEMPOTENCY_CONFLICT |  409 | chave reutilizada com payload diferente |
| RATE_LIMITED         |  429 | limite excedido                         |
| INTERNAL_ERROR       |  500 | falha inesperada                        |

## Rotas públicas previstas

### `GET /api/public/business/{slug}`

Retorna apenas dados públicos necessários.

### `GET /api/public/business/{slug}/catalog`

Categorias, serviços e pacotes ativos.

### `POST /api/public/business/{slug}/availability`

Input:

- item IDs;
- intervalo de datas;
- timezone implícito do tenant.

Output: lista de slots com início/fim ISO.

### `POST /api/public/business/{slug}/bookings`

- exige idempotency key;
- valida cliente, itens, slot e observação;
- cria/atualiza cliente por telemóvel;
- cria appointment e snapshots em transação;
- devolve token público e código de consulta de 8 caracteres uma única vez cada (`create_public_booking`, `0018_booking_lookup_code.sql`).

### `GET /api/bookings/{token}`

Retorna visão pública mínima da marcação.

### `GET /api/bookings/{token}/calendar.ics`

Gera ICS sem dados excessivos.

### `/marcacao` (página, não API JSON)

Formulário de consulta por código de 8 caracteres — alternativa ao link `/marcacao/{token}` para quem perdeu a mensagem original mas guardou o código. Server action `lookupBookingByCode` (`src/app/marcacao/lookup-actions.ts`) chama `resolve_booking_lookup_code`, rate-limited pelo mesmo limiter de `GET /api/bookings/{token}` (`checkBookingLookupRateLimit`). Resposta uniforme (vazio) tanto para código malformado quanto desconhecido.

## Rotas privadas previstas

- CRUD de serviço/categoria/pacote.
- agenda e bloqueios.
- criação manual.
- recorrência.
- conclusão/ajustes/pagamento.
- clientes e histórico.
- reminders.
- relatórios/exportações.
- configurações.

## Webhooks

Não há webhook obrigatório no MVP. Ao integrar e-mail/observabilidade, validar assinatura quando o fornecedor oferecer.

## Versionamento

- APIs públicas sob `/api/v1` antes de abertura a terceiros.
- Rotas internas podem evoluir com o frontend, mas contratos críticos devem ter testes.
