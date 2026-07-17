# Evidência — NEX-033 Passo serviços iniciais

**Data:** 17 de julho de 2026
**Estado:** concluído

## Implementação

- `src/features/onboarding/domain/services-step.ts`: `serviceItemSchema` — nome, preço em euros (string com vírgula ou ponto, convertido para cêntimos), duração (5–720 min), categoria.
- `src/features/onboarding/actions.ts`:
  - `addService`: valida, encontra ou cria a categoria (por nome, `tenant_id`), insere o serviço. Trata violação de unicidade (`23505`) tanto na categoria (corrida concorrente — usa a existente) como no serviço (nome duplicado — mensagem clara em vez de erro cru da BD).
  - `advanceServicesStep`: exige pelo menos 1 serviço antes de avançar o passo.
- `src/features/onboarding/ServicesStep.tsx`: lista dos serviços já adicionados + formulário de "adicionar serviço" que **permanece no ecrã** após cada submissão (criação repetida); Voltar/Seguinte num formulário próprio, Voltar via `formAction` no botão (mesmo padrão de `NEX-032`).
- Ajuste de configuração: `@typescript-eslint/no-unused-vars` ganhou `argsIgnorePattern: '^_'` — `advanceServicesStep` é o primeiro server action com **ambos** os parâmetros (`prevState`, `formData`) não usados no corpo, o que expôs que o prefixo `_` já usado no projeto não tinha efeito real sem esta opção.

## Testes

**Unitários** (`tests/unit/services-step.test.ts`, 7 testes): conversão correta para cêntimos; vírgula e ponto como separador decimal; nome vazio rejeitado; preço negativo/inválido rejeitado; duração fora de 5–720 rejeitada; limites 5 e 720 aceites; categoria vazia rejeitada.

**E2E** (`tests/e2e/onboarding-services-step.spec.ts`, 6 testes, `chromium` + `webkit-mobile`):

1. 0 violações Axe.
2. Avançar sem nenhum serviço → erro claro, permanece no passo 3.
3. **Criação repetida:** dois serviços com categorias diferentes adicionados um a seguir ao outro, ambos aparecem na lista, avança para o passo 4, e **ambos** confirmados persistidos corretamente na BD (nome, preço em cêntimos, duração) — não só na UI.
4. **Duplicado:** adicionar um serviço com o mesmo nome de um já existente → mensagem "Já existe um serviço…", confirmado que a BD continua com 1 só registo (não duplicou nem corrompeu).
5. Categoria repetida (mesmo nome em dois serviços) → reaproveitada, confirmado só 1 linha em `service_categories` com esse nome.
6. "Voltar" volta ao passo 2.

**Nota de infraestrutura de teste (não bug de produto):** ao correr a suite completa (64 testes, 6 workers em paralelo), 2 testes deste ficheiro falharam por não conseguir sequer completar o login (ficou em `/login`, nunca chegou a `/dashboard`) — reexecutados isoladamente, os 6 passaram sempre. Consistente com contenção/rate-limit do Supabase Auth quando muitos testes criam e autenticam utilizadores em simultâneo contra o mesmo projeto cloud (`ADR-007`), não uma falha do código. Risco a monitorizar à medida que a suite E2E cresce.

## Resultado

- `npm run verify`: aprovado.
- 61/64 testes E2E aprovados na corrida completa (1 skip esperado + 2 falhas de infraestrutura, ambos confirmados a passar isoladamente — 6/6). 36 testes unitários no total do projeto.
- Próxima tarefa desbloqueada: `NEX-034`.
