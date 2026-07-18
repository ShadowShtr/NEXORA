# EPIC-07 — Confirmação e link da marcação

## Objetivo do épico

Entregar **confirmação e link da marcação** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-070 — Criar ecrã final de confirmação

**Dependências:** NEX-064

**Objetivo**

Implementar criar ecrã final de confirmação sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Confirmação curta com três ações. `BookingConfirmation` (`src/app/b/[slug]/BookingConfirmation.tsx`) substitui o placeholder de sucesso do carrinho público (`PublicBookingCart.tsx`) e mostra "Ver marcação" (`/marcacao/{token}`, `NEX-071`), "Adicionar ao calendário" (`.../calendar.ics`, `NEX-072`) e "Ver no mapa" (`NEX-073`, resolvido uma vez pela página-mãe e passado como prop). Nova página `/marcacao/[token]` (`src/app/marcacao/[token]/page.tsx`, Server Component) chama `resolveBookingByToken` diretamente (mesma resolução de `NEX-071`, sem round-trip HTTP a si própria) e apresenta data/hora no timezone do negócio (`date-fns-tz` + locale `pt`), itens, total e morada — a vista legível que faltava para "Ver marcação" não abrir JSON cru.
- Nenhum dado de outro tenant pode ser acedido. Mesma resolução por hash de token de `NEX-071`; `resolveBookingByToken` estendido com `business.timezone` (necessário para formatar a data corretamente), sem novo acesso a dados de outro tenant.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Três botões diretos, mensagem curta ("A sua marcação foi confirmada com sucesso."), estado da marcação traduzido (`STATUS_LABELS`).
- Logs não contêm segredos nem PII desnecessária. Nenhum logging novo.

**Testes obrigatórios**

- E2E. `tests/e2e/public-booking-confirmation.spec.ts`: fluxo completo do carrinho até à confirmação real (reserva de verdade via `createPublicBooking`), confirma que as três ações aparecem com `href` no formato esperado, que "Ver marcação" leva a uma página legível (não JSON) com os itens/total corretos, e que "Adicionar ao calendário" serve um ficheiro `text/calendar` válido.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhum privilégio novo — `/marcacao/[token]` é só uma vista HTML sobre a mesma resolução de token pública já existente (`NEX-071`), com o mesmo 404 uniforme (`notFound()` do Next.js) para token inválido/desconhecido.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A — herda a garantia de `resolveBookingByToken`.
- Registar risco residual ou decisão temporária. Nenhum risco residual novo.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-071 — Criar link público seguro

**Dependências:** NEX-064

**Objetivo**

Implementar criar link público seguro sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Token hash, vista mínima, revogação e respostas uniformes. `GET /api/bookings/{token}` (`src/app/api/bookings/[token]/route.ts`): resolve `appointments.booking_token_hash` (já existente desde `0001_initial.sql`, `create_public_booking`/`NEX-064` só devolve o token em claro uma vez, na criação), comparação final por `timingSafeEqual` como defesa em profundidade. Vista mínima: nome do negócio/morada, itens da marcação, data/hora e `status` atual — nunca telefone/e-mail do cliente. "Revogação": não há ainda cancelamento/reagendamento no produto (épicos futuros); a vista já reflete honestamente o `status` da marcação em vez de assumir sempre ativa, o que é a base sobre a qual um cancelamento futuro (`NEX-084`) automaticamente revoga o valor prático do link sem trabalho adicional aqui.
- Nenhum dado de outro tenant pode ser acedido. Lookup é só por `booking_token_hash` (índice único global), nunca por `tenant_id` do caller — não há como um token válido de um tenant devolver dados de outro.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. N/A — rota HTTP pura (JSON); consumida por UI em `NEX-070`.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging na rota; o token nunca é escrito em log algum, só usado para derivar o hash em memória.

**Testes obrigatórios**

- Enumeração e logs. `tests/e2e/booking-token-lookup.spec.ts`: token malformado, token bem-formado mas inexistente e uma tentativa contra dados de outro registo devolvem exatamente o mesmo corpo/`404` (`docs/05_SECURITY_PRIVACY.md`, T3); vista mínima confirmada sem nome/telefone do cliente na resposta; `Cache-Control: no-store` confirmado. Rate limit dedicado (`checkBookingLookupRateLimit`, 60/min, `src/lib/rate-limit.ts`) como defesa adicional contra scripted enumeration, reaproveitando a infraestrutura de `NEX-066`.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhum privilégio novo — leitura pública já prevista desde `NEX-064` (token devolvido ao cliente para "ver marcação").
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A — acesso por posse do token (256 bits de entropia, hash em BD), não por sessão/tenant; service-role necessário porque `appointments`/`appointment_items` não têm política `anon`.
- Registar risco residual ou decisão temporária. Mesmo risco residual de `NEX-066`: sem `RATE_LIMIT_REDIS_URL`/`_TOKEN` configurados, esta rota também degrada para "sem limite" (mitigado pela entropia do token em si).

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-072 — Gerar ficheiro ICS

**Dependências:** NEX-071

**Objetivo**

Implementar gerar ficheiro ics sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Timezone, duração, morada e UID estável. `GET /api/bookings/{token}/calendar.ics` (`src/app/api/bookings/[token]/calendar.ics/route.ts`) reaproveita `resolveBookingByToken` (`NEX-071`) e gera um único `VEVENT` via `generateIcsEvent` (`src/lib/ics.ts`, sem dependência externa — RFC 5545 mínimo). `DTSTART`/`DTEND` em UTC (`...Z`), interpretados corretamente por qualquer cliente independente do timezone do visitante; duração é a diferença real entre `start_at`/`end_at` da marcação; `LOCATION` formatado a partir da morada do negócio; `UID` é `{appointment_id}@nexora` — estável entre re-downloads do mesmo token (re-importar atualiza o evento existente em vez de duplicar).
- Nenhum dado de outro tenant pode ser acedido. Mesma resolução por hash de token de `NEX-071`, sem `tenant_id` do caller.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. N/A — rota HTTP (`text/calendar`, `Content-Disposition: attachment`); consumida por UI em `NEX-070`.
- Logs não contêm segredos nem PII desnecessária. Nenhum logging na rota.

**Testes obrigatórios**

- Import em Google/Apple/Outlook. `tests/unit/ics.test.ts`: conformidade estrutural RFC 5545 exaustiva — `CRLF`, folding de linhas >75 octetos, escaping de `,`/`;`/`\`, `DTSTART`/`DTEND` em UTC, `UID` estável, `LOCATION`/`DESCRIPTION` só quando presentes (esta é a garantia real de compatibilidade com os três clientes, todos leitores RFC 5545 padrão). `tests/e2e/booking-calendar-ics.spec.ts`: contrato HTTP real (`Content-Type: text/calendar`, `Content-Disposition: attachment; filename=...ics`), duração correta ponta-a-ponta contra dados reais em BD, `UID` idêntico em dois downloads do mesmo token, 404 uniforme para token desconhecido (mesma forma de `NEX-071`).
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhum privilégio novo — mesma leitura pública por posse de token de `NEX-071`.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A — herda a mesma garantia de `resolveBookingByToken`.
- Registar risco residual ou decisão temporária. Mesmo risco residual de rate limit de `NEX-071`/`066` (rota partilha `checkBookingLookupRateLimit`).

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-073 — Implementar abrir localização

**Dependências:** NEX-071

**Objetivo**

Implementar implementar abrir localização sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Link seguro e fallback de morada. `resolveLocationUrl` (`src/lib/open-location.ts`): usa `business_settings.maps_url` quando presente e seguro (`isSafeMapsUrl`, já validado na escrita desde `NEX-031`, revalidado aqui como defesa em profundidade); caso contrário gera uma busca segura do Google Maps (`google.com/maps/search`) a partir da morada em texto (`address_line`/`postal_code`/`locality`, sempre obrigatórios no onboarding). Integrado no cabeçalho da página pública (`src/app/b/[slug]/page.tsx`, botão "Ver no mapa" — antes só aparecia com `maps_url` preenchido, agora aparece sempre que há morada) e na vista de `GET /api/bookings/{token}` (`business.locationUrl`, resolvido server-side).
- Nenhum dado de outro tenant pode ser acedido. Função de domínio pura, sem acesso a dados — opera sobre o que o chamador já resolveu por tenant.
- A interface mantém linguagem simples e fluxo guiado quando houver UI. Um botão único "Ver no mapa"; sem exigir escolha entre link próprio vs. fallback, a decisão é sempre do servidor.
- Logs não contêm segredos nem PII desnecessária. N/A — sem logging.

**Testes obrigatórios**

- URL validation. `tests/unit/maps-url.test.ts` (já existente desde `NEX-031`) cobre `isSafeMapsUrl` exaustivamente. `tests/unit/open-location.test.ts` (novo): prioriza `maps_url` seguro sobre o fallback, cai para o fallback com `maps_url` vazio/`null`/inseguro (incluindo tentativa de URL maliciosa — confirma que nunca aparece no resultado), omite partes de morada ausentes sem deixar buracos na query, e devolve `null` só quando não há absolutamente nenhum dado de localização.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — reaproveita `isSafeMapsUrl` já existente; o fallback constrói a URL só a partir de texto já validado como morada obrigatória no onboarding, com `encodeURIComponent`.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. N/A — função pura.
- Registar risco residual ou decisão temporária. Nenhum risco residual identificado.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-074 — Implementar e-mail opcional

**Dependências:** NEX-071

**Objetivo**

Implementar implementar e-mail opcional sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Adapter, template e retry; booking não depende de entrega.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Mock provider, falha e redaction.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Definition of Done**

- [ ] Implementação concluída
- [ ] Testes concluídos
- [ ] Documentação atualizada
- [ ] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md`
