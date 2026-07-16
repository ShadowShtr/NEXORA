# 10 — Registo de riscos

| ID  | Risco                                     | Prob. | Impacto | Mitigação                                                  | Residual    | Owner        |
| --- | ----------------------------------------- | ----- | ------- | ---------------------------------------------------------- | ----------- | ------------ |
| R1  | Dupla reserva                             | M     | Alto    | constraint + transação + teste concorrente                 | Baixo       | Backend      |
| R2  | Acesso cruzado entre tenants              | B/M   | Crítico | RLS + testes negativos + reviews                           | Baixo       | Security     |
| R3  | Configuração difícil para a dona          | M     | Alto    | wizard, defaults, testes de usabilidade                    | Médio       | Product      |
| R4  | Número incorreto de WhatsApp              | M     | Médio   | confirmação visual, edição pela dona, fallback de contacto | Médio       | Product      |
| R5  | Lembrete manual não enviado               | M     | Médio   | lista pendente, badge e overdue                            | Médio       | Product      |
| R6  | Custos de infraestrutura crescem          | M     | Médio   | budgets, métricas unitárias, limites                       | Baixo/Médio | Platform     |
| R7  | Fotografias aumentam risco de privacidade | M     | Alto    | bucket privado, minimização, retenção                      | Médio       | Privacy      |
| R8  | Erro em horário de verão                  | M     | Alto    | timezone IANA + testes DST                                 | Baixo       | Backend      |
| R9  | Relatório diverge do financeiro           | B/M   | Alto    | fonte única, testes de reconciliação                       | Baixo       | Backend      |
| R10 | Dependência comprometida                  | B     | Crítico | lockfile, SCA, CodeQL, Dependabot                          | Médio       | DevSecOps    |
| R11 | Uso comercial em plano inadequado         | M     | Médio   | checklist de produção e validação contratual               | Baixo       | Owner        |
| R12 | Base legal/retenção incorreta             | M     | Alto    | validação jurídica antes da produção                       | Médio       | DPO/Jurídico |
