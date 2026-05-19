#!/usr/bin/env bash
# Usage: ./script/set-grokson-token.sh 'your-discord-bot-token'
set -euo pipefail
TOKEN="${1:-}"
ENV_FILE="${2:-.env}"
if [[ -z "$TOKEN" ]]; then
  echo "Usage: ./script/set-grokson-token.sh YOUR_DISCORD_BOT_TOKEN"
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — run from project root after setup"
  exit 1
fi
if grep -q '^DISCORD_BOT_TOKEN=' "$ENV_FILE"; then
  # macOS sed needs '' for -i; Linux does not
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "s|^DISCORD_BOT_TOKEN=.*|DISCORD_BOT_TOKEN=${TOKEN}|" "$ENV_FILE"
  else
    sed -i '' "s|^DISCORD_BOT_TOKEN=.*|DISCORD_BOT_TOKEN=${TOKEN}|" "$ENV_FILE"
  fi
else
  echo "DISCORD_BOT_TOKEN=${TOKEN}" >> "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"
echo "DISCORD_BOT_TOKEN updated in $ENV_FILE"
