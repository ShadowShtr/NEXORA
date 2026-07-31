# CLAUDE.md — Regras de execução da NEXORA

## Missão

Você é o agente técnico principal responsável por implementar a NEXORA com qualidade de produção. O objetivo imediato é entregar a primeira vertical para uma profissional independente de manicure/pedicure, sem comprometer a base multi-tenant que atenderá profissionais, equipas e salões no futuro.

O documento `docs/reference/PROMPT_MESTRE_ARQUITETO_SAAS_CYBERSEGURANCA_PRIVACIDADE.md` é a norma de engenharia deste repositório. Em caso de conflito:

1. segurança, privacidade e integridade de dados;
2. requisitos confirmados em `docs/01_PRODUCT_REQUIREMENTS.md`;
3. decisões aceites nos ADRs;
4. simplicidade operacional e UX;
5. preferências de implementação.

## Forma obrigatória de trabalho

### Antes de codificar

1. Leia `TASKS.md` e identifique a primeira tarefa não concluída cujas dependências estejam concluídas.
2. Abra o épico correspondente em `tasks/epics/`.
3. Leia os documentos de produto, arquitetura, dados e segurança relacionados.
4. Confirme a documentação oficial atual das tecnologias afetadas.
5. Liste pressupostos e riscos da tarefa no seu plano.
6. Trabalhe em uma tarefa por vez. Não expanda o escopo silenciosamente.

### Durante a implementação

- Use TypeScript estrito; não use `any` sem justificação documentada.
- Separe domínio, aplicação, infraestrutura e interface quando isso reduzir acoplamento.
- Valide toda entrada não confiável com schemas Zod no limite da aplicação.
- Autorize no servidor; a UI nunca é um controlo de segurança.
- Derive `tenant_id` da sessão autenticada, nunca de input livre do cliente.
- Use transações e constraints para invariantes de agenda e financeiro.
- Toda função `security definer` não destinada à API pública deve revogar `EXECUTE` explicitamente de `public`, `anon` **e** `authenticated` — este projeto concede `EXECUTE` a `anon`/`authenticated` por omissão em novas funções do schema `public`, e `revoke ... from public` sozinho não remove essas concessões diretas (`ADR-008`). Cobrir com teste de integração que confirme `42501` para esses roles.
- Toda mutação direta no cliente Supabase (`.update()`/`.delete()` fora de uma RPC `security definer`) que altere um recurso identificado por `id` deve encadear `.select()` e verificar linhas afetadas com `hasAffectedRows` (`src/lib/write-confirmation.ts`) antes de devolver sucesso — sob RLS, um `id` inválido ou de outro tenant devolve `error: null, data: []`, não um erro (`ADR-010`). Mutações que já passam por uma RPC (`select ... for update` + `raise exception`) já têm esta garantia ao nível da transação e não precisam do helper.
- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` ao browser.
- Nunca registe passwords, tokens, links secretos completos ou dados pessoais desnecessários.
- Não implemente rate limit em memória para produção serverless.
- Não use datas locais ambíguas; armazene UTC e apresente em `Europe/Lisbon`.
- Valores monetários são inteiros em cêntimos; nunca use float.
- Phone numbers devem ser normalizados para E.164 antes da persistência.
- Links públicos de marcação devem usar tokens aleatórios, armazenados apenas como hash.
- A criação de marcações deve ser atómica e protegida contra dupla reserva.
- Acessibilidade WCAG 2.2 AA é requisito, não melhoria opcional.
- Toda ação destrutiva exige confirmação e comportamento idempotente quando aplicável.

### Qualidade visual

- Claymorphism moderno, rosa médio, rosa muito claro e branco.
- Feminino e premium, nunca infantil.
- Botões grandes, linguagem direta, uma decisão importante por ecrã.
- Defaults inteligentes e configuração guiada para a dona.
- Responsivo mobile-first; desktop deve ampliar, não duplicar a experiência.
- Não sacrificar contraste, foco visível ou legibilidade em nome do estilo.

## Agenda móvel — fidelidade obrigatória

A página de agenda não pode expandir uma marcação para exibir o formulário de
conclusão. O cartão deve permanecer compacto.

Ao tocar na ação de conclusão, abrir um bottom sheet separado contendo valor,
forma de pagamento, opções adicionais e botão de confirmação.

A linha temporal deve continuar visível por trás do overlay.

O cartão normal deve ter aproximadamente 112 px de altura. O estado selecionado
pode mudar fundo, borda e ação, mas nunca deve aumentar significativamente de
altura.

A implementação deve seguir a referência oficial da agenda para:

- posição do título;
- espaçamento;
- seletor Dia/Semana/Lista;
- aviso de horários livres;
- linha vertical;
- horários;
- cartões;
- botões WhatsApp e conclusão;
- botão flutuante;
- navegação inferior;
- cores, sombras e border-radius.

Não criar uma interpretação alternativa.

## Aba Clientes — fidelidade obrigatória

A aba Clientes deve seguir a referência visual premium e não pode ser reduzida a
uma lista simples de nome e telefone.

Cada item de cliente deve apresentar, no mínimo:

- avatar;
- nome;
- telefone;
- informação temporal;
- total gasto;
- seta para abrir detalhes.

A página deve conter:

- cabeçalho com logo e notificações;
- título principal;
- barra de pesquisa compacta;
- chips de filtro;
- cartões premium;
- botão flutuante;
- navegação inferior.

É proibido utilizar um bloco de pesquisa grande e pobre visualmente. A pesquisa
deve ser compacta e elegante.

Não simplificar os cartões.

Todo dado apresentado num cartão de cliente (avatar, histórico, total gasto,
contadores dos chips) tem de vir de dados reais do tenant. Nunca inventar avatar
com foto (usar iniciais), nem criar um destino de "nova cliente" que não existe —
reutilizar o fluxo real de criação (nova marcação) em vez de fabricar um novo.

## Aba Serviços — regras obrigatórias

A página principal de Serviços deve ser uma lista visual e compacta.

É proibido mostrar os formulários completos de:

- categorias;
- serviços;
- fotografias;
- pacotes;

diretamente dentro da lista principal.

A página principal deve conter:

- título;
- botão Novo serviço;
- pesquisa;
- filtro;
- chips de categoria;
- lista de cartões;
- toggle de atividade;
- acesso a edição;
- botão flutuante;
- navegação inferior.

Cada serviço deve mostrar:

- imagem ou ilustração;
- nome;
- duração;
- categoria;
- preço;
- estado ativo;
- seta de detalhes.

A gestão completa deve abrir em modal, bottom sheet ou página secundária.

## Página Mais — regras obrigatórias

A opção Mais deve abrir uma página própria e nunca um painel sobre a página
anterior.

Ao abrir Mais:

- a página anterior deve desaparecer;
- o item Mais deve ficar ativo na navegação inferior;
- o botão flutuante deve ser ocultado;
- a página deve possuir título, perfil, secções e itens navegáveis.

A página deve conter:

- cartão da profissional;
- secção Gestão;
- secção Definições;
- secção Suporte;
- botão discreto de terminar sessão;
- versão da aplicação.

Não usar menu solto, drawer sem cabeçalho ou painel branco sem estrutura.

Cada item de menu (Lembretes, Financeiro, Relatórios, Definições, etc.) tem de
apontar para uma página real e existente. Não inventar sub-páginas de Definições
(ex.: "Aparência", "Segurança" como destinos separados) enquanto essas telas não
existirem de facto — agrupar sob a página de Definições real até serem construídas.
Não inventar uma secção de Suporte/Ajuda sem um destino real (centro de ajuda,
formulário de feedback ou contacto) por trás.

## Página Início — regras obrigatórias

A página Início deve funcionar como um painel operacional rápido.

Ao abrir a página, a utilizadora deve perceber imediatamente:

- próxima cliente;
- marcações de hoje;
- valor faturado;
- pagamentos pendentes;
- lembretes que precisam de atenção.

É obrigatório:

- respeitar safe area;
- usar espaçamento vertical compacto;
- manter o cartão da próxima cliente como elemento principal;
- reduzir o estado vazio;
- usar cartões compactos para o resumo;
- mostrar ações reais nos lembretes;
- incluir preview da agenda do dia;
- não usar formulários na página;
- não mostrar botão flutuante quando existirem atalhos rápidos.

A página deve parecer uma central de controlo simples, não um relatório extenso.

Cada item de "Precisa da sua atenção" e da agenda do dia tem de vir de dados reais do
tenant. Não inventar tipos de alerta sem uma fonte de dados real (ex.: "conflitos na
agenda" não existe como estado consultável — a duplicação de horários já é impedida ao
nível da base de dados — e "clientes que faltaram" não tem fluxo de acompanhamento
próprio ainda). Não criar um terceiro/quarto atalho rápido sem um destino real (ex.:
"novo cliente" reutiliza o fluxo de nova marcação, não fabricar um destino próprio).

### Testes obrigatórios por tarefa

Conforme o escopo, implemente:

- testes unitários de domínio;
- integração com base local;
- testes negativos de autorização e RLS;
- E2E para fluxos críticos;
- acessibilidade automatizada;
- concorrência para criação de marcações;
- regressão de timezone e horário de verão;
- exportação e reconciliação financeira.

### Encerramento da tarefa

1. Execute `npm run verify`.
2. Execute os testes adicionais exigidos pelo épico.
3. Atualize documentação, ADR e migrações quando aplicável.
4. Marque a tarefa como concluída em `TASKS.md` somente após todos os critérios passarem.
5. Registe no commit: `feat|fix|chore|docs|test(scope): resumo`.
6. Informe: alterações, testes, riscos residuais e próxima tarefa desbloqueada.

## Proibições

- Não alterar requisitos aprovados sem ADR.
- Não criar microsserviços para o MVP.
- Não introduzir Redis, filas ou serviços externos sem necessidade demonstrada.
- Não criar cadastro público da dona na primeira versão.
- Não automatizar WhatsApp com API paga nesta versão.
- Não emitir faturas fiscais; o financeiro é controlo interno.
- Não guardar rascunhos abandonados indefinidamente.
- Não usar dados reais de produção em testes.
- Não desativar RLS para “resolver” problemas.

## Fluxo de branches e commits

- Branch por tarefa: `task/NEX-###-descricao-curta`.
- Pull request pequeno e revisável.
- Um PR pode incluir subtarefas inseparáveis, mas deve referenciar IDs explícitos.
- Não fazer push direto em `main` após a configuração da proteção de branch.

## Definição de pronto

Uma tarefa está pronta apenas quando:

- critérios de aceite passam;
- testes passam;
- lint, types e build passam;
- autorização/RLS foram testadas quando aplicável;
- logs não expõem PII indevida;
- documentação foi atualizada;
- riscos residuais foram declarados;
- não existem vulnerabilidades bloqueantes conhecidas.
