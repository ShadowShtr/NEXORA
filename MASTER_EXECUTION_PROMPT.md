# Prompt de arranque para Claude Code — NEXORA

Abra este repositório e execute o projeto por tarefas, seguindo rigorosamente `CLAUDE.md` e o prompt mestre em `docs/reference/`.

## Objetivo

Construir a primeira versão funcional e segura da NEXORA para uma profissional independente de manicure/pedicure, preservando arquitetura multi-tenant para futuras contas de equipas e salões.

## Método

1. Leia todos os documentos na ordem definida no `README.md`.
2. Faça uma auditoria inicial do repositório e valide se a stack e scripts estão coerentes.
3. Comece pela primeira tarefa pendente (`NEX-002` no estado atual) e siga a ordem de dependências em `TASKS.md`.
4. Para cada tarefa:
   - apresente um plano breve;
   - implemente apenas o escopo da tarefa;
   - escreva/atualize testes;
   - execute verificações;
   - atualize documentação e status;
   - faça commit convencional;
   - declare riscos residuais.
5. Pare quando encontrar uma dependência externa que exija credencial, aprovação jurídica ou decisão de produto não documentada. Registe o bloqueio em `TASKS.md` sem inventar valores.

## Regras fundamentais

- Segurança e privacidade por conceção.
- RLS e autorização server-side obrigatórias.
- Nenhuma dupla reserva, inclusive sob concorrência.
- Valores em cêntimos e datas em UTC.
- Interface extremamente simples, guiada e interativa.
- PWA responsiva para Android, iPhone e desktop.
- WhatsApp por deep link manual, sem API paga.
- E-mail opcional para a cliente.
- Apenas nome e telemóvel são obrigatórios no pré-cadastro.
- Financeiro interno: dinheiro, MB WAY e pendente.
- Não adicionar escopo de equipas à primeira interface.

Comece revendo a evidência de `NEX-001` e executando `NEX-002`.
