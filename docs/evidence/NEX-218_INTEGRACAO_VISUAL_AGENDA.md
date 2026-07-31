# NEX-218 — Integração visual na Agenda

## O que foi feito

`src/app/(dashboard)/dashboard/agenda/page.tsx`:

- **Filtros horizontais** Todos / Eu / cada prestador / cada recurso, reaproveitando
  `.filter-chip` (mesmo estilo já usado em Clientes). "Eu" só aparece se o utilizador
  autenticado for também prestador (`service_providers.member_user_id`). O filtro vive
  na própria URL (`?filterKind=me|provider|resource&filterId=...`), preservado ao
  navegar entre Dia/Semana/Lista e ao mudar de data — mesma filosofia já usada para
  `?view=`/`?date=` (server-rendered, sem estado de cliente).
- **Cor do prestador como faixa lateral de 4px**: `AppointmentCardData` ganhou
  `providerColor`; `AppointmentCard.tsx` aplica `border-left: 4px solid` via uma
  variável CSS (`--provider-stripe-color`) só quando existe cor — nunca como fundo,
  conforme o critério explícito ("nunca usar fundo saturado completo").
- **Indicador por quantidade na vista de Lista** ("Mês" no plano mestre): cada grupo de
  dia mostra agora uma badge pequena com o número de marcações desse dia, ao lado da
  data.

## Decisão de arquitetura: não existe uma vista de calendário em grelha

O plano mestre descreve a vista "Mês" como uma grelha de calendário (dias em células,
cada uma com um indicador por quantidade). Este código não tem — nunca teve — essa
grelha: a terceira vista chama-se "Lista" na interface e é uma lista cronológica
agrupada por dia (`view=month` no código, um nome herdado que já não corresponde à
label visível). Construir uma grelha de calendário do zero seria uma mudança de UX
muito maior do que "integração visual" sugere, e arriscaria regressão nos testes E2E
já existentes desta página (`agenda-free-slots.spec.ts`, os specs do wizard de
marcação manual). Decisão: aplicar o "indicador por quantidade" à estrutura de lista
já existente (badge por grupo de dia) em vez de inventar uma grelha só para justificar
literalmente a palavra "mês" — os critérios de aceite reais (indicador por
quantidade, filtro de prestador, não listar dezenas de nomes) ficam satisfeitos sem
essa reconstrução.

## Verificação

- `npm run verify` completo: format, lint, typecheck, 635 testes (224 skipped),
  `next build` (rota `/dashboard/agenda` compilada), bundle budget — tudo verde, sem
  regressão nos testes já existentes da agenda.
- Verificação visual real das vistas Dia/Semana/Lista com filtro de prestador ativo
  não foi possível neste ambiente sandboxed (mesma limitação de NEX-217: sem
  Docker/BD local com as migrações 0039–0043 aplicadas, e o Supabase de
  `.env.local` é o projeto partilhado dev/prod da NEXORA). Confirmado em alternativa,
  sem sessão: `GET /dashboard/agenda` e `GET /dashboard/agenda?view=month&filterKind=
provider&filterId=...` devolvem `307` para `/login` sem nenhum erro no log do
  servidor — a página compila e o novo código de filtro corre sem exceções no
  primeiro passo, mas isto não substitui a verificação visual pedida no épico.

## Estado

`[~]` parcial — filtros, faixa de cor e indicador por quantidade implementados e
com `npm run verify` verde; verificação visual real das 3 vistas com filtro ativo
fica como risco residual documentado (mesma causa raiz de NEX-217).
