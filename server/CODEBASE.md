# PractiVault server — codebase map

Use this when inspecting the repo. **Do not assume** a generic SaaS folder layout.

## HTTP routes

- **Main API surface**: `server/routes.ts` (~5k lines) — bookings, leads, clients, invoices, Saffi, Hermes, developer agent, WhatsApp, etc.
- **Small route modules** (only these exist under `server/routes/`):
  - `publicConfig.ts` — `GET /api/public-config` (Supabase URL + anon key for the browser)
  - `safiMemory.ts` — Saffi memory / agent-action APIs
- There are **no** `server/routes/api.ts`, `bookings.ts`, `leads.ts`, etc. Those paths are **not** missing imports.

## Data layer

- **Production**: Supabase only (`server/supabase.ts`, `supabaseForUser` per request for RLS).
- **Not used**: local SQLite / Drizzle (`server/storage.ts` was removed as dead starter code).

## Auth

- Browser: Supabase Auth JWT → `Authorization: Bearer` on API calls.
- `requireAuth` in `routes.ts` validates token and sets `req.db = supabaseForUser(token)`.

## AI agents

- **Saffi** — in-app assistant (`/api/safi/chat`, Hermes escalation).
- **Hermes** — `server/hermes/` — proposals and guarded writes.
- **Developer agent** — `POST /api/developer-agent/chat` — read-only codebase tools + propose_edit.

## Deploy

- Railway runs `npm run build` then `npm start` → `dist/index.cjs`.
- Supabase URL/anon: env vars, or production fallbacks in `server/config/supabaseEnv.ts`.
