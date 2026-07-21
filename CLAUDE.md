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
- Não adicionar equipas/comissões à interface da primeira vertical.
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
