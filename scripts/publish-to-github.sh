#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) não está instalada. Instale-a e execute novamente." >&2
  exit 1
fi

gh auth status

if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin já existe: $(git remote get-url origin)"
  git push -u origin main
else
  gh repo create ltd-tech/nexora --private --source=. --remote=origin --push     --description "NEXORA — plataforma SaaS de marcações e gestão"
fi
