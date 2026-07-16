# 01 — Requisitos do produto NEXORA

## 1. Resumo executivo

NEXORA é a base de uma plataforma SaaS de marcações e gestão para diferentes perfis de negócio. A primeira implementação atende uma única profissional que gere sozinha manicure, pedicure, clientes, agenda, serviços e recebimentos.

A experiência deve reduzir mensagens e trabalho manual, sem transformar a configuração numa ferramenta complexa. A dona deve conseguir configurar o negócio por um wizard curto, operar a agenda diariamente em poucos toques e concluir atendimentos com registo financeiro rápido.

## 2. Utilizadores

### Cliente final

- Não cria conta nem palavra-passe.
- Faz pré-cadastro com nome e telemóvel obrigatórios; e-mail opcional.
- Seleciona serviços e/ou pacotes.
- Escolhe apenas horários realmente disponíveis.
- Recebe link seguro da marcação.

### Dona/profissional

- Conta criada pelo administrador.
- Login com e-mail e palavra-passe.
- Configura negócio por fluxo guiado.
- Gere uma única agenda nesta vertical.
- Conclui atendimento e regista pagamento.

### Administrador da plataforma

- Cria a conta da dona.
- Não faz parte da interface operacional do MVP; capacidades administrativas devem ser mínimas e auditadas.

## 3. Fluxo público de marcação

1. Página curta exibe nome do negócio, morada e contacto.
2. Cliente informa nome, telemóvel e e-mail opcional.
3. Dados permanecem temporários até a confirmação final.
4. Cliente seleciona livremente serviços por checkboxes/bolinhas.
5. Aba separada permite escolher pacote promocional e adicionar extras.
6. Barra fixa mostra quantidade, duração e valor do carrinho.
7. Cliente seleciona uma data.
8. Sistema lista apenas slots disponíveis; ocupados desaparecem.
9. Cliente adiciona observação opcional.
10. Resumo final mostra serviços, data, hora e total estimado.
11. Ao confirmar, a reserva é atómica e o horário deixa de estar disponível.
12. Ecrã final oferece: ver marcação, adicionar ao calendário e abrir localização.

## 4. Serviços e pacotes

### Serviço

- nome;
- categoria;
- preço em cêntimos;
- duração em minutos;
- ativo/inativo.

### Categoria

- personalizável;
- ordenável;
- ocultável;
- serviço pode ser movido entre categorias.

### Pacote

- nome;
- serviços incluídos;
- preço promocional;
- duração calculada automaticamente;
- ativo/inativo.

A cliente pode combinar pacote com extras, sem duplicação de itens já incluídos.

## 5. Disponibilidade

- Horários calculados automaticamente.
- Grelha configurável: 15, 30 ou 60 minutos; padrão 30.
- Intervalo fixo entre clientes: 5, 10, 15 ou 30 minutos; padrão 15.
- Duração é a soma dos itens e não pode ser alterada manualmente.
- Antecedência mínima: 1, 2, 3, 6, 12 ou 24 horas; padrão 3.
- Janela futura: 15, 30, 60, 90 dias ou 6 meses; padrão 60 dias.
- Considera horário de trabalho, almoço, bloqueios, férias, folgas, exceções e marcações.
- Dona pode criar horário especial e marcação fora do horário com aviso.

## 6. Agenda da dona

Visualizações:

- lista do dia;
- semana;
- mês.

Página inicial:

- próxima cliente em destaque;
- cartões de marcações, total previsto, lembretes e pendências;
- lista dos atendimentos do dia em cartões;
- resumo de horários livres com acesso à lista.

Ações rápidas no cartão:

- abrir WhatsApp;
- marcar como concluído.

Cancelar, reagendar e editar ficam nos detalhes.

## 7. Marcações manuais e recorrentes

- Marcação manual exige cadastro completo.
- Busca sugere cliente existente por nome/telemóvel.
- Recorrência: semanal, quinzenal, a cada 3 semanas, mensal ou intervalo personalizado.
- Conflitos apresentam alternativas para escolha manual.
- Alterações: apenas ocorrência, ocorrência e próximas, ou toda a série.

## 8. Lembretes

- Lembrete devido 24 horas antes.
- Sem API paga do WhatsApp.
- Lista de lembretes pendentes na aplicação.
- Botão abre o chat com texto pré-preenchido.
- Dona envia manualmente e marca como enviado.
- Sistema não afirma entrega ou leitura.
- Cliente pode confirmar, cancelar ou reagendar via link dentro das regras já definidas.

## 9. Atendimento e financeiro

Ao concluir:

- janela rápida mostra valor e forma de pagamento;
- métodos: dinheiro, MB WAY ou pendente;
- “Ver mais” permite extras, desconto e observação;
- extra pode ser serviço existente ou ajuste manual;
- desconto pode ser valor fixo ou percentagem, com motivo opcional;
- preços selecionados são base; valor final é ajustável;
- atendimento concluído pode ser reaberto com auditoria.

Financeiro:

- total diário, semanal e mensal;
- dinheiro, MB WAY e pendente;
- descontos e extras;
- número de atendimentos e ticket médio;
- exportação PDF, Excel e CSV por período;
- não inclui despesas nem emissão fiscal.

## 10. Cliente e histórico

Ficha completa:

- dados de contacto;
- primeira, última e próxima marcação;
- histórico de serviços e valores;
- faltas, cancelamentos e reagendamentos;
- forma de pagamento;
- preferências de cores, formatos, técnicas e produtos;
- observações privadas;
- fotografias internas dos trabalhos.

Não existe portefólio público no MVP.

## 11. Configuração guiada

Wizard de cinco etapas:

1. negócio;
2. horários;
3. serviços;
4. regras da agenda com defaults recomendados;
5. publicação do link e QR Code.

Princípios:

- uma decisão principal por ecrã;
- linguagem não técnica;
- defaults seguros e úteis;
- opção “usar recomendações”;
- pré-visualização imediata;
- configurações avançadas escondidas;
- tudo editável depois.

## 12. Link público

- Estrutura inicial: `/b/{slug}`.
- Slug único, validado e normalizado.
- QR Code gerado sem serviço externo.
- Morada fixa em todas as marcações.

## 13. Design

- claymorphism moderno;
- rosa médio e rosa muito claro;
- branco como base;
- texto cinzento-escuro;
- verde para sucesso e vermelho para ações destrutivas;
- ícones lineares, com ícones arredondados nas ações principais;
- títulos arredondados e textos altamente legíveis;
- WCAG 2.2 AA.

## 14. Navegação móvel

Barra inferior:

- Início;
- Agenda;
- Clientes;
- Serviços;
- Mais.

“Mais” contém Financeiro, Relatórios, Definições e Terminar sessão.

## 15. Fora do MVP

- API automática do WhatsApp;
- pagamentos online;
- faturação fiscal;
- despesas;
- equipas e comissões na interface;
- marketplace;
- aplicação nativa nas lojas;
- portefólio público;
- login da cliente;
- domínio próprio por tenant;
- IA.
