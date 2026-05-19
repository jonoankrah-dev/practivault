/**
 * PractiVault — Server-side demo seeder
 * Uses service role key to bypass RLS and insert rich demo data for all 9 industries.
 * Run once: node seed-demo.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://flpongjcbipxcewkusof.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY before running: node seed-demo.mjs");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── User IDs ────────────────────────────────────────────────────────────────
const USERS = {
  aesthetics:  "f60e4aaf-c0dc-4389-89b2-0446b2ef5600",
  builder:     "71176dc0-a7d1-46cf-99e0-ba94de07eb3f",
  cpd:         "e78cefc2-e9f5-4ca7-8cdf-46f71ea8c344",
  electrician: "3b038d12-dad9-4032-b610-655b85fcfadc",
  hair:        "cea9ec5f-fe44-4612-b8a4-2510c5afd510",
  health:      "ca160104-dff2-48fe-8a77-1c32bf0a569d",
  joiner:      "a170f8c7-c033-4592-a158-3c62d405c52a",
  landscaper:  "be40543e-f924-4fd6-8204-49c675d4bf53",
  plumber:     "e9b6e2c6-5520-41ba-8b06-3bf91c389fd1",
};

// ── Date helpers ─────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

// ── Industry data ────────────────────────────────────────────────────────────

const INDUSTRIES = {

  // ─────────────── AESTHETICS ───────────────────────────────────────────────
  aesthetics: {
    clients: [
      { name: "Emma Richardson",  email: "emma.r@hotmail.com",   phone: "07722 345678", stage: "vip",      notes: "Regular filler client every 6 months. Loves Juvederm.", ltv: 1260 },
      { name: "Jade Thornton",    email: "jade.t@gmail.com",     phone: "07811 234567", stage: "active",   notes: "Full face botox. Patch test done.", ltv: 840 },
      { name: "Priya Sharma",     email: "priya.s@gmail.com",    phone: "07777 890123", stage: "active",   notes: "Botox + filler combo patient.", ltv: 1540 },
      { name: "Melissa Frost",    email: "mel.frost@outlook.com",phone: "07900 112233", stage: "active",   notes: "Interested in skin boosters next visit.", ltv: 620 },
      { name: "Hannah Clarke",    email: "hannah.c@gmail.com",   phone: "07733 445566", stage: "prospect", notes: "Enquired about lip filler. Consultation booked.", ltv: 0 },
      { name: "Sophie Williams",  email: "sophie.w@gmail.com",   phone: "07755 667788", stage: "active",   notes: "Monthly HydraFacial standing appointment.", ltv: 960 },
      { name: "Chloe Bennett",    email: "chloe.b@yahoo.com",    phone: "07766 998877", stage: "active",   notes: "Microneedling course — 3 of 4 done.", ltv: 480 },
      { name: "Amber Patel",      email: "amber.p@gmail.com",    phone: "07799 334455", stage: "active",   notes: "Chemical peel patient, sensitive skin.", ltv: 340 },
      { name: "Natalie Fox",      email: "natalie.f@hotmail.com",phone: "07811 556677", stage: "active",   notes: "New client — full consultation completed.", ltv: 180 },
      { name: "Rachel Owens",     email: "rachel.o@gmail.com",   phone: "07744 223344", stage: "lapsed",   notes: "Hasn't booked since March. Win-back candidate.", ltv: 720 },
    ],
    bookings: [
      { ci: 0, treatment: "Botox — Full Face",      date: daysAgo(14),    time: "14:00", status: "completed", notes: "Excellent result. Follow-up in 2 weeks." },
      { ci: 1, treatment: "Lip Filler 1ml",         date: daysAgo(7),     time: "11:30", status: "completed", notes: "Client very happy. Review booked." },
      { ci: 5, treatment: "HydraFacial",            date: daysAgo(1),     time: "09:30", status: "completed", notes: "Brightening protocol. Glowing result." },
      { ci: 2, treatment: "Botox — Full Face",      date: daysFromNow(2), time: "10:00", status: "confirmed", notes: "Top-up. 3-month review." },
      { ci: 3, treatment: "Skin Booster (Profhilo)",date: daysFromNow(4), time: "13:00", status: "confirmed", notes: "First treatment in a course of 2." },
      { ci: 6, treatment: "Microneedling",          date: daysFromNow(7), time: "15:00", status: "confirmed", notes: "Session 4 of 4. Final session." },
      { ci: 4, treatment: "Consultation",           date: daysFromNow(3), time: "11:00", status: "confirmed", notes: "Lip filler consultation. Photos required." },
      { ci: 7, treatment: "Chemical Peel",          date: daysFromNow(10),time: "10:30", status: "confirmed", notes: "Sensitive skin — use gentle peel only." },
    ],
    invoices: [
      { ci: 0, desc: "Botox — Full Face",            amount: 350, vat: false, status: "paid",    daysAgo: 14 },
      { ci: 1, desc: "Lip Filler 1ml",               amount: 280, vat: false, status: "paid",    daysAgo: 7  },
      { ci: 5, desc: "HydraFacial",                  amount: 120, vat: false, status: "paid",    daysAgo: 1  },
      { ci: 2, desc: "Botox Full Face — Top Up",     amount: 350, vat: false, status: "draft",   daysAgo: 0  },
      { ci: 6, desc: "Microneedling x4 Course",      amount: 480, vat: false, status: "overdue", daysAgo: 21 },
      { ci: 9, desc: "Botox — Forehead Only",        amount: 180, vat: false, status: "paid",    daysAgo: 30 },
    ],
    quotes: [
      {
        clientName: "Jade Thornton",
        description: "endoPulse Laser x6 Course",
        amount: 2400, status: "sent",
        items: [
          { item: "endoPulse Laser Session", qty: 6, unitPrice: 350 },
          { item: "Consultation & Assessment", qty: 1, unitPrice: 0 },
          { item: "Course Discount (10%)", qty: 1, unitPrice: -150 },
        ],
      },
      {
        clientName: "Melissa Frost",
        description: "Reactivation Package — 3 Skin Treatments",
        amount: 480, status: "accepted",
        items: [
          { item: "HydraFacial", qty: 2, unitPrice: 120 },
          { item: "Chemical Peel", qty: 1, unitPrice: 240 },
        ],
      },
      {
        clientName: "Hannah Clarke",
        description: "Lip Filler + Consultation",
        amount: 300, status: "draft",
        items: [
          { item: "Lip Filler 1ml", qty: 1, unitPrice: 280 },
          { item: "Consultation Fee", qty: 1, unitPrice: 20 },
        ],
      },
    ],
  },

  // ─────────────── HAIR ─────────────────────────────────────────────────────
  hair: {
    clients: [
      { name: "Rachel Green",     email: "rachel.g@gmail.com",   phone: "07711 100200", stage: "vip",      notes: "Monthly colour. Always books 8am Saturdays.", ltv: 1980 },
      { name: "Sophie Turner",    email: "sophie.t@gmail.com",   phone: "07722 200300", stage: "active",   notes: "Highlights & balayage. Allergic to ammonia.", ltv: 860 },
      { name: "Olivia Mason",     email: "olivia.m@gmail.com",   phone: "07744 400500", stage: "active",   notes: "Keratin treatment. First time client.", ltv: 180 },
      { name: "Isla Ferguson",    email: "isla.f@hotmail.com",   phone: "07755 500600", stage: "active",   notes: "Bridal party of 6. Wedding 15 May.", ltv: 680 },
      { name: "Amy Patel",        email: "amy.p@gmail.com",      phone: "07788 700800", stage: "active",   notes: "Full transformation — colour + cut.", ltv: 320 },
      { name: "Megan Taylor",     email: "megan.t@outlook.com",  phone: "07799 800900", stage: "lapsed",   notes: "Hasn't been in since November. Win-back offer sent.", ltv: 540 },
      { name: "Lucy Barker",      email: "lucy.b@gmail.com",     phone: "07766 110220", stage: "active",   notes: "Senior stylist only — very specific about fringe.", ltv: 440 },
      { name: "Jenna Walsh",      email: "jenna.w@gmail.com",    phone: "07711 330440", stage: "active",   notes: "Acrylic nails monthly. Fast appointment.", ltv: 720 },
      { name: "Caitlin Moore",    email: "cait.m@yahoo.com",     phone: "07744 550660", stage: "prospect", notes: "Enquired about balayage package.", ltv: 0 },
      { name: "Daisy Hughes",     email: "daisy.h@gmail.com",    phone: "07788 770880", stage: "active",   notes: "Kids cut + mum colour. Back to back.", ltv: 280 },
    ],
    bookings: [
      { ci: 0, treatment: "Full Colour + Toner",     date: daysAgo(5),    time: "08:00", status: "completed", notes: "Root to tip. Toner applied. Client loved it." },
      { ci: 1, treatment: "Highlights & Balayage",   date: daysAgo(2),    time: "10:30", status: "completed", notes: "Ammonia-free dye used as requested." },
      { ci: 6, treatment: "Cut & Blow Dry",          date: daysAgo(1),    time: "13:00", status: "completed", notes: "Senior stylist. Fringe trimmed exact." },
      { ci: 3, treatment: "Bridal Trial",            date: daysFromNow(1),time: "09:00", status: "confirmed", notes: "Trial for May 15th wedding. 6 people." },
      { ci: 2, treatment: "Keratin Treatment",       date: daysFromNow(3),time: "11:00", status: "confirmed", notes: "Allow 3.5 hours. No washing for 48hrs after." },
      { ci: 4, treatment: "Cut, Colour & Style",     date: daysFromNow(5),time: "14:00", status: "confirmed", notes: "Full transformation. Client bringing inspiration pics." },
      { ci: 7, treatment: "Acrylic Full Set",        date: daysFromNow(2),time: "15:30", status: "confirmed", notes: "French finish. Client allergic to acetone." },
      { ci: 9, treatment: "Kids Cut + Mum Colour",   date: daysFromNow(7),time: "10:00", status: "confirmed", notes: "Back to back appointments. Book 2 chairs." },
    ],
    invoices: [
      { ci: 0, desc: "Full Colour + Toner",         amount: 130, vat: false, status: "paid",    daysAgo: 5  },
      { ci: 1, desc: "Highlights & Balayage",       amount: 145, vat: false, status: "paid",    daysAgo: 2  },
      { ci: 6, desc: "Cut & Blow Dry",              amount: 55,  vat: false, status: "paid",    daysAgo: 1  },
      { ci: 2, desc: "Keratin Treatment",           amount: 180, vat: false, status: "draft",   daysAgo: 0  },
      { ci: 4, desc: "Cut, Colour & Style Package", amount: 195, vat: false, status: "draft",   daysAgo: 0  },
      { ci: 5, desc: "Win-back Colour Deal",        amount: 89,  vat: false, status: "overdue", daysAgo: 28 },
    ],
    quotes: [
      {
        clientName: "Isla Ferguson",
        description: "Bridal Hair Package — 6 People",
        amount: 680, status: "accepted",
        items: [
          { item: "Bridal Updo — Bride", qty: 1, unitPrice: 180 },
          { item: "Bridesmaid Updo", qty: 5, unitPrice: 100 },
        ],
      },
      {
        clientName: "Amy Patel",
        description: "Full Colour Transformation Package",
        amount: 320, status: "sent",
        items: [
          { item: "Root to Tip Colour", qty: 1, unitPrice: 130 },
          { item: "Toner", qty: 1, unitPrice: 30 },
          { item: "Cut & Style", qty: 1, unitPrice: 65 },
          { item: "Gloss Treatment", qty: 1, unitPrice: 45 },
          { item: "Loyalty Discount", qty: 1, unitPrice: -50 },
        ],
      },
      {
        clientName: "Caitlin Moore",
        description: "Balayage Package",
        amount: 220, status: "draft",
        items: [
          { item: "Balayage Colour", qty: 1, unitPrice: 155 },
          { item: "Toner & Gloss", qty: 1, unitPrice: 30 },
          { item: "Blow Dry & Style", qty: 1, unitPrice: 35 },
        ],
      },
    ],
  },

  // ─────────────── PLUMBER ──────────────────────────────────────────────────
  plumber: {
    clients: [
      { name: "David Marsh",      email: "d.marsh@gmail.com",    phone: "07811 223344", stage: "vip",      notes: "Annual boiler service. Pays on time every year.", ltv: 1840 },
      { name: "Karen Simmons",    email: "k.simmons@hotmail.com",phone: "07722 334455", stage: "active",   notes: "Full bathroom fit last year. Referred 2 clients.", ltv: 3200 },
      { name: "James Holloway",   email: "james.h@gmail.com",    phone: "07733 445566", stage: "active",   notes: "Radiator install in back bedroom.", ltv: 680 },
      { name: "Fiona Carter",     email: "fiona.c@outlook.com",  phone: "07744 556677", stage: "active",   notes: "Kitchen fit ongoing. Phase 2 due.", ltv: 4800 },
      { name: "Mark Webb",        email: "mark.w@gmail.com",     phone: "07755 667788", stage: "prospect", notes: "Enquired about full central heating install.", ltv: 0 },
      { name: "Sarah Booth",      email: "sarah.b@gmail.com",    phone: "07766 778899", stage: "active",   notes: "Emergency callout — burst pipe. Invoice sent.", ltv: 280 },
      { name: "Tom Neville",      email: "tom.n@yahoo.com",      phone: "07777 889900", stage: "active",   notes: "Kitchen sink waste trap replaced.", ltv: 95 },
      { name: "Lynne Hardy",      email: "lynne.h@gmail.com",    phone: "07788 990011", stage: "active",   notes: "Boiler snagging — all signed off.", ltv: 420 },
      { name: "Pete Granger",     email: "pete.g@hotmail.com",   phone: "07799 001122", stage: "active",   notes: "Full central heating phase 1 complete.", ltv: 3600 },
      { name: "Julie Ansell",     email: "julie.a@gmail.com",    phone: "07700 112233", stage: "lapsed",   notes: "Not booked since January. Follow up for annual service.", ltv: 560 },
    ],
    bookings: [
      { ci: 0, treatment: "Annual Boiler Service",   date: daysAgo(3),     time: "09:00", status: "completed", notes: "Worcester Bosch combi. All good. Certificate issued." },
      { ci: 5, treatment: "Emergency Callout",       date: daysAgo(1),     time: "07:30", status: "completed", notes: "Burst pipe in kitchen. Fixed with compression fitting." },
      { ci: 6, treatment: "Sink Waste Trap Repair",  date: daysAgo(7),     time: "11:00", status: "completed", notes: "Kitchen sink — waste trap replaced. Job done." },
      { ci: 1, treatment: "Boiler Service",          date: daysFromNow(2), time: "09:00", status: "confirmed", notes: "Annual service due. All parts on van." },
      { ci: 2, treatment: "Radiator Install",        date: daysFromNow(4), time: "10:00", status: "confirmed", notes: "Adding rad to back bedroom. 1 day job." },
      { ci: 3, treatment: "Kitchen Fit — Phase 2",   date: daysFromNow(7), time: "08:00", status: "confirmed", notes: "Pipework for new sink and dishwasher." },
      { ci: 7, treatment: "Boiler Snagging Check",   date: daysFromNow(5), time: "10:30", status: "confirmed", notes: "Final check. All signed off last time." },
      { ci: 8, treatment: "Full Central Heating P2", date: daysFromNow(14),time: "08:00", status: "confirmed", notes: "Upstairs rads + thermostat upgrade." },
    ],
    invoices: [
      { ci: 0, desc: "Annual Boiler Service",                     amount: 120,  vat: true,  status: "paid",    daysAgo: 3  },
      { ci: 5, desc: "Emergency Callout — Burst Pipe",            amount: 280,  vat: true,  status: "paid",    daysAgo: 1  },
      { ci: 6, desc: "Kitchen Sink Waste Trap Replacement",       amount: 95,   vat: true,  status: "overdue", daysAgo: 14 },
      { ci: 7, desc: "Boiler Snagging",                           amount: 150,  vat: true,  status: "paid",    daysAgo: 10 },
      { ci: 1, desc: "Bathroom Fit — Labour & Materials",         amount: 1850, vat: true,  status: "paid",    daysAgo: 45 },
      { ci: 2, desc: "Radiator Install — Bedroom",                amount: 380,  vat: true,  status: "draft",   daysAgo: 0  },
    ],
    quotes: [
      {
        clientName: "Mark Webb",
        description: "Full Central Heating System Install",
        amount: 4200, status: "sent",
        items: [
          { item: "Worcester Bosch Combi Boiler Supply & Fit", qty: 1, unitPrice: 2200 },
          { item: "Radiators (8 rooms)", qty: 8, unitPrice: 180 },
          { item: "Pipework & Labour", qty: 1, unitPrice: 560 },
          { item: "System Flush & Pressure Test", qty: 1, unitPrice: 120 },
        ],
      },
      {
        clientName: "Fiona Carter",
        description: "Kitchen Fit Phase 2 — Pipework",
        amount: 960, status: "accepted",
        items: [
          { item: "Sink & Dishwasher Pipework", qty: 1, unitPrice: 480 },
          { item: "Stop Valve Install", qty: 2, unitPrice: 80 },
          { item: "Labour (2 days)", qty: 2, unitPrice: 160 },
        ],
      },
      {
        clientName: "Julie Ansell",
        description: "Annual Boiler Service + Check",
        amount: 120, status: "draft",
        items: [
          { item: "Boiler Service", qty: 1, unitPrice: 95 },
          { item: "Gas Safety Certificate", qty: 1, unitPrice: 25 },
        ],
      },
    ],
  },

  // ─────────────── ELECTRICIAN ──────────────────────────────────────────────
  electrician: {
    clients: [
      { name: "Mike Barton",      email: "mike.b@gmail.com",     phone: "07811 111222", stage: "vip",      notes: "Full rewire done last year. EICR due.", ltv: 4200 },
      { name: "Sandra Lee",       email: "sandra.l@hotmail.com", phone: "07722 222333", stage: "active",   notes: "Consumer unit upgrade. Happy with work.", ltv: 1100 },
      { name: "Connor Watts",     email: "connor.w@gmail.com",   phone: "07733 333444", stage: "active",   notes: "EV charger install. Tesla wall box.", ltv: 850 },
      { name: "Diane Foster",     email: "diane.f@outlook.com",  phone: "07744 444555", stage: "active",   notes: "Solar panel system quote outstanding.", ltv: 0 },
      { name: "Gary Hunt",        email: "gary.h@gmail.com",     phone: "07755 555666", stage: "prospect", notes: "Interested in smart home upgrade.", ltv: 0 },
      { name: "Liz Jennings",     email: "liz.j@gmail.com",      phone: "07766 666777", stage: "active",   notes: "Emergency fault — sorted same day.", ltv: 180 },
      { name: "Rob Haines",       email: "rob.h@yahoo.com",      phone: "07777 777888", stage: "active",   notes: "New circuit for home office.", ltv: 340 },
      { name: "Tracy Wilkins",    email: "tracy.w@gmail.com",    phone: "07788 888999", stage: "active",   notes: "EICR inspection. Pass certificate issued.", ltv: 250 },
      { name: "Phil Dodd",        email: "phil.d@hotmail.com",   phone: "07799 999000", stage: "active",   notes: "Exterior lights + security lighting install.", ltv: 560 },
      { name: "Angela Rice",      email: "angela.r@gmail.com",   phone: "07700 000111", stage: "lapsed",   notes: "Had EICR done 2 years ago. Follow up.", ltv: 250 },
    ],
    bookings: [
      { ci: 1, treatment: "Consumer Unit Upgrade",   date: daysAgo(5),     time: "08:00", status: "completed", notes: "18th edition consumer unit. Test and inspect done." },
      { ci: 5, treatment: "Emergency Fault Fix",     date: daysAgo(2),     time: "10:00", status: "completed", notes: "Tripping RCD. Faulty tumble dryer isolated." },
      { ci: 7, treatment: "EICR Inspection",         date: daysAgo(10),    time: "09:00", status: "completed", notes: "Pass. Certificate issued. Valid 5 years." },
      { ci: 2, treatment: "EV Charger Install",      date: daysFromNow(2), time: "08:30", status: "confirmed", notes: "Tesla Wall Connector. OZEV registered." },
      { ci: 6, treatment: "Home Office Circuit",     date: daysFromNow(4), time: "09:00", status: "confirmed", notes: "Dedicated 32A circuit + 6 sockets." },
      { ci: 8, treatment: "Exterior Lighting",       date: daysFromNow(6), time: "10:00", status: "confirmed", notes: "4 × PIR floodlights + pathway lights." },
      { ci: 0, treatment: "EICR Inspection",         date: daysFromNow(10),time: "09:00", status: "confirmed", notes: "Annual EICR due. Full property inspection." },
      { ci: 3, treatment: "Solar Consultation",      date: daysFromNow(3), time: "11:00", status: "confirmed", notes: "Site survey for 10-panel system." },
    ],
    invoices: [
      { ci: 1, desc: "Consumer Unit Upgrade (18th Ed.)",    amount: 1100, vat: true,  status: "paid",    daysAgo: 5  },
      { ci: 5, desc: "Emergency Callout — RCD Fault",       amount: 180,  vat: true,  status: "paid",    daysAgo: 2  },
      { ci: 7, desc: "EICR Inspection & Certificate",       amount: 250,  vat: true,  status: "paid",    daysAgo: 10 },
      { ci: 6, desc: "Home Office Dedicated Circuit",       amount: 340,  vat: true,  status: "draft",   daysAgo: 0  },
      { ci: 8, desc: "Exterior Security Lighting",          amount: 560,  vat: true,  status: "draft",   daysAgo: 0  },
      { ci: 9, desc: "EICR — Periodic Inspection",          amount: 250,  vat: true,  status: "overdue", daysAgo: 20 },
    ],
    quotes: [
      {
        clientName: "Diane Foster",
        description: "Solar Panel System — 10 Panels",
        amount: 8400, status: "sent",
        items: [
          { item: "Solar Panels × 10 (410W)", qty: 10, unitPrice: 420 },
          { item: "SolarEdge Inverter", qty: 1, unitPrice: 1200 },
          { item: "Installation & Scaffolding", qty: 1, unitPrice: 1800 },
          { item: "DNO Application & Grid Connection", qty: 1, unitPrice: 200 },
        ],
      },
      {
        clientName: "Gary Hunt",
        description: "Smart Home Upgrade Package",
        amount: 2200, status: "sent",
        items: [
          { item: "Hive Smart Heating System", qty: 1, unitPrice: 450 },
          { item: "Smart Lighting (10 rooms)", qty: 10, unitPrice: 85 },
          { item: "Smart Doorbell & Camera", qty: 1, unitPrice: 320 },
          { item: "Installation Labour", qty: 1, unitPrice: 580 },
        ],
      },
      {
        clientName: "Mike Barton",
        description: "EICR + Remedials",
        amount: 420, status: "draft",
        items: [
          { item: "EICR Full Property Inspection", qty: 1, unitPrice: 250 },
          { item: "Remedial Works (Code C2 Items)", qty: 1, unitPrice: 170 },
        ],
      },
    ],
  },

  // ─────────────── JOINER ───────────────────────────────────────────────────
  joiner: {
    clients: [
      { name: "Alan Gifford",     email: "alan.g@gmail.com",     phone: "07811 100200", stage: "vip",      notes: "Full kitchen fit last year. Wants utility room next.", ltv: 6800 },
      { name: "Brenda Walsh",     email: "brenda.w@hotmail.com", phone: "07722 200300", stage: "active",   notes: "Fitted wardrobes — master bedroom. Very detailed brief.", ltv: 1800 },
      { name: "Craig Potter",     email: "craig.p@gmail.com",    phone: "07733 300400", stage: "active",   notes: "Garden office build — frame and cladding done.", ltv: 4200 },
      { name: "Dawn Thorpe",      email: "dawn.t@outlook.com",   phone: "07744 400500", stage: "active",   notes: "Bespoke oak staircase. Materials on order.", ltv: 3400 },
      { name: "Eddie Morton",     email: "eddie.m@gmail.com",    phone: "07755 500600", stage: "prospect", notes: "Interested in fitted home office furniture.", ltv: 0 },
      { name: "Fran Hollis",      email: "fran.h@gmail.com",     phone: "07766 600700", stage: "active",   notes: "Sash window repairs × 4.", ltv: 640 },
      { name: "Geoff Slater",     email: "geoff.s@yahoo.com",    phone: "07777 700800", stage: "active",   notes: "Internal door installation × 6.", ltv: 720 },
      { name: "Helen Burns",      email: "helen.b@gmail.com",    phone: "07788 800900", stage: "active",   notes: "Garden decking + balustrade. Phase 1 done.", ltv: 1850 },
      { name: "Ian Frost",        email: "ian.f@hotmail.com",    phone: "07799 900000", stage: "active",   notes: "Loft conversion — stud walls and floor.", ltv: 2600 },
      { name: "Jo Lawton",        email: "jo.l@gmail.com",       phone: "07700 011122", stage: "lapsed",   notes: "Enquired about bi-fold doors. Gone quiet.", ltv: 0 },
    ],
    bookings: [
      { ci: 1, treatment: "Wardrobes — Fitting Day",  date: daysAgo(6),    time: "08:00", status: "completed", notes: "Master bedroom. Floor to ceiling. Client delighted." },
      { ci: 5, treatment: "Sash Window Repairs",      date: daysAgo(3),    time: "09:00", status: "completed", notes: "4 sashes rebalanced and resealed. Done in a day." },
      { ci: 6, treatment: "Door Installation",        date: daysAgo(1),    time: "08:30", status: "completed", notes: "6 internal doors. Painted finish. Looks great." },
      { ci: 0, treatment: "Utility Room Site Visit",  date: daysFromNow(2),time: "09:00", status: "confirmed", notes: "Measure up. Client has ideas — bring samples." },
      { ci: 3, treatment: "Staircase — Day 2 Fit",   date: daysFromNow(5),time: "07:30", status: "confirmed", notes: "Oak staircase — spindles and handrail day." },
      { ci: 2, treatment: "Garden Office — Day 3",    date: daysFromNow(4),time: "08:00", status: "confirmed", notes: "Internal fit out — insulation, boarding, electrics chase." },
      { ci: 8, treatment: "Loft — Stud Walls",        date: daysFromNow(7),time: "08:00", status: "confirmed", notes: "2 rooms partitioned. Boarding to follow." },
      { ci: 7, treatment: "Decking — Phase 2",        date: daysFromNow(10),time:"08:00", status: "confirmed", notes: "Balustrade and steps phase 2." },
    ],
    invoices: [
      { ci: 1, desc: "Fitted Wardrobes — Master Bedroom",     amount: 1800, vat: true,  status: "paid",    daysAgo: 6  },
      { ci: 5, desc: "Sash Window Repairs × 4",               amount: 640,  vat: true,  status: "paid",    daysAgo: 3  },
      { ci: 6, desc: "Internal Door Installation × 6",        amount: 720,  vat: true,  status: "paid",    daysAgo: 1  },
      { ci: 7, desc: "Garden Decking — Phase 1",              amount: 1200, vat: true,  status: "paid",    daysAgo: 14 },
      { ci: 8, desc: "Loft Conversion — First Fix",           amount: 2600, vat: true,  status: "overdue", daysAgo: 21 },
      { ci: 3, desc: "Oak Staircase — Materials Deposit",     amount: 1200, vat: true,  status: "paid",    daysAgo: 30 },
    ],
    quotes: [
      {
        clientName: "Alan Gifford",
        description: "Bespoke Utility Room Fit",
        amount: 4800, status: "sent",
        items: [
          { item: "Bespoke Cabinets (Shaker Style)", qty: 8, unitPrice: 280 },
          { item: "Worktop — Solid Oak", qty: 3, unitPrice: 320 },
          { item: "Fitting & Installation", qty: 1, unitPrice: 980 },
          { item: "Plumbing Chase & Laundry Alcove", qty: 1, unitPrice: 380 },
        ],
      },
      {
        clientName: "Eddie Morton",
        description: "Home Office Fitted Furniture",
        amount: 2800, status: "sent",
        items: [
          { item: "L-Shaped Desk — Oak", qty: 1, unitPrice: 850 },
          { item: "Floor-to-Ceiling Shelving", qty: 4, unitPrice: 320 },
          { item: "Filing Cabinet Integrated Unit", qty: 1, unitPrice: 450 },
          { item: "Fitting Labour (2 days)", qty: 2, unitPrice: 290 },
        ],
      },
      {
        clientName: "Jo Lawton",
        description: "Bi-Fold Doors — Supply & Fit",
        amount: 3200, status: "draft",
        items: [
          { item: "Bi-Fold Doors (3.6m Aluminium)", qty: 1, unitPrice: 2100 },
          { item: "Structural Opening Preparation", qty: 1, unitPrice: 650 },
          { item: "Installation Labour", qty: 1, unitPrice: 450 },
        ],
      },
    ],
  },

  // ─────────────── LANDSCAPER ───────────────────────────────────────────────
  landscaper: {
    clients: [
      { name: "Neil Chambers",    email: "neil.c@gmail.com",     phone: "07811 222333", stage: "vip",      notes: "Monthly maintenance contract. Pays by standing order.", ltv: 4200 },
      { name: "Ros Kimberley",    email: "ros.k@hotmail.com",    phone: "07722 333444", stage: "active",   notes: "Full garden redesign. Phase 1 complete.", ltv: 6800 },
      { name: "Ben Ashworth",     email: "ben.a@gmail.com",      phone: "07733 444555", stage: "active",   notes: "Lawn care programme — 6 monthly treatments.", ltv: 480 },
      { name: "Carol Dent",       email: "carol.d@outlook.com",  phone: "07744 555666", stage: "active",   notes: "Patio and driveway. Phase 2 quote sent.", ltv: 3600 },
      { name: "Darren Higgs",     email: "darren.h@gmail.com",   phone: "07755 666777", stage: "prospect", notes: "Interested in artificial grass install.", ltv: 0 },
      { name: "Eve Alderton",     email: "eve.a@gmail.com",      phone: "07766 777888", stage: "active",   notes: "Seasonal planting. Spring bedding done.", ltv: 640 },
      { name: "Fred Lowe",        email: "fred.l@yahoo.com",     phone: "07777 888999", stage: "active",   notes: "Hedge trimming quarterly contract.", ltv: 360 },
      { name: "Gail Tanner",      email: "gail.t@gmail.com",     phone: "07788 999000", stage: "active",   notes: "Retaining wall + raised beds. Completed.", ltv: 2100 },
      { name: "Harry Burke",      email: "harry.b@hotmail.com",  phone: "07799 000111", stage: "active",   notes: "Decking + pergola. Materials on site.", ltv: 3200 },
      { name: "Irene Swift",      email: "irene.s@gmail.com",    phone: "07700 111222", stage: "lapsed",   notes: "Spring cleanup. Hasn't rebooked for summer.", ltv: 280 },
    ],
    bookings: [
      { ci: 0, treatment: "Monthly Maintenance",     date: daysAgo(4),    time: "08:00", status: "completed", notes: "Lawn mow, edging, borders tidied." },
      { ci: 5, treatment: "Spring Planting",         date: daysAgo(2),    time: "09:00", status: "completed", notes: "Bedding plants replaced. Looking great." },
      { ci: 6, treatment: "Hedge Trimming",          date: daysAgo(6),    time: "10:00", status: "completed", notes: "Front and rear hedges. Waste removed." },
      { ci: 0, treatment: "Monthly Maintenance",     date: daysFromNow(3),time: "08:00", status: "confirmed", notes: "Scheduled maintenance — May visit." },
      { ci: 1, treatment: "Garden Redesign P2",      date: daysFromNow(5),time: "07:30", status: "confirmed", notes: "Planting plan phase 2. Specimen trees delivery." },
      { ci: 2, treatment: "Lawn Treatment",          date: daysFromNow(4),time: "09:00", status: "confirmed", notes: "Scarify, overseed and feed — visit 3 of 6." },
      { ci: 8, treatment: "Decking & Pergola",       date: daysFromNow(7),time: "08:00", status: "confirmed", notes: "Day 3 of build. Pergola rafters going up." },
      { ci: 3, treatment: "Patio — Phase 2",         date: daysFromNow(10),time:"08:00", status: "confirmed", notes: "Block paving driveway. 3-day job." },
    ],
    invoices: [
      { ci: 0, desc: "Monthly Maintenance — April",          amount: 280, vat: true,  status: "paid",    daysAgo: 4  },
      { ci: 5, desc: "Spring Planting",                      amount: 320, vat: true,  status: "paid",    daysAgo: 2  },
      { ci: 6, desc: "Hedge Trimming — Front & Rear",        amount: 180, vat: true,  status: "paid",    daysAgo: 6  },
      { ci: 7, desc: "Retaining Wall & Raised Beds",         amount: 2100,vat: true,  status: "paid",    daysAgo: 21 },
      { ci: 2, desc: "Lawn Treatment Programme x3",          amount: 240, vat: true,  status: "overdue", daysAgo: 14 },
      { ci: 8, desc: "Decking & Pergola — Deposit (50%)",    amount: 1600,vat: true,  status: "paid",    daysAgo: 30 },
    ],
    quotes: [
      {
        clientName: "Darren Higgs",
        description: "Artificial Grass Install — Back Garden",
        amount: 3800, status: "sent",
        items: [
          { item: "Artificial Grass (40m²)", qty: 40, unitPrice: 38 },
          { item: "Weed Membrane + Compacted Base", qty: 1, unitPrice: 680 },
          { item: "Edging & Fixings", qty: 1, unitPrice: 220 },
          { item: "Labour (2 days)", qty: 2, unitPrice: 390 },
        ],
      },
      {
        clientName: "Carol Dent",
        description: "Patio & Driveway — Phase 2",
        amount: 4200, status: "accepted",
        items: [
          { item: "Block Paving — Driveway (60m²)", qty: 60, unitPrice: 45 },
          { item: "Edging Kerbs", qty: 1, unitPrice: 380 },
          { item: "Groundworks & Preparation", qty: 1, unitPrice: 820 },
          { item: "Labour (3 days)", qty: 3, unitPrice: 380 },
        ],
      },
      {
        clientName: "Irene Swift",
        description: "Summer Garden Maintenance Package",
        amount: 560, status: "draft",
        items: [
          { item: "Monthly Maintenance Visit", qty: 4, unitPrice: 120 },
          { item: "Annual Hedge Trim", qty: 1, unitPrice: 80 },
        ],
      },
    ],
  },

  // ─────────────── CPD ──────────────────────────────────────────────────────
  cpd: {
    clients: [
      { name: "Dr. Sarah Vance",  email: "s.vance@nhs.net",      phone: "07811 100200", stage: "vip",      notes: "Annual CPD subscriber. Renews every January.", ltv: 1480 },
      { name: "Nurse Tom Reid",   email: "t.reid@gmail.com",      phone: "07722 200300", stage: "active",   notes: "IV therapy course. Level 2 in progress.", ltv: 840 },
      { name: "Claire Bishop",    email: "c.bishop@hotmail.com",  phone: "07733 300400", stage: "active",   notes: "Aesthetic prescriber pathway. Module 3 complete.", ltv: 960 },
      { name: "James Lowe",       email: "j.lowe@gmail.com",      phone: "07744 400500", stage: "active",   notes: "Botox & Filler foundations. Passed with merit.", ltv: 640 },
      { name: "Priya Anand",      email: "p.anand@outlook.com",   phone: "07755 500600", stage: "prospect", notes: "Enquired about full aesthetic diploma.", ltv: 0 },
      { name: "Mark Ellison",     email: "m.ellison@gmail.com",   phone: "07766 600700", stage: "active",   notes: "Skin booster certification. Exam booked.", ltv: 480 },
      { name: "Kate Byrne",       email: "k.byrne@yahoo.com",     phone: "07777 700800", stage: "active",   notes: "Advanced dermal filler. Unit 4 outstanding.", ltv: 720 },
      { name: "Liam Park",        email: "l.park@gmail.com",      phone: "07788 800900", stage: "active",   notes: "PDO threads course. Theory passed.", ltv: 560 },
      { name: "Nina Frost",       email: "n.frost@hotmail.com",   phone: "07799 900000", stage: "active",   notes: "Prescribing for Aesthetics. Module 1 done.", ltv: 320 },
      { name: "Owen Hart",        email: "o.hart@gmail.com",      phone: "07700 011122", stage: "lapsed",   notes: "Started botox course but didn't complete. Follow up.", ltv: 280 },
    ],
    bookings: [
      { ci: 1, treatment: "IV Therapy — Level 2",    date: daysAgo(5),    time: "09:00", status: "completed", notes: "Practical assessment passed. Certificate issued." },
      { ci: 3, treatment: "Botox & Filler Practical",date: daysAgo(2),    time: "10:00", status: "completed", notes: "Passed with merit. Excellent technique." },
      { ci: 5, treatment: "Skin Booster Theory",     date: daysAgo(7),    time: "13:00", status: "completed", notes: "Online theory session. Assessment submitted." },
      { ci: 2, treatment: "Prescriber Pathway M4",   date: daysFromNow(3),time: "09:00", status: "confirmed", notes: "Online module. Zoom link sent." },
      { ci: 6, treatment: "Advanced Filler — Unit 4",date: daysFromNow(5),time: "10:00", status: "confirmed", notes: "Live model session. Venue confirmed." },
      { ci: 7, treatment: "PDO Threads Practical",   date: daysFromNow(7),time: "09:00", status: "confirmed", notes: "Model booked. Threadlift technique focus." },
      { ci: 4, treatment: "Diploma Consultation",    date: daysFromNow(2),time: "11:00", status: "confirmed", notes: "Priya's first chat. Send course overview." },
      { ci: 8, treatment: "Prescribing Module 2",    date: daysFromNow(10),time:"10:00", status: "confirmed", notes: "Online. Send Zoom link 24hrs before." },
    ],
    invoices: [
      { ci: 1, desc: "IV Therapy Level 2 — Full Course",         amount: 840,  vat: true,  status: "paid",    daysAgo: 5  },
      { ci: 3, desc: "Botox & Filler Foundations",               amount: 640,  vat: true,  status: "paid",    daysAgo: 2  },
      { ci: 5, desc: "Skin Booster Certification",               amount: 480,  vat: true,  status: "paid",    daysAgo: 7  },
      { ci: 2, desc: "Aesthetic Prescriber Pathway (Modules 1-3)",amount: 720, vat: true,  status: "paid",    daysAgo: 30 },
      { ci: 6, desc: "Advanced Dermal Filler Course",            amount: 720,  vat: true,  status: "overdue", daysAgo: 14 },
      { ci: 7, desc: "PDO Threads Course",                       amount: 560,  vat: true,  status: "draft",   daysAgo: 0  },
    ],
    quotes: [
      {
        clientName: "Priya Anand",
        description: "Full Aesthetic Diploma — 12 Month Programme",
        amount: 3800, status: "sent",
        items: [
          { item: "Botox & Filler Foundations", qty: 1, unitPrice: 640 },
          { item: "Advanced Filler & Threads", qty: 1, unitPrice: 980 },
          { item: "IV Therapy Level 2", qty: 1, unitPrice: 840 },
          { item: "Prescribing for Aesthetics", qty: 1, unitPrice: 720 },
          { item: "Diploma Package Discount", qty: 1, unitPrice: -380 },
        ],
      },
      {
        clientName: "Owen Hart",
        description: "Botox Course Completion — Remaining Units",
        amount: 480, status: "sent",
        items: [
          { item: "Advanced Botox Practical (Units 3 & 4)", qty: 2, unitPrice: 200 },
          { item: "Portfolio Sign-Off Session", qty: 1, unitPrice: 80 },
        ],
      },
      {
        clientName: "Kate Byrne",
        description: "Advanced Filler + PDO Bundle",
        amount: 1100, status: "draft",
        items: [
          { item: "Advanced Dermal Filler Unit 4", qty: 1, unitPrice: 540 },
          { item: "PDO Thread Lift Course", qty: 1, unitPrice: 560 },
        ],
      },
    ],
  },

  // ─────────────── HEALTH ───────────────────────────────────────────────────
  health: {
    clients: [
      { name: "Laura Simmons",    email: "laura.s@gmail.com",    phone: "07811 100200", stage: "vip",      notes: "Monthly osteopathy. Sports injury management.", ltv: 1960 },
      { name: "Dan Carr",         email: "dan.c@gmail.com",      phone: "07722 200300", stage: "active",   notes: "Physiotherapy — lower back. 6 sessions booked.", ltv: 720 },
      { name: "Anna Fox",         email: "anna.f@hotmail.com",   phone: "07733 300400", stage: "active",   notes: "Acupuncture. Migraine management programme.", ltv: 540 },
      { name: "Chris Lamb",       email: "chris.l@gmail.com",    phone: "07744 400500", stage: "active",   notes: "Sports massage. Marathon training support.", ltv: 480 },
      { name: "Bev Stone",        email: "bev.s@outlook.com",    phone: "07755 500600", stage: "prospect", notes: "Initial consultation booked — anxiety and sleep.", ltv: 0 },
      { name: "Ryan Nash",        email: "ryan.n@gmail.com",     phone: "07766 600700", stage: "active",   notes: "Nutrition plan. 12-week programme.", ltv: 840 },
      { name: "Sue Daley",        email: "sue.d@yahoo.com",      phone: "07777 700800", stage: "active",   notes: "Hypnotherapy — smoking cessation. Session 2.", ltv: 360 },
      { name: "Karl Webb",        email: "karl.w@gmail.com",     phone: "07788 800900", stage: "active",   notes: "Reflexology. Monthly standing appointment.", ltv: 680 },
      { name: "Meg Price",        email: "meg.p@hotmail.com",    phone: "07799 900000", stage: "active",   notes: "Pilates rehab — post knee surgery.", ltv: 540 },
      { name: "Tom Finch",        email: "tom.f@gmail.com",      phone: "07700 011122", stage: "lapsed",   notes: "Had 2 physio sessions but dropped off. Chase.", ltv: 240 },
    ],
    bookings: [
      { ci: 0, treatment: "Osteopathy",              date: daysAgo(3),    time: "09:00", status: "completed", notes: "Thoracic manipulation. Good response." },
      { ci: 1, treatment: "Physiotherapy — Back",    date: daysAgo(1),    time: "11:00", status: "completed", notes: "Session 4 of 6. Good progress on flexion." },
      { ci: 2, treatment: "Acupuncture",             date: daysAgo(5),    time: "14:00", status: "completed", notes: "Migraine frequency reducing. Continue." },
      { ci: 3, treatment: "Sports Massage",          date: daysFromNow(2),time: "10:00", status: "confirmed", notes: "Pre-race massage. Marathon in 10 days." },
      { ci: 5, treatment: "Nutrition Review",        date: daysFromNow(4),time: "09:30", status: "confirmed", notes: "Week 6 check-in. Send food diary reminder." },
      { ci: 6, treatment: "Hypnotherapy Session 2",  date: daysFromNow(5),time: "13:00", status: "confirmed", notes: "Smoking cessation. Relaxation techniques." },
      { ci: 4, treatment: "Initial Consultation",    date: daysFromNow(3),time: "11:00", status: "confirmed", notes: "Anxiety & sleep. Assessment only." },
      { ci: 8, treatment: "Pilates Rehab",           date: daysFromNow(7),time: "10:00", status: "confirmed", notes: "Week 4. Strength work starting." },
    ],
    invoices: [
      { ci: 0, desc: "Osteopathy — April Session",              amount: 65,  vat: false, status: "paid",    daysAgo: 3  },
      { ci: 1, desc: "Physiotherapy Session 4",                 amount: 60,  vat: false, status: "paid",    daysAgo: 1  },
      { ci: 2, desc: "Acupuncture — Course of 4",               amount: 200, vat: false, status: "paid",    daysAgo: 5  },
      { ci: 5, desc: "12-Week Nutrition Programme",             amount: 840, vat: false, status: "paid",    daysAgo: 30 },
      { ci: 7, desc: "Reflexology × 4 Sessions",               amount: 220, vat: false, status: "overdue", daysAgo: 18 },
      { ci: 6, desc: "Hypnotherapy — 3 Session Package",        amount: 360, vat: false, status: "draft",   daysAgo: 0  },
    ],
    quotes: [
      {
        clientName: "Dan Carr",
        description: "Extended Physiotherapy Programme",
        amount: 720, status: "sent",
        items: [
          { item: "Physiotherapy Session", qty: 12, unitPrice: 60 },
        ],
      },
      {
        clientName: "Bev Stone",
        description: "Anxiety & Sleep — Wellbeing Package",
        amount: 480, status: "draft",
        items: [
          { item: "Initial Consultation", qty: 1, unitPrice: 80 },
          { item: "Hypnotherapy Sessions", qty: 4, unitPrice: 80 },
          { item: "Nutrition Wellbeing Plan", qty: 1, unitPrice: 80 },
        ],
      },
      {
        clientName: "Meg Price",
        description: "Pilates Rehab — 8 Week Programme",
        amount: 560, status: "accepted",
        items: [
          { item: "1:1 Pilates Rehab Session", qty: 8, unitPrice: 70 },
        ],
      },
    ],
  },

  // ─────────────── BUILDER ──────────────────────────────────────────────────
  builder: {
    clients: [
      { name: "Steve Baxter",     email: "steve.b@gmail.com",    phone: "07811 100200", stage: "vip",      notes: "Extension completed. Now wants loft conversion.", ltv: 48000 },
      { name: "Paula Dennis",     email: "paula.d@hotmail.com",  phone: "07722 200300", stage: "active",   notes: "Garage conversion. Plastering stage.", ltv: 12000 },
      { name: "Wayne Cross",      email: "wayne.c@gmail.com",    phone: "07733 300400", stage: "active",   notes: "New build bungalow. Groundworks done.", ltv: 180000 },
      { name: "Sandra Poole",     email: "sandra.p@outlook.com", phone: "07744 400500", stage: "active",   notes: "Rear extension — steel beam in. Brick phase.", ltv: 32000 },
      { name: "Daryl Hines",      email: "daryl.h@gmail.com",    phone: "07755 500600", stage: "prospect", notes: "Wants basement conversion. Site visit booked.", ltv: 0 },
      { name: "Claire West",      email: "claire.w@gmail.com",   phone: "07766 600700", stage: "active",   notes: "Bathroom refit — tiling stage.", ltv: 4800 },
      { name: "Terry Goode",      email: "terry.g@yahoo.com",    phone: "07777 700800", stage: "active",   notes: "Garden wall rebuild. Complete.", ltv: 1800 },
      { name: "Mandy Shore",      email: "mandy.s@gmail.com",    phone: "07788 800900", stage: "active",   notes: "Kitchen extension — open plan. Structural.", ltv: 28000 },
      { name: "Roy Platt",        email: "roy.p@hotmail.com",    phone: "07799 900000", stage: "active",   notes: "Flat roof replacement. Job complete.", ltv: 6400 },
      { name: "Vicky Lane",       email: "vicky.l@gmail.com",    phone: "07700 011122", stage: "lapsed",   notes: "Interested in driveway. Went quiet after quote.", ltv: 0 },
    ],
    bookings: [
      { ci: 1, treatment: "Garage Conversion — Plastering", date: daysAgo(4),    time: "07:30", status: "completed", notes: "First coat on. Skimming tomorrow." },
      { ci: 5, treatment: "Bathroom Refit — Tiling",        date: daysAgo(2),    time: "08:00", status: "completed", notes: "Floor tiles laid. Wall tiles starting." },
      { ci: 6, treatment: "Garden Wall Rebuild",            date: daysAgo(7),    time: "08:00", status: "completed", notes: "Rebuilt in engineering brick. Pointed and done." },
      { ci: 3, treatment: "Rear Extension — Brickwork",     date: daysFromNow(2),time: "07:30", status: "confirmed", notes: "Brick phase. Scaffold still up." },
      { ci: 2, treatment: "New Build — First Fix",          date: daysFromNow(5),time: "07:30", status: "confirmed", notes: "First fix electrics, plumbing and joinery." },
      { ci: 7, treatment: "Kitchen Extension — Steel",      date: daysFromNow(3),time: "08:00", status: "confirmed", notes: "Steel beam in. Opening formed. Temporary support removed." },
      { ci: 0, treatment: "Loft Conversion Site Visit",     date: daysFromNow(4),time: "09:00", status: "confirmed", notes: "Full survey. Drawings to follow." },
      { ci: 4, treatment: "Basement Conversion Survey",     date: daysFromNow(1),time: "10:00", status: "confirmed", notes: "Initial site visit. Structural engineer attending." },
    ],
    invoices: [
      { ci: 6, desc: "Garden Wall Rebuild",                      amount: 1800,  vat: true,  status: "paid",    daysAgo: 7  },
      { ci: 8, desc: "Flat Roof Replacement",                    amount: 6400,  vat: true,  status: "paid",    daysAgo: 14 },
      { ci: 1, desc: "Garage Conversion — Stage 2 Payment",      amount: 5800,  vat: true,  status: "paid",    daysAgo: 4  },
      { ci: 3, desc: "Rear Extension — Stage 1 (Foundations)",   amount: 12000, vat: true,  status: "paid",    daysAgo: 30 },
      { ci: 5, desc: "Bathroom Refit — Labour & Materials",      amount: 4800,  vat: true,  status: "overdue", daysAgo: 10 },
      { ci: 7, desc: "Kitchen Extension — Stage 1",              amount: 9500,  vat: true,  status: "draft",   daysAgo: 0  },
    ],
    quotes: [
      {
        clientName: "Steve Baxter",
        description: "Loft Conversion — Full Dormer",
        amount: 42000, status: "sent",
        items: [
          { item: "Structural & Groundwork", qty: 1, unitPrice: 8000 },
          { item: "Dormer Frame & Roofing", qty: 1, unitPrice: 12000 },
          { item: "First & Second Fix", qty: 1, unitPrice: 9000 },
          { item: "Plastering, Decoration & Flooring", qty: 1, unitPrice: 7000 },
          { item: "Staircase Supply & Fit", qty: 1, unitPrice: 4500 },
          { item: "Electrics & Plumbing", qty: 1, unitPrice: 4500 },
          { item: "Project Management & Overheads", qty: 1, unitPrice: 3000 },
          { item: "Early Booking Discount (5%)", qty: 1, unitPrice: -6000 },
        ],
      },
      {
        clientName: "Daryl Hines",
        description: "Basement Conversion",
        amount: 55000, status: "draft",
        items: [
          { item: "Excavation & Underpinning", qty: 1, unitPrice: 18000 },
          { item: "Waterproofing System", qty: 1, unitPrice: 8000 },
          { item: "Structural Works", qty: 1, unitPrice: 12000 },
          { item: "First & Second Fix", qty: 1, unitPrice: 9000 },
          { item: "Fit Out (Gym/Office Spec)", qty: 1, unitPrice: 8000 },
        ],
      },
      {
        clientName: "Wayne Cross",
        description: "New Build — Phase 2 (First Fix)",
        amount: 28000, status: "accepted",
        items: [
          { item: "First Fix Carpentry", qty: 1, unitPrice: 8000 },
          { item: "First Fix Electrics", qty: 1, unitPrice: 6000 },
          { item: "First Fix Plumbing", qty: 1, unitPrice: 5500 },
          { item: "Insulation & Boarding", qty: 1, unitPrice: 4500 },
          { item: "Labour Management", qty: 1, unitPrice: 4000 },
        ],
      },
    ],
  },
};

// ── Seed function ─────────────────────────────────────────────────────────────

async function seedIndustry(industry, userId) {
  const data = INDUSTRIES[industry];
  if (!data) { console.log(`  ⚠️  No data for ${industry}`); return; }

  console.log(`\n  Seeding ${industry} (${userId})…`);

  // Wipe existing
  await db.from("bookings").delete().eq("user_id", userId);
  await db.from("invoices").delete().eq("user_id", userId);
  await db.from("leads").delete().eq("user_id", userId);
  await db.from("quotes").delete().eq("user_id", userId);
  await db.from("consent_forms").delete().eq("user_id", userId);
  await db.from("clients").delete().eq("user_id", userId);
  console.log(`    ✓ wiped`);

  // Seed clients
  const clientIds = [];
  for (const c of data.clients) {
    const { data: row, error } = await db.from("clients").insert({
      user_id: userId, name: c.name, email: c.email, phone: c.phone,
      stage: c.stage, notes: c.notes, ltv: c.ltv,
    }).select("id").single();
    if (error) { console.error(`    ✗ client ${c.name}:`, error.message); clientIds.push(null); }
    else clientIds.push(row.id);
  }
  console.log(`    ✓ ${clientIds.filter(Boolean).length} clients`);

  // Seed bookings
  let bOk = 0;
  for (const b of data.bookings) {
    const cid = clientIds[b.ci];
    if (!cid) continue;
    const { error } = await db.from("bookings").insert({
      user_id: userId, client_id: cid,
      treatment_name: b.treatment,
      date: b.date, time: b.time, status: b.status, notes: b.notes,
    });
    if (!error) bOk++;
  }
  console.log(`    ✓ ${bOk} bookings`);

  // Seed invoices
  let iNum = 1, iOk = 0;
  for (const inv of data.invoices) {
    const cid = clientIds[inv.ci];
    const client = data.clients[inv.ci];
    const issueDate = new Date();
    issueDate.setDate(issueDate.getDate() - inv.daysAgo);
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);
    const vatAmount = inv.vat ? inv.amount * 0.2 : 0;
    const total = inv.amount + vatAmount;
    const { error } = await db.from("invoices").insert({
      user_id: userId, client_id: cid || null,
      client_name: client?.name || "Client",
      client_email: client?.email || null,
      invoice_number: `DEMO-${String(iNum++).padStart(4, "0")}`,
      status: inv.status,
      issue_date: issueDate.toISOString().split("T")[0],
      due_date: dueDate.toISOString().split("T")[0],
      items: JSON.stringify([{ description: inv.desc, quantity: 1, unit_price: inv.amount, total: inv.amount }]),
      subtotal: inv.amount,
      tax_rate: inv.vat ? 20 : 0,
      tax_amount: vatAmount,
      total,
      notes: null,
    });
    if (!error) iOk++;
  }
  console.log(`    ✓ ${iOk} invoices`);

  // Seed quotes
  let qOk = 0;
  for (const q of data.quotes) {
    const { error } = await db.from("quotes").insert({
      user_id: userId, client_id: null,
      description: q.description,
      amount: q.amount, status: q.status,
      line_items: q.items,
      notes: q.clientName,
    });
    if (!error) qOk++;
  }
  console.log(`    ✓ ${qOk} quotes`);

  console.log(`  ✅ ${industry} done`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("🌱 PractiVault demo seeder starting…\n");
for (const [industry, userId] of Object.entries(USERS)) {
  await seedIndustry(industry, userId);
}
console.log("\n🎉 All industries seeded!\n");
