# NEX-050 — Criar página pública por slug

## Contexto

`src/app/b/[slug]/page.tsx` e `PublicBookingCart.tsx` já existiam no repositório, construídos numa sessão anterior **fora do processo formal de tarefas**, a pedido explícito do dono, para uma demonstração rápida com dados fictícios a um cliente (ver `docs/02_UX_FLOWS.md`, secção "Estado da demonstração pública"). Esta tarefa formaliza essa página como a entrega real de `NEX-050`: revista contra os critérios de aceite e coberta por testes automatizados.

## Implementação

- `src/app/b/[slug]/page.tsx` (Server Component, sem `requireProfile()` — página pública, o cliente Supabase corre como `anon` por não haver sessão): busca `tenants` por slug, `business_settings`, `service_categories`, `services`, `packages`, `package_services`, todas via as políticas RLS públicas já existentes desde `NEX-012` (`status='active'`, `published_at is not null`, `is_visible`, `is_active`). `notFound()` do Next.js quando o tenant não existe/não está `active`, ou quando `business_settings` não tem `published_at` (nunca publicado).
- Dados mostrados: nome da profissional, morada completa, telefone (`Marcar por WhatsApp` via `wa.me` com mensagem pré-preenchida, `Ligar agora` via `tel:`), link opcional de mapa. Catálogo completo (categorias → serviços → pacotes) com preço/duração.
- **Não seleciona `business_settings.email`** — decisão de privacidade: o e-mail é mais sensível que o telefone (que já é pensado para contacto público desde o onboarding), não há necessidade demonstrada de o expor publicamente.
- "Booking integrado" (catálogo alimenta a seleção): a seleção interativa (checkboxes) e o carrinho fixo com total (`PublicBookingCart.tsx`) já estão implementados — são o escopo específico de `NEX-053`/`NEX-054`, com testes formais próprios a escrever nessas tarefas.

## Testes

- `tests/e2e/public-business-page.spec.ts` (novo, 5/5 ✅ em `chromium` e `webkit-mobile`, todos através de pedidos anónimos reais — sem cookies de sessão, exercitando a fronteira RLS `anon` na prática):
  - Mostra nome, morada, contacto (WhatsApp/telefone) e catálogo (categoria + serviço com preço/duração) para um tenant publicado — resposta 200.
  - Axe: 0 violações.
  - **`tenants.status='suspended'` → 404.**
  - **Tenant `active` mas nunca publicado (`published_at` nulo) → 404.**
  - Slug completamente desconhecido → 404.
- `npm run verify` — ✅.

## Resultado

`/b/{slug}` está formalmente coberta: um tenant publicado mostra os dados públicos mínimos corretos, e um tenant suspenso, não publicado ou inexistente nunca expõe nada — confirmado por teste automatizado, não só pela política RLS em teoria.

## Riscos residuais

- `PublicBookingCart.tsx` (seleção de serviços/pacotes via checkboxes + carrinho fixo com total) ainda não tem testes formais próprios — código já existe e funciona (validado manualmente durante a demonstração), mas a cobertura automatizada fica para `NEX-053` (seletor) e `NEX-054` (carrinho fixo), que devem também rever se a implementação atual cobre os critérios específicos dessas tarefas (ex.: "extras" em `NEX-053`, ainda não existentes no modelo de dados).

## Próxima tarefa desbloqueada

NEX-051 — Criar pré-cadastro temporário (depende de NEX-050, concluída). Esta é uma peça genuinamente nova — a página pública atual não tem nenhum passo de "nome + telefone" antes de ir para o WhatsApp.
