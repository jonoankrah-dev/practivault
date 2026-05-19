#!/usr/bin/env bash
# Push variables from .env to a Railway service (requires RAILWAY_TOKEN).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — create it from .env.example first." >&2
  exit 1
fi

if [[ -z "${RAILWAY_TOKEN:-}" ]]; then
  echo "Set RAILWAY_TOKEN (Project Settings → Tokens on railway.app)." >&2
  exit 1
fi

if ! command -v railway >/dev/null 2>&1; then
  echo "Install Railway CLI: npm install -g @railway/cli" >&2
  exit 1
fi

VARS=(
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  XAI_API_KEY
  DEV_AGENT_INTERNAL_SECRET
  RESEND_API_KEY
)

echo "Syncing env vars to Railway from $ENV_FILE ..."
for key in "${VARS[@]}"; do
  value="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//' || true)"
  if [[ -n "$value" ]]; then
    railway variables set "${key}=${value}" --skip-deploys
    echo "  set $key"
  fi
done

echo "Done. Redeploy from the Railway dashboard or: railway up"
