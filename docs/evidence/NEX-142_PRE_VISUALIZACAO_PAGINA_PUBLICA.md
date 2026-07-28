# NEX-142 — Pré-visualização da página pública

## Objetivo

Garantir que a dona consegue ver alterações na sua página pública (`/b/{slug}`)
sem que isso dependa de já estar publicada, e sem publicar acidentalmente
nada — "mudanças visuais sem publicar acidentalmente" (critério de aceite).

## O que já existia

A página **Aparência** (`/dashboard/definicoes/aparencia`) já tinha um link
"Ver como a cliente vê" apontando para `/b/{slug}`, aberto numa nova aba. O que
faltava era o link funcionar corretamente **antes** de a dona publicar o
negócio.

## Lacuna encontrada

`/b/[slug]/page.tsx` carrega quase tudo através das políticas RLS
autenticadas de cada tabela (`tenants`, `business_settings`, `services`,
`packages`) — que não dependem de `published_at`, só de `tenant_id =
current_tenant_id()`. Isto significa que, ao navegar para a sua própria
página pública já autenticada, a dona **já via** a maior parte do conteúdo
mesmo sem publicar, por efeito colateral da própria RLS, sem qualquer código
dedicado a isso.

A exceção era o **horário** (secção "Aberto agora"/lista semanal), que usa a
função `get_public_business_hours` (`security definer`,
`0030_business_public_profile.sql`, corrigida em `0038` — NEX-166). Essa
função aplica o filtro `tenants.status = 'active' and business_settings
.published_at is not null` **internamente, para qualquer chamador**,
incluindo a própria dona autenticada — por ser `security definer`, ignora RLS
por completo. Resultado: antes de publicar, a dona via a página quase inteira
a funcionar, exceto o horário, que aparecia sempre vazio — uma
pré-visualização incompleta e confusa, sem indicação de que era isso mesmo.

## Correção

1. **`src/lib/auth/require-profile.ts`** — nova função `getOptionalProfile()`,
   irmã de `requireProfile()` mas que devolve `null` em vez de redirecionar
   quando não há sessão ou perfil. Necessária porque `/b/[slug]` é a única
   página pensada para uma visitante sem sessão nenhuma — `requireProfile()`
   redirecionaria erradamente para `/login`.
2. **`src/app/b/[slug]/page.tsx`** — chama `getOptionalProfile()` e compara o
   `tenantId` devolvido com o tenant da própria página. Se coincidir
   (`isOwnerPreview`), lê `business_hours` diretamente da tabela em vez de
   chamar a RPC — a política RLS autenticada (`business_hours_select`,
   `0001_initial.sql`) já garante `tenant_id = current_tenant_id()`,
   funcionando independentemente de `published_at`. Para qualquer outra
   visitante (anónima ou autenticada mas de outro tenant), mantém-se
   exatamente o caminho antigo (a RPC pública).
3. Um aviso claro (`.public-preview-banner`) aparece no topo da página só
   quando `isOwnerPreview && !published_at`: "Pré-visualização — esta página
   ainda não está publicada. As clientes não conseguem vê-la." Nunca aparece
   para uma visitante real.

Nenhuma alteração ao schema, à RPC pública ou às políticas RLS existentes —
só a leitura de horários passou a ter dois caminhos (direto para a dona,
RPC para todos os outros).

## Testes

- **`tests/integration/public-profile-owner-preview.test.ts`** (novo, 3
  testes):
  - a própria dona de um tenant não publicado lê `business_hours`
    diretamente com sucesso;
  - a dona de um **tenant diferente** nunca consegue ler os horários deste
    tenant (confirma que a leitura direta não abriu uma fuga entre tenants);
  - uma visitante anónima continua a receber `[]` da RPC pública para o
    mesmo tenant não publicado (comportamento antigo, inalterado).
- **Verificação visual real** (Playwright, mobile 420×900, tenant
  provisionado de propósito, nunca publicado):
  - a dona autenticada vê o banner de pré-visualização e o horário correto
    ("Aberto hoje · 08:00–20:00"), antes inexistente;
  - uma visitante anónima ao mesmo `slug` continua a ver "Esta página de
    marcações não está disponível." — nenhum dado do negócio é exposto.
- `npm run verify` completo.

## Riscos residuais / fora de escopo

- A pré-visualização cobre a página pública inicial. O fluxo de marcação
  completo (`/b/{slug}/servicos` → `horario` → `dados` → `resumo`) não foi
  estendido com o mesmo tratamento: os passos de serviços/pacotes já
  funcionam para a dona (não dependem de `published_at`), mas uma tentativa
  real de confirmar uma marcação de teste falharia no fim, porque
  `create_public_booking` continua — por desenho, sem alteração aqui — a
  exigir que o negócio esteja publicado. Não é um requisito desta tarefa
  (o critério de aceite fala da "página pública", não do fluxo de reserva) e
  fica registado caso surja como pedido futuro.
- Não foi adicionado nenhum link de pré-visualização novo — o link "Ver como
  a cliente vê" (Aparência) já existia; esta tarefa corrigiu-o para
  funcionar de facto antes de publicar. Considerou-se adicionar o mesmo link
  à página Agenda de Definições, mas essa página só gere bloqueios/exceções
  pontuais, não os horários semanais em si (editados apenas no onboarding),
  por isso não haveria o mesmo ganho direto — descartado por
  desproporcional.

## Próxima tarefa desbloqueada

Nenhuma dependência direta de outra tarefa em `TASKS.md` (NEX-142 não é
pré-requisito de nada listado).
