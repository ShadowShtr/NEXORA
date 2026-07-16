# Publicação e configuração do GitHub

## Publicar

```bash
bash scripts/publish-to-github.sh
```

## Configurar depois da publicação

1. Proteger `main`.
2. Exigir pull request e pelo menos uma aprovação quando houver segundo revisor.
3. Exigir CI e CodeQL.
4. Bloquear force push e deletion.
5. Ativar Dependabot alerts/updates e secret scanning.
6. Configurar environments `preview` e `production` com aprovação para produção.
7. Adicionar secrets apenas nos environments necessários.

## Criar issues a partir das tasks

Primeiro veja o dry run:

```bash
node scripts/create-github-issues.mjs
```

Depois crie:

```bash
node scripts/create-github-issues.mjs --apply
```

Evite executar duas vezes sem verificar issues existentes.
