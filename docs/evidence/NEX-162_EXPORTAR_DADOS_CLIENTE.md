# NEX-162 — Exportar dados da cliente

## Implementação

- **`src/features/clients/domain/export.ts`** (novo) — `buildClientExport()`, função
  pura que transforma as linhas cruas da BD (marcações com itens/pagamentos aninhados,
  fotografias) numa exportação limpa e estruturada. Deliberadamente minimizada: nunca
  inclui `id`/`tenant_id`/`storage_path`/URLs assinadas — só o que descreve a própria
  cliente e o seu histórico (nome, contacto, preferências, observações privadas,
  marcações com serviços/valor/pagamento, e fotografias reduzidas a tipo + data).
- **`src/app/api/clientes/[id]/export/route.ts`** (novo) — rota `GET`, mesmo desenho de
  `/api/financeiro/export` (`NEX-132`): `<a href>` simples, sem JS necessário.
  `requireProfile()` fornece o `tenant_id` só a partir da sessão; toda query filtra por
  ele — um `id` de cliente de outra tenant devolve 404 (mesmo comportamento da própria
  página da ficha da cliente), nunca os dados.
- **Botão "Exportar dados desta cliente"** adicionado ao cartão de Contacto da ficha da
  cliente (`src/app/(dashboard)/dashboard/clientes/[id]/page.tsx`) — `<a>` com as
  classes `.button .button-secondary` já existentes, sem CSS novo.
- Ficheiro devolvido como JSON descarregável (`Content-Disposition: attachment`,
  `Cache-Control: no-store`) — formato "estruturado, de uso comum, legível por
  máquina", a mesma linguagem do direito de portabilidade que
  `docs/05_SECURITY_PRIVACY.md` já listava como backlog.

## Testes

- `tests/unit/client-export.test.ts` (novo, 5 casos) — testa `buildClientExport()`
  diretamente: usa `final_total_cents` quando a marcação está fechada, cai para
  `expected_total_cents` quando não está, lista todos os serviços de uma marcação com
  vários itens, e reduz uma fotografia só a tipo+data.
- `tests/e2e/client-export.spec.ts` (novo) — cobre o teste obrigatório desta tarefa
  ("Authorization/privacy"): pedido sem sessão é redirecionado para `/login`; outra
  tenant a tentar exportar esta cliente recebe `404`; a tenant dona recebe `200` com o
  JSON minimizado (confirma ausência de `id`/`tenant_id` no corpo); e que o botão na
  ficha da cliente aponta para o URL correto.
- **Nota**: tal como os restantes specs E2E deste repositório, não corre no CI atual
  (sem job de Playwright configurado) — mesma limitação pré-existente.
- `npm run verify` (format, lint, typecheck, 446 testes, build, budget) — ✅.

## Resultado

A dona consegue agora descarregar os dados de uma cliente específica num único
ficheiro estruturado — o que faltava para responder a um pedido de acesso/
portabilidade RGPD, já listado como backlog em `05_SECURITY_PRIVACY.md` §Direitos.

## Riscos residuais

- Fotografias exportadas só como metadados (tipo + data), não os ficheiros de imagem
  em si — decisão deliberada (binário não cabe bem num JSON, URLs assinadas expiram).
  As fotos continuam acessíveis na própria ficha da cliente.
- Não valida juridicamente se este formato/conteúdo satisfaz por completo uma
  obrigação de portabilidade real — como o resto de `05_SECURITY_PRIVACY.md`, isto é
  documentação técnica, não aconselhamento jurídico.

## Próxima tarefa desbloqueada

NEX-163 — Apagar/anonimizar cliente (depende de NEX-091/NEX-094, ambas já concluídas).
