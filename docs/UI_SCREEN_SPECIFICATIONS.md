# NEXORA — Especificações de Ecrãs

## Regras comuns

Todos os ecrãs móveis usam viewport de referência `390 × 844`, margem horizontal `16px`, fundo `--nx-background` e barra inferior de `64px` quando aplicável.

As alturas descritas são referências iniciais. O resultado final deve ser ajustado por comparação de screenshot.

---

## 01 — Splash / abertura

### Estrutura

- fundo com gradiente primário;
- logótipo central;
- nome NEXORA;
- subtítulo curto;
- sem navegação.

### Medidas

- logótipo: `84 × 84px`;
- nome: `30px/700`, tracking `0.14em`;
- subtítulo: `13px/400`, largura máxima `240px`;
- conteúdo centralizado verticalmente.

### Animação

- logótipo: fade + scale de `0.92` para `1` em `450ms`;
- nome entra `120ms` depois;
- duração máxima antes da navegação: `900ms`.

---

## 02 — Onboarding da dona

### Estrutura

1. cabeçalho com logótipo;
2. título e descrição;
3. indicador `Passo X de 5`;
4. barra de progresso;
5. formulário;
6. botão fixo inferior.

### Medidas

- padding superior: `24px`;
- logótipo: largura `108px`;
- título: `22px/700`;
- formulário começa aproximadamente em `220px` de Y;
- gap entre campos: `12px`;
- botão inferior: `48px` de altura.

### Etapas

1. negócio;
2. horários;
3. serviços;
4. regras da agenda;
5. publicação.

### Interação

- guardar automaticamente a cada etapa;
- voltar sem perda de dados;
- usar recomendações com um toque;
- mostrar preview final.

---

## 03 — Página pública da cliente

### Cabeçalho

- imagem de unhas ou degradê: `190px` de altura;
- raio inferior `28px`;
- cartão do negócio sobreposto com `margin-top: -42px`;
- avatar/logótipo circular `72px`.

### Conteúdo

- nome do negócio `22px/700`;
- especialidade `13px`;
- profissional, morada e telefone em linhas de `20px`;
- botões localização e WhatsApp em cápsula `40px`.

### Pré-cadastro

- título `Comece agora`;
- nome e telemóvel obrigatórios;
- e-mail opcional;
- botão `Continuar`.

---

## 04 — Seleção de serviços

### Cabeçalho

- título `Serviços`;
- pesquisa opcional;
- tabs `Serviços | Pacotes`;
- chips de categorias com scroll horizontal.

### Cartão de serviço

- altura mínima `74px`;
- miniatura `44 × 44px` quando existir;
- nome `14px/600`;
- duração `11px`;
- preço `14px/600`;
- seletor circular `22px`.

### Rodapé fixo

- altura `72px` antes da safe area;
- resumo à esquerda;
- botão `Continuar` à direita;
- blur de fundo.

### Estado selecionado

- fundo rosa muito suave;
- borda rosa;
- check branco em círculo rosa.

---

## 05 — Pacotes

### Cartão premium

- altura aproximada `118px`;
- gradiente rosa;
- badge de desconto;
- preço novo `24px/700`;
- preço anterior riscado;
- check no canto inferior direito.

### Extras

- listagem abaixo dos pacotes;
- não permitir duplicar serviço incluído;
- total e duração atualizados no rodapé.

---

## 06 — Calendário da cliente

### Seletor de data

- mês e ano no topo;
- faixa horizontal de 5–7 dias;
- cartão do dia `52–56px × 64–68px`;
- dia selecionado com borda rosa.

### Horários

- lista vertical;
- cada item `48px` de altura;
- raio `14px`;
- gap `10px`;
- ocupados não são exibidos.

### Estado de carregamento

- 4 skeletons de horários;
- sem layout shift percetível.

---

## 07 — Resumo da marcação

### Blocos

- serviços;
- data e horário;
- profissional;
- observação opcional;
- total estimado.

Cada bloco:

- fundo branco;
- raio `14px`;
- padding `14px`;
- borda clara.

Botão final `Confirmar marcação` fixo próximo do rodapé.

---

## 08 — Confirmação da cliente

### Elemento central

- círculo de sucesso `96px`;
- gradiente rosa;
- check branco `38px`;
- confetes discretos.

### Conteúdo

- título `22px/700`;
- resumo com data, local e valor;
- ações empilhadas:
  - Ver marcação;
  - Adicionar ao calendário;
  - Abrir localização.

---

## 09 — Link seguro da marcação

### Cabeçalho

- seta voltar;
- título `A minha marcação`;
- badge de estado.

### Cartões

- serviços;
- data e hora;
- local;
- valor estimado.

### Ações

Grade de duas colunas:

- confirmar presença;
- reagendar;
- cancelar;
- adicionar ao calendário;
- abrir localização;
- contactar profissional.

Depois do prazo, ocultar reagendamento e cancelamento e mostrar `Contactar profissional`.

---

## 10 — Dashboard da dona

### Header

- saudação;
- dia da semana e data;
- avatar `36px`;
- sino `22px`.

### Próxima cliente

- cartão gradiente;
- altura `108–116px`;
- horário grande à esquerda;
- nome e serviços;
- botão `Abrir marcação`.

### Métricas

Grid `2 × 2`:

- marcações de hoje;
- total previsto;
- lembretes pendentes;
- pagamentos pendentes.

### Agenda resumida

- lista de 3–5 itens;
- link `Ver agenda`;
- botão/indicador de horários livres.

---

## 11 — Agenda do dia

### Header

- título;
- data com setas;
- badge `X horários livres hoje`.

### Cartões

- horário na coluna esquerda;
- cliente e serviços no centro;
- WhatsApp e círculo de conclusão à direita;
- cartão ativo com borda rosa.

### Ação principal

- botão `Nova marcação` acima da barra inferior ou FAB contextual.

---

## 12 — Semana e mês

### Semana

- colunas por dia no desktop/tablet;
- no móvel, scroll horizontal ou seletor de dia;
- blocos de marcação com cor de estado.

### Mês

- pontos/contadores por dia;
- tocar no dia abre lista do dia;
- não tentar mostrar texto completo em cada célula no móvel.

---

## 13 — Detalhes da marcação

### Cabeçalho

- avatar `48px`;
- nome `18px/700`;
- telefone;
- ações WhatsApp e chamada.

### Informações

- serviços e valores;
- data;
- horário;
- local;
- observação;
- resumo da cliente.

### Rodapé

- botão secundário `Editar`;
- botão primário `Fechar atendimento`.

---

## 14 — Fecho rápido

### Modal

- largura `calc(100% - 32px)`;
- máximo `420px`;
- raio `24px`;
- padding `22px`;
- overlay escuro com blur.

### Conteúdo

- valor previsto;
- valor final;
- dinheiro;
- MB WAY;
- pendente;
- botão concluir;
- link `Ver mais opções`.

### Seleção

Cada método de pagamento é um cartão de `54px`.

---

## 15 — Fecho detalhado

### Secções

- extras existentes;
- extra manual;
- desconto;
- observação;
- resumo financeiro;
- valor final.

### Extra manual

- nome;
- valor;
- botão adicionar;
- validar valores negativos e vazios.

### Desconto

- fixo ou percentual;
- motivo opcional;
- preview do desconto em euros.

---

## 16 — Área de clientes

### Header

- título;
- pesquisa `46px`;
- filtro opcional.

### Lista

- avatar `46px`;
- nome;
- telefone;
- próxima marcação ou última visita;
- separadores claros.

### FAB

- `56px`;
- gradiente rosa;
- canto inferior direito acima da navegação.

---

## 17 — Ficha da cliente

### Header

- gradiente rosa;
- avatar `72px`;
- nome;
- telefone;
- ações editar, WhatsApp e menu.

### Tabs

- resumo;
- histórico;
- preferências;
- fotos internas.

### Resumo

- próxima marcação;
- total de atendimentos;
- total gasto;
- cliente desde;
- últimos atendimentos;
- ações rápidas.

---

## 18 — Histórico da cliente

### Lista temporal

- data;
- serviços;
- valor;
- forma de pagamento;
- status;
- observação quando existir.

Agrupar por ano ou mês em históricos longos.

---

## 19 — Serviços

### Header

- título;
- botão `Novo serviço`.

### Categorias

- tabs ou chips horizontais;
- permitir reordenar em modo de edição.

### Serviço

- nome;
- duração;
- categoria;
- preço;
- estado ativo/inativo;
- tap abre edição.

---

## 20 — Criar/editar serviço

### Formulário mínimo

- nome;
- categoria;
- preço;
- duração;
- ativo/inativo.

### UX

- duração com presets;
- preço com teclado numérico;
- guardar e oferecer `Criar outro`.

---

## 21 — Financeiro

### Filtros

- dia;
- semana;
- mês;
- personalizado.

### Total

- valor principal `30px/700`;
- atendimentos no período;
- cards de dinheiro, MB WAY e pendentes.

### Resumo

- descontos;
- extras;
- ticket médio;
- atendimentos concluídos.

### Exportação

- PDF;
- Excel;
- CSV;
- modal de período.

---

## 22 — Pendentes

### Lista

- cliente;
- atendimento;
- data;
- valor;
- dias em atraso;
- botão `Marcar como pago`;
- WhatsApp.

### Marcar como pago

- selecionar dinheiro ou MB WAY;
- confirmar data do recebimento;
- atualizar financeiro e histórico.

---

## 23 — Definições

### Grupos

- Meu negócio;
- Agenda;
- Marcações;
- Lembretes;
- Pagamentos;
- Aparência;
- Dados e segurança.

### Linha

- altura `54px`;
- ícone em bloco `34px`;
- título;
- valor atual opcional;
- chevron.

---

## 24 — Configuração de agenda

### Fluxo guiado

1. selecionar dias;
2. início e fim;
3. almoço;
4. intervalo entre clientes;
5. grelha de horários;
6. preview dos horários gerados.

Mostrar uma decisão principal por ecrã em móvel.

---

## 25 — Bloqueios e férias

### Tipos

- intervalo do dia;
- dia inteiro;
- vários dias;
- repetição semanal;
- férias;
- horário especial.

### Preview

Antes de guardar, mostrar quais horários deixarão de ser públicos.

---

## 26 — Lembretes WhatsApp

### Lista

- cliente;
- data e hora;
- serviços;
- botão `Abrir WhatsApp`;
- checkbox `Marcar como enviado`.

### Mensagem

- texto personalizável;
- preview com variáveis;
- não afirmar que foi entregue.

---

## 27 — Marcação manual

### Etapas

1. procurar ou criar cliente;
2. selecionar serviços/pacote;
3. selecionar data e hora;
4. observação;
5. resumo e guardar.

Sempre validar conflitos no servidor antes de confirmar.

---

## 28 — Marcações recorrentes

### Campos

- frequência;
- data inicial;
- horário;
- quantidade;
- serviços.

### Conflitos

- mostrar ocorrência em conflito;
- apresentar alternativas;
- a dona escolhe;
- não alterar automaticamente.

---

## 29 — Estados de erro

Erros devem aparecer junto ao campo ou ação.

### Tipos

- conflito de agenda;
- cliente duplicada;
- serviço inativo;
- sessão expirada;
- falha de rede;
- exportação falhada.

Mensagem deve explicar o que aconteceu e a ação seguinte.

---

## 30 — Desktop

### Estrutura

- sidebar `240–256px`;
- conteúdo principal;
- cabeçalho superior opcional;
- máximo `1440px`.

### Dashboard

- coluna principal para agenda;
- coluna secundária para métricas, lembretes e pendentes.

### Agenda

- semana visual completa;
- drag and drop apenas se acessível e com alternativa por formulário;
- modais centralizados.
