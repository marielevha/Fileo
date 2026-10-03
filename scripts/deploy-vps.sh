#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/fileo}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-.env.production}"

cd "$APP_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Fichier $ENV_FILE introuvable. Copiez .env.production.example puis renseignez les secrets." >&2
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

docker compose --env-file "$ENV_FILE" up -d --build
docker compose ps
