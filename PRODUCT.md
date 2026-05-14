# PractiVault — Product Overview (White-Label Edition)

## Positioning

- **Product name:** PractiVault (White-Label Edition)  
- **Tagline:** The premium all-in-one operating system for aesthetic clinics.  
- **Vision:** A modern, fully white-label clinic management platform any aesthetic clinic can rebrand as its own and use to run the business professionally.

### Target market

- Aesthetic / medspa clinics; laser, body contouring, skin tightening, injectable clinics.  
- UK and international (multi-currency and multi-language are roadmap concerns; wire with explicit locale/currency sources before claiming “ready”).  
- Solo practitioners through multi-location groups.

### Default demo tenant — endoPulse

| Field | Value |
|--------|--------|
| Company | endoPulse |
| Website | https://endopulse.co.uk |
| Focus | Non-invasive laser (skin tightening, fat reduction, collagen stimulation, body contouring) |
| Signature | endoPulse™ machine (980nm + 1470nm) |
| Instagram | https://www.instagram.com/endopulse |
| Facebook | https://www.facebook.com/endopulse.co.uk |
| TikTok | https://www.tiktok.com/@endopulse |

**In-app:** Defaults are codified in `client/src/lib/demoBranding.ts`. Settings → “Apply endoPulse demo links” writes them to `business_info`. The shell footer uses those URLs until the tenant saves their own social/website row (any field populated switches the footer off demo fallbacks).

---

## Competitive framing (2026)

| Competitor | PractiVault angle |
|-------------|-------------------|
| Per-user platforms | Deeper aesthetics workflows (consent, before/after, protocols), stronger white-label, premium UI tuned for clinics. |
| **Faces Consent** | Full clinic OS, not consent-only; white-label; Saffi + OurPai.ai agent layer. |
| **ServiceTitan** | Lighter, more affordable, aesthetics-first UX vs enterprise trades tooling. |

**Summary:** Premium, white-label, aesthetics-specific middle ground: more complete than consent-only tools, more beautiful and focused than generic field service, more approachable than enterprise suites.

---

## White-label (product requirements)

- [x] Sidebar business name + default demo name (`endoPulse`) when no tenant name is set.  
- [x] Optional **hide “Powered by PractiVault”** (`users.hide_powered_by`) — Settings → White-label; requires Supabase migration `20260514200000_users_hide_powered_by.sql`.  
- [ ] Full dynamic theme from DB (today: industry packs + CSS variables).  
- [ ] Onboarding wizard (logo, colours, services, team) as a single guided flow.  
- [ ] Client-facing surfaces (booking, consent, portal, PDFs) 100% tenant-branded.  
- [ ] Custom domains (e.g. `book.yourclinic.com`).  
- [ ] Tiered reseller plans (Starter / Pro / Enterprise).

---

## Core modules (roadmap vs shipped)

| Area | Direction |
|------|-----------|
| **Dashboard** | Live KPIs, bookings, chart; activity feed TBD. |
| **Clients** | CRM list + add/edit/delete; profile route `/clients/:id` (overview, bookings, timeline); photos/consent deep links TBD. |
| **Bookings** | Full calendar + public booking page TBD (currently Saffi-forward in UI). |
| **Consent & forms** | Module present; flagship flows and comparisons TBD. |
| **Photos** | Module present; side-by-side compare TBD. |
| **Saffi** | Section tools, memory, voice; Clients embed with live table snapshot. |
| **Marketing** | Social Studio, WhatsApp, leads — mix of UI and Saffi-forward. |
| **Finance / ops** | Invoices, team, stock, manuals, packages, CPD — iterate toward “complete OS”. |

---

## Technical stack

- **Frontend:** React + Vite, TanStack Query, Tailwind, shadcn-style UI.  
- **Backend:** Node (Express), Supabase (auth + RLS + Postgres).  
- **Agent:** Saffi (OurPai.ai / xAI per environment); voice via realtime bridge where configured.

---

## Operational notes

1. Run new SQL migrations in Supabase (including `hide_powered_by`) before toggling white-label in production.  
2. After changing social links in Settings, the footer refetches `/api/business-info`.  
3. “Powered by PractiVault” is a trust line for the platform; hiding it is a deliberate commercial/reseller choice.
