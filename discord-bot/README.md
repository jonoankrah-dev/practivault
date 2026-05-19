# Grokson — Discord bridge to the Developer Agent

Grokson forwards messages from one Discord channel to the same **Developer Agent** used in PractiVault (`POST /api/developer-agent/chat`) and posts the reply back.

## 1. Discord setup

1. Open [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → name it (e.g. Grokson).
2. **Bot** → **Reset Token** → copy token → `DISCORD_BOT_TOKEN` in `.env`.
3. Enable **Message Content Intent** (required).
4. **OAuth2 → URL Generator** → scopes: `bot` → permissions: **Send Messages**, **Read Message History**, **View Channels**.
5. Invite the bot to your server.
6. In Discord, enable **Developer Mode** (Settings → Advanced), right-click the text channel → **Copy Channel ID** → `DEV_AGENT_CHANNEL_ID`.

## 2. PractiVault `.env` (server + bot)

Add to `/Users/rebeccaankrah/Desktop/practivault-app/.env`:

```env
# Grokson → Developer Agent (stable auth; no expiring JWT)
DEV_AGENT_INTERNAL_SECRET=your-long-random-secret-at-least-24-chars
DEV_AGENT_BOT_USER_ID=your-supabase-user-uuid

# Grokson process
DISCORD_BOT_TOKEN=your-discord-bot-token
DEV_AGENT_CHANNEL_ID=1234567890123456789
DEV_AGENT_API_BASE=http://127.0.0.1:3001
```

**`DEV_AGENT_BOT_USER_ID`:** Supabase Dashboard → Authentication → Users → copy the UUID of the account Grokson should act as (usually your login).

**`DEV_AGENT_INTERNAL_SECRET`:** Generate once, e.g. `openssl rand -hex 32`. Use the **same** value for the running API server and Grokson.

## 3. Run (two terminals)

**Terminal 1 — app API**

```bash
cd /Users/rebeccaankrah/Desktop/practivault-app
npm run dev
```

**Terminal 2 — Grokson**

```bash
cd /Users/rebeccaankrah/Desktop/practivault-app
npm run discord:grokson
```

You should see: `Grokson online as ...` and `Relaying #channel → http://127.0.0.1:3001/api/developer-agent/chat`.

## 4. Test

Post a message in that Discord channel (not in a thread unless the channel ID is the thread’s ID). Grokson should reply within a few seconds.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `401` / Missing auth token | Set `DEV_AGENT_INTERNAL_SECRET` + `DEV_AGENT_BOT_USER_ID` on server; restart `npm run dev`. |
| `Developer Agent API 500` | Ensure `XAI_API_KEY` or `xai-api-key.txt` exists for Grok. |
| Bot online but no replies | Wrong `DEV_AGENT_CHANNEL_ID`; enable Message Content Intent. |
| `Cannot find module discord.js` | Run `npm install` in project root. |

## Optional: JWT instead of internal secret

Set `DEV_AGENT_BEARER_TOKEN` to a Supabase access JWT (expires ~1h). Not recommended for Discord; use internal secret instead.
