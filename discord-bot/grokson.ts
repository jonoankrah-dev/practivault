/**
 * Grokson — Discord bridge to the same Developer Agent as the in-app chat.
 *
 * Listens only in the channel whose ID is `DEV_AGENT_CHANNEL_ID`, forwards each
 * human message to `POST /api/developer-agent/chat` on your PractiVault server,
 * then posts the JSON `reply` field back to Discord.
 *
 * Required environment variables:
 *   DISCORD_BOT_TOKEN      — Discord application bot token
 *   DEV_AGENT_CHANNEL_ID   — Snowflake ID of the guild text channel (or thread) to monitor
 *   DEV_AGENT_API_BASE     — Origin of the PractiVault API, e.g. https://your-app.up.railway.app
 *                            or http://localhost:3001 (no trailing slash)
 *   DEV_AGENT_BEARER_TOKEN — Valid Supabase access JWT for a user who may call authenticated
 *                            API routes (same as the browser sends as Authorization: Bearer …).
 *
 * Discord Developer Portal: enable **Message Content Intent** for the bot so it can read
 * message text in the dev-agent channel.
 *
 * Run from repository root:
 *   npx tsx discord-bot/grokson.ts
 *   npm run discord:grokson
 */

import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";

/** Max characters per Discord message (leave margin below 2000). */
const DISCORD_CHUNK = 1900;

type DeveloperAgentChatResponse = {
  reply?: string;
  message?: string;
};

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return v;
}

function apiUrl(): string {
  const base = requireEnv("DEV_AGENT_API_BASE").replace(/\/+$/, "");
  return `${base}/api/developer-agent/chat`;
}

function splitChunks(text: string): string[] {
  if (text.length <= DISCORD_CHUNK) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    parts.push(rest.slice(0, DISCORD_CHUNK));
    rest = rest.slice(DISCORD_CHUNK);
  }
  return parts;
}

async function callDeveloperAgent(userContent: string): Promise<string> {
  const token = requireEnv("DEV_AGENT_BEARER_TOKEN");
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: userContent }],
    }),
  });

  const raw = await res.text();
  let data: DeveloperAgentChatResponse = {};
  try {
    data = JSON.parse(raw) as DeveloperAgentChatResponse;
  } catch {
    /* non-JSON error body */
  }

  if (!res.ok) {
    const hint = data.message || raw.slice(0, 400) || res.statusText;
    throw new Error(`Developer Agent API ${res.status}: ${hint}`);
  }

  const reply = data.reply?.trim();
  if (!reply) {
    throw new Error("Developer Agent API returned no reply field.");
  }
  return reply;
}

const discordToken = requireEnv("DISCORD_BOT_TOKEN");
const allowedChannelId = requireEnv("DEV_AGENT_CHANNEL_ID");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Grokson online as ${c.user.tag}`);
  console.log(`Relaying #${allowedChannelId} → ${apiUrl()}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (!client.user) return;
  // Ignore bots (including ourselves if ever echoed).
  if (message.author.bot) return;
  if (message.author.id === client.user.id) return;

  // Only the configured dev-agent channel (guild text, announcement, or thread).
  if (message.channelId !== allowedChannelId) return;

  const text = message.content.trim();
  if (!text) return;

  try {
    if ("sendTyping" in message.channel && typeof message.channel.sendTyping === "function") {
      await message.channel.sendTyping();
    }

    const reply = await callDeveloperAgent(text);
    const chunks = splitChunks(reply);

    await message.reply({
      content: chunks[0]!,
      allowedMentions: { repliedUser: false },
    });
    for (let i = 1; i < chunks.length; i++) {
      await message.channel.send({ content: chunks[i]! });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await message.reply({
      content: `Grokson could not reach the Developer Agent: ${msg.slice(0, 1800)}`,
      allowedMentions: { repliedUser: false },
    });
  }
});

await client.login(discordToken);
