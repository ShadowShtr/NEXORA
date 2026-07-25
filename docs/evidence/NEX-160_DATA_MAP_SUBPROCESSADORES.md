# NEX-160 — Data map e subprocessadores

## Implementação

- **`docs/DATA_MAP.md`** (novo) — cobre os quatro pontos pedidos: fluxos de dados
  pessoais (7, do formulário público até GitHub/CI), tabela de subprocessadores
  (região, dados envolvidos, estado real), transferências internacionais, DPA e
  owners.
- **`docs/05_SECURITY_PRIVACY.md`** atualizado: a secção "Subprocessadores" (antes uma
  lista genérica de 5 nomes sem detalhe) passa a remeter para `docs/DATA_MAP.md` com
  um resumo de uma linha por subprocessador.
- **Verificação real, não só leitura de documentação**: em vez de assumir a região da
  Vercel, corri `vercel inspect` (CLI já autenticado nesta máquina) contra o último
  deployment de produção — confirmou `iad1` (Washington D.C., EUA) em todas as funções
  serverless, sem `vercel.json` a fixar outra região. Para o Supabase, sem acesso ao
  dashboard nesta sessão (CLI não autenticado, `supabase projects list` devolveu
  `Unauthorized`), perguntei diretamente à dona — confirmou UE.
- **Achado real**: a combinação destas duas confirmações revela que a base de dados
  (Supabase) está na UE mas as funções que a servem correm nos EUA — uma transferência
  internacional de dados pessoais que não estava documentada nem tinha sido avaliada
  antes desta tarefa. Ver `docs/DATA_MAP.md` §"Regiões e transferências
  internacionais".
- **Distinção "ativo" vs. "schema pronto"**: `docs/ENVIRONMENTS_AND_SECRETS.md` já
  registava que Resend/Upstash/Turnstile têm integração de código pronta mas sem conta
  real provisionada — o data map preserva essa distinção em vez de listar os três como
  subprocessadores "ativos" que já recebem dados (não recebem, ainda).

## Testes

- **"Revisão privacy"** (teste obrigatório desta tarefa) — seção dedicada em
  `docs/DATA_MAP.md` confirmando: (1) nenhum subprocessador recebe mais dados do que o
  necessário ao seu papel; (2) os três subprocessadores dormentes não recebem tráfego
  real, consistente com o que as tarefas que os introduziram (`NEX-066`/`NEX-074`) já
  garantiam por desenho (degradação graciosa sem credenciais); (3) o que fica por
  validar (adequação jurídica da transferência EUA/UE, prazos de retenção) exige
  profissional jurídico competente, não código.
- `npm run verify` (format, lint, typecheck, 439 testes, build, budget) — ✅ (tarefa
  puramente documental, sem alteração de código de produção).

## Resultado

Existe agora um mapa de dados único e verificado (não assumido) cobrindo fluxos,
regiões, DPA e owners — o que `05_SECURITY_PRIVACY.md` já pedia "antes de produção"
mas nunca tinha sido preenchido com factos reais. O achado da transferência EUA/UE é o
resultado mais importante desta tarefa.

## Riscos residuais

- Transferência internacional Supabase (UE) → Vercel (EUA) não avaliada juridicamente
  — o risco mais significativo encontrado; requer decisão da dona (fixar região da
  Vercel na UE, avaliar SCCs, ou aceitar o risco conscientemente) e/ou validação
  jurídica.
- Região exata (cidade) do Supabase não confirmada por verificação direta minha —
  só pela confirmação da dona de que é UE.
- Regiões de Resend/Upstash/Turnstile por confirmar quando forem provisionados.
- Nenhum DPA individual assinado — ação pendente da dona em cada dashboard.

## Próxima tarefa desbloqueada

NEX-161 — Retenção e limpeza de drafts (depende de NEX-052, já concluída).
