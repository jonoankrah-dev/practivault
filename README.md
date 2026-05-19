# PractiVault

**Multi-tenant business platform with industry-aware theming**

PractiVault is a full-featured SaaS platform that helps businesses manage leads, quotes, invoices, bookings, AI front desk, phone reception, social studio, and more — all with customizable branding per industry.

## ✨ Key Features

- 🏢 **Industry Theming** — Custom sidebar colors, navigation, and branding per industry
- 📋 **Leads & Pipeline Management**
- 💰 **Quotes, Invoices & Payments**
- 📅 **Bookings & Scheduling**
- 🤖 **AI Front Desk & Phone Receptionist**
- 📱 **Social Studio**
- 🧑‍💼 **Team Management & Client Portal**
- 🛠 **Setup Assistant** for new users
- 🔒 **Secure Supabase authentication**

## 🛠 Tech Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + Wouter
- **Backend**: Node.js + TypeScript
- **Database**: Supabase + Drizzle ORM
- **Deployment**: Railway + Vercel

## 📁 Project Structure

- `client/` — React frontend
- `server/` — Node.js backend (`routes.ts` holds most HTTP APIs; `server/routes/` has small route modules only)
- `shared/` — Shared Zod schemas and TypeScript types
- `supabase/migrations/` — Postgres migrations (source of truth for schema)

## 🚀 Getting Started

```bash
npm install
npm run dev
