# Prompt de execução visual para Claude Code

Implemente a interface da NEXORA com fidelidade visual pixel-perfect às referências em `docs/references/`.

## Documentos obrigatórios

Leia antes de alterar UI:

1. `CLAUDE.md`;
2. `docs/DESIGN_SYSTEM_PIXEL_PERFECT.md`;
3. `docs/UI_SCREEN_SPECIFICATIONS.md`;
4. `docs/VISUAL_QA_PLAYBOOK.md`;
5. a imagem de referência correspondente.

## Regra de execução

Não implemente todas as páginas de uma vez. Trabalhe na ordem:

1. tokens e fontes;
2. primitives: Button, Input, Card, Badge, Tabs, Modal, BottomNav;
3. layout móvel;
4. dashboard;
5. agenda;
6. detalhes da marcação;
7. fecho rápido e detalhado;
8. clientes e ficha;
9. serviços;
10. financeiro;
11. definições;
12. fluxo público da cliente;
13. tablet e desktop;
14. animações e microinterações;
15. regressão visual completa.

Para cada página:

1. crie fixture visual determinística;
2. implemente;
3. execute lint, typecheck e testes;
4. capture screenshot Playwright em 390×844;
5. compare com referência;
6. corrija até `maxDiffPixelRatio <= 0.01`;
7. valide 430×932 e 1440×1024;
8. documente divergências inevitáveis;
9. faça commit isolado.

## Proibições

- não usar aparência padrão de Material UI, Bootstrap ou shadcn;
- não substituir o design por um dashboard genérico;
- não escolher cores, sombras ou raios fora dos tokens;
- não alterar textos ou composição para facilitar implementação;
- não avançar com screenshots visualmente divergentes;
- não atualizar snapshots sem revisão do diff;
- não usar fontes do sistema;
- não misturar bibliotecas de ícones;
- não criar componentes com alturas instáveis quando a referência pede geometria fixa.

## Critério de conclusão

Uma página só está pronta quando funcionalidade, acessibilidade, responsividade e regressão visual estiverem aprovadas.
