// ─── PractiVault Demo Seed Data ───────────────────────────────────────────────
// 9 industries × (10 clients, 8 bookings, 5 invoices, 4 leads, 3 quotes, 2 consent)

export interface DemoIndustry {
  id: string;
  name: string;
  businessName: string;
  tagline: string;
  emoji: string;
  treatments: { name: string; price: number }[];
  clients: DemoClient[];
  bookings: DemoBooking[];
  invoices: DemoInvoice[];
  leads: DemoLead[];
  quotes: DemoQuote[];
  consent: DemoConsent[];
}

interface DemoClient { name: string; email: string; phone: string; stage: string; notes: string; ltv: number }
interface DemoBooking { clientIndex: number; treatment: string; date: string; time: string; status: string; notes: string }
interface DemoInvoice { clientIndex: number; description: string; amount: number; vat: boolean; status: string; daysAgo: number }
interface DemoLead { name: string; phone: string; interest: string; source: string; notes: string }
interface DemoQuote { clientName: string; description: string; amount: number; status: string }
interface DemoConsent { clientIndex: number; treatment: string; status: string }

function d(offset: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_INDUSTRIES: Record<string, DemoIndustry> = {

  aesthetics: {
    id: "aesthetics", name: "Aesthetics & Beauty", businessName: "Glow Studio", emoji: "🌿",
    tagline: "Medical aesthetics, laser & skin clinic",
    treatments: [
      { name: "Botox — Full Face", price: 350 }, { name: "Lip Filler 1ml", price: 280 },
      { name: "Chemical Peel", price: 120 }, { name: "endoPulse Laser", price: 450 },
      { name: "Microneedling", price: 180 }, { name: "HydraFacial", price: 95 },
    ],
    clients: [
      { name: "Sophie Langford",   email: "sophie.l@gmail.com",   phone: "07711 234567", stage: "vip",      notes: "Prefers afternoon appointments. Allergic to lidocaine.", ltv: 2840 },
      { name: "Emma Richardson",   email: "emma.r@hotmail.com",   phone: "07722 345678", stage: "active",   notes: "Regular filler client every 6 months.", ltv: 1260 },
      { name: "Jade Thornton",     email: "jade.t@gmail.com",     phone: "07733 456789", stage: "active",   notes: "Interested in laser package deal.", ltv: 980 },
      { name: "Chloe Bennett",     email: "chloe.b@yahoo.co.uk",  phone: "07744 567890", stage: "prospect", notes: "First consultation booked. Nervous about needles.", ltv: 120 },
      { name: "Natalie Okafor",    email: "natalie.o@gmail.com",  phone: "07755 678901", stage: "vip",      notes: "Pays upfront. Always refers friends.", ltv: 3500 },
      { name: "Lucy Hartmann",     email: "lucy.h@outlook.com",   phone: "07766 789012", stage: "active",   notes: "Monthly HydraFacial standing appointment.", ltv: 760 },
      { name: "Priya Sharma",      email: "priya.s@gmail.com",    phone: "07777 890123", stage: "active",   notes: "Combination botox & filler client.", ltv: 1540 },
      { name: "Hannah Clarke",     email: "hannah.c@gmail.com",   phone: "07788 901234", stage: "lead",     notes: "Enquired via Instagram DM.", ltv: 0 },
      { name: "Melissa Frost",     email: "melissa.f@hotmail.com",phone: "07799 012345", stage: "lapsed",   notes: "Last visit 14 months ago — chase for reactivation.", ltv: 620 },
      { name: "Zara Ahmed",        email: "zara.a@gmail.com",     phone: "07700 123456", stage: "active",   notes: "Sensitive skin, use gentle protocols.", ltv: 890 },
    ],
    bookings: [
      { clientIndex: 0, treatment: "Botox — Full Face",  date: d(-14), time: "14:00", status: "completed", notes: "Excellent result, follow up in 2 weeks" },
      { clientIndex: 1, treatment: "Lip Filler 1ml",     date: d(-7),  time: "11:30", status: "completed", notes: "Client very happy with result" },
      { clientIndex: 2, treatment: "endoPulse Laser",    date: d(2),   time: "10:00", status: "confirmed", notes: "Session 3 of 6 course" },
      { clientIndex: 4, treatment: "Botox — Full Face",  date: d(5),   time: "15:00", status: "confirmed", notes: "Top-up treatment" },
      { clientIndex: 5, treatment: "HydraFacial",        date: d(7),   time: "09:30", status: "confirmed", notes: "Monthly standing appointment" },
      { clientIndex: 6, treatment: "Microneedling",      date: d(-3),  time: "13:00", status: "completed", notes: "Good skin response" },
      { clientIndex: 3, treatment: "Chemical Peel",      date: d(10),  time: "11:00", status: "confirmed", notes: "First treatment — patch test done" },
      { clientIndex: 9, treatment: "HydraFacial",        date: d(-1),  time: "16:00", status: "completed", notes: "Sensitive skin protocol used" },
    ],
    invoices: [
      { clientIndex: 0, description: "Botox Full Face + Review",    amount: 350, vat: false, status: "paid",     daysAgo: 14 },
      { clientIndex: 1, description: "Lip Filler 1ml",              amount: 280, vat: false, status: "paid",     daysAgo: 7 },
      { clientIndex: 4, description: "Botox Full Face",             amount: 350, vat: false, status: "draft",    daysAgo: 0 },
      { clientIndex: 6, description: "Microneedling x3 Course",     amount: 480, vat: false, status: "overdue",  daysAgo: 21 },
      { clientIndex: 2, description: "endoPulse Laser x6 Course",   amount: 2400, vat: false, status: "paid",    daysAgo: 30 },
    ],
    leads: [
      { name: "Amber Collins",  phone: "07811 111222", interest: "Lip filler consultation",     source: "instagram", notes: "Seen our reel — very keen" },
      { name: "Beth Saunders",  phone: "07822 222333", interest: "Botox for first time",        source: "referral",  notes: "Referred by Sophie Langford" },
      { name: "Caitlin Moore",  phone: "07833 333444", interest: "Full laser hair removal",     source: "website",   notes: "Wants pricing breakdown" },
      { name: "Diana Walsh",    phone: "07844 444555", interest: "Skin consultation",           source: "facebook",  notes: "Acne scarring concern" },
    ],
    quotes: [
      { clientName: "Jade Thornton",  description: "endoPulse Laser x6 Course",    amount: 2400, status: "sent" },
      { clientName: "Melissa Frost",  description: "Reactivation Package (3 treatments)", amount: 480, status: "draft" },
      { clientName: "Hannah Clarke",  description: "Consultation + Botox",         amount: 470, status: "viewed" },
    ],
    consent: [
      { clientIndex: 2, treatment: "endoPulse Laser", status: "signed" },
      { clientIndex: 3, treatment: "Chemical Peel",   status: "sent" },
    ],
  },

  // ─── HAIR & NAIL SALON ────────────────────────────────────────────────────
  hair: {
    id: "hair", name: "Hair & Nail Salon", businessName: "Luxe Salon", emoji: "💇",
    tagline: "Hair, colour, nails & beauty",
    treatments: [
      { name: "Cut & Blow Dry", price: 55 }, { name: "Full Colour", price: 110 },
      { name: "Highlights", price: 145 }, { name: "Acrylic Full Set", price: 45 },
      { name: "Gel Nails", price: 38 }, { name: "Keratin Treatment", price: 180 },
    ],
    clients: [
      { name: "Rachel Green",     email: "rachel.g@gmail.com",  phone: "07711 100200", stage: "vip",      notes: "Monthly colour client. Always books 8am.", ltv: 1980 },
      { name: "Tanya Brooks",     email: "tanya.b@yahoo.co.uk", phone: "07722 200300", stage: "active",   notes: "Loves balayage. Allergic to ammonia dyes.", ltv: 760 },
      { name: "Katie Wills",      email: "katie.w@gmail.com",   phone: "07733 300400", stage: "active",   notes: "Gel nails fortnightly. Prefers pastel shades.", ltv: 456 },
      { name: "Olivia Mason",     email: "olivia.m@gmail.com",  phone: "07744 400500", stage: "active",   notes: "First time keratin client.", ltv: 180 },
      { name: "Fiona Campbell",   email: "fiona.c@outlook.com", phone: "07755 500600", stage: "vip",      notes: "Brings her daughter too. Total spend includes both.", ltv: 3200 },
      { name: "Amy Patel",        email: "amy.p@gmail.com",     phone: "07766 600700", stage: "prospect", notes: "Wants a full transformation package quote.", ltv: 55 },
      { name: "Grace Liu",        email: "grace.l@gmail.com",   phone: "07777 700800", stage: "active",   notes: "Asian hair specialist — book with senior stylist.", ltv: 890 },
      { name: "Isla Ferguson",    email: "isla.f@hotmail.com",  phone: "07788 800900", stage: "lead",     notes: "Enquired about bridal package.", ltv: 0 },
      { name: "Megan Taylor",     email: "megan.t@gmail.com",   phone: "07799 900100", stage: "lapsed",   notes: "Hasn't booked in 6 months — send win-back offer.", ltv: 330 },
      { name: "Jess Thornton",    email: "jess.t@gmail.com",    phone: "07700 010203", stage: "active",   notes: "Acrylics every 3 weeks.", ltv: 540 },
    ],
    bookings: [
      { clientIndex: 0, treatment: "Full Colour",        date: d(-5),  time: "08:00", status: "completed", notes: "Root to tip, toner applied" },
      { clientIndex: 1, treatment: "Highlights",         date: d(-2),  time: "10:30", status: "completed", notes: "Used ammonia-free dye as requested" },
      { clientIndex: 2, treatment: "Gel Nails",          date: d(1),   time: "14:00", status: "confirmed", notes: "Pastel pink — client's choice" },
      { clientIndex: 4, treatment: "Cut & Blow Dry",     date: d(3),   time: "09:00", status: "confirmed", notes: "Mother & daughter — back to back" },
      { clientIndex: 3, treatment: "Keratin Treatment",  date: d(7),   time: "11:00", status: "confirmed", notes: "Allow 3 hours" },
      { clientIndex: 6, treatment: "Cut & Blow Dry",     date: d(-1),  time: "13:00", status: "completed", notes: "Senior stylist only" },
      { clientIndex: 9, treatment: "Acrylic Full Set",   date: d(4),   time: "15:30", status: "confirmed", notes: "French finish requested" },
      { clientIndex: 5, treatment: "Cut & Blow Dry",     date: d(14),  time: "10:00", status: "confirmed", notes: "Consultation first" },
    ],
    invoices: [
      { clientIndex: 0, description: "Full Colour + Toner",         amount: 130, vat: false, status: "paid",    daysAgo: 5 },
      { clientIndex: 1, description: "Highlights",                  amount: 145, vat: false, status: "paid",    daysAgo: 2 },
      { clientIndex: 4, description: "Mother & Daughter Cuts",      amount: 110, vat: false, status: "draft",   daysAgo: 0 },
      { clientIndex: 6, description: "Cut & Blow Dry",              amount: 55,  vat: false, status: "paid",    daysAgo: 1 },
      { clientIndex: 3, description: "Keratin Treatment",           amount: 180, vat: false, status: "draft",   daysAgo: 0 },
    ],
    leads: [
      { name: "Sasha Lennon",  phone: "07811 001002", interest: "Bridal hair & makeup package", source: "instagram", notes: "Wedding in August — needs full team" },
      { name: "Pippa Wallis",  phone: "07822 002003", interest: "Balayage first time",          source: "referral",  notes: "Referred by Tanya Brooks" },
      { name: "Nadia Hassan",  phone: "07833 003004", interest: "Acrylic nails & infills",      source: "website",   notes: "Currently with another salon" },
      { name: "Lottie Marsh",  phone: "07844 004005", interest: "Colour correction",            source: "facebook",  notes: "Box dye disaster — needs correction" },
    ],
    quotes: [
      { clientName: "Isla Ferguson",  description: "Bridal Hair Package (6 people)",  amount: 680, status: "sent" },
      { clientName: "Amy Patel",      description: "Full Transformation Package",     amount: 320, status: "viewed" },
      { clientName: "Megan Taylor",   description: "Win-back Colour Deal",            amount: 89,  status: "draft" },
    ],
    consent: [
      { clientIndex: 1, treatment: "Highlights (Ammonia-Free)", status: "signed" },
      { clientIndex: 3, treatment: "Keratin Treatment",         status: "sent" },
    ],
  },

  // ─── PLUMBER ──────────────────────────────────────────────────────────────
  plumber: {
    id: "plumber", name: "Plumbing", businessName: "Premier Plumbing", emoji: "🔧",
    tagline: "Domestic & commercial plumbing services",
    treatments: [
      { name: "Boiler Service", price: 85 }, { name: "Emergency Callout", price: 150 },
      { name: "Bathroom Fit", price: 1800 }, { name: "Leak Repair", price: 120 },
      { name: "Radiator Install", price: 180 }, { name: "Full Central Heating", price: 4500 },
    ],
    clients: [
      { name: "Dave Morrison",    email: "dave.m@gmail.com",     phone: "07711 110011", stage: "vip",      notes: "Landlord — 4 rental properties. Always pays same day.", ltv: 6800 },
      { name: "Mrs Henderson",    email: "s.henderson@sky.com",  phone: "07722 220022", stage: "active",   notes: "Annual boiler service. Worcester Bosch installed 2021.", ltv: 425 },
      { name: "Tom Briggs",       email: "tom.b@gmail.com",      phone: "07733 330033", stage: "active",   notes: "New build — snagging list signed off.", ltv: 980 },
      { name: "Raj Patel",        email: "raj.p@hotmail.com",    phone: "07744 440044", stage: "prospect", notes: "Wants full bathroom refit quote.", ltv: 0 },
      { name: "Karen Whitfield",  email: "karen.w@gmail.com",    phone: "07755 550055", stage: "active",   notes: "Emergency call last winter. Now regular.", ltv: 560 },
      { name: "Mike Sutton",      email: "mike.s@outlook.com",   phone: "07766 660066", stage: "vip",      notes: "Commercial site manager — office block contract.", ltv: 12400 },
      { name: "Linda Forsythe",   email: "linda.f@gmail.com",    phone: "07777 770077", stage: "active",   notes: "Leak under kitchen sink — sorted last month.", ltv: 240 },
      { name: "Sharon Webb",      email: "sharon.w@yahoo.co.uk", phone: "07788 880088", stage: "lead",     notes: "Kitchen sink unblocking enquiry via phone.", ltv: 0 },
      { name: "Pete Carroll",     email: "pete.c@gmail.com",     phone: "07799 990099", stage: "lapsed",   notes: "Boiler service overdue by 8 months.", ltv: 255 },
      { name: "James Okafor",     email: "james.o@gmail.com",    phone: "07700 000111", stage: "active",   notes: "Full central heating install — phase 2 pending.", ltv: 4500 },
    ],
    bookings: [
      { clientIndex: 1, treatment: "Boiler Service",       date: d(4),   time: "09:00", status: "confirmed", notes: "Annual service — Worcester Bosch" },
      { clientIndex: 0, treatment: "Leak Repair",          date: d(-3),  time: "08:00", status: "completed", notes: "Pipe under bath, fixed with compression fitting" },
      { clientIndex: 4, treatment: "Radiator Install",     date: d(7),   time: "10:00", status: "confirmed", notes: "Adding rad to back bedroom" },
      { clientIndex: 5, treatment: "Emergency Callout",    date: d(-1),  time: "07:30", status: "completed", notes: "Burst pipe in office — fixed, invoice sent" },
      { clientIndex: 6, treatment: "Leak Repair",          date: d(-7),  time: "11:00", status: "completed", notes: "Kitchen sink — waste trap replaced" },
      { clientIndex: 9, treatment: "Full Central Heating", date: d(14),  time: "08:00", status: "confirmed", notes: "Phase 2 — upstairs rads and thermostat" },
      { clientIndex: 2, treatment: "Boiler Service",       date: d(-10), time: "09:30", status: "completed", notes: "Snagging complete, all signed off" },
      { clientIndex: 3, treatment: "Bathroom Fit",         date: d(21),  time: "08:00", status: "confirmed", notes: "Materials TBC — quote accepted" },
    ],
    invoices: [
      { clientIndex: 0, description: "Leak repair — bathroom pipe",        amount: 120,  vat: true,  status: "paid",    daysAgo: 3 },
      { clientIndex: 5, description: "Emergency callout — burst pipe",     amount: 280,  vat: true,  status: "paid",    daysAgo: 1 },
      { clientIndex: 6, description: "Kitchen sink waste trap",            amount: 95,   vat: true,  status: "overdue", daysAgo: 14 },
      { clientIndex: 2, description: "Boiler service + snagging",          amount: 185,  vat: true,  status: "paid",    daysAgo: 10 },
      { clientIndex: 9, description: "Central heating phase 1",            amount: 4500, vat: true,  status: "paid",    daysAgo: 30 },
    ],
    leads: [
      { name: "Sharon Webb",    phone: "07788 880088", interest: "Kitchen sink unblocking",    source: "phone",    notes: "Called this morning — urgent" },
      { name: "Gary Nichols",   phone: "07811 121314", interest: "Bathroom refit full",       source: "referral", notes: "Referred by Dave Morrison" },
      { name: "Anita Roy",      phone: "07822 131415", interest: "Boiler replacement",        source: "website",  notes: "Old combi, 15 years old" },
      { name: "Colin Marsh",    phone: "07833 141516", interest: "Underfloor heating quote",  source: "facebook", notes: "Extension being built — wants UFH" },
    ],
    quotes: [
      { clientName: "Raj Patel",   description: "Full Bathroom Refit inc. tiling", amount: 2800, status: "sent" },
      { clientName: "Colin Marsh", description: "Underfloor Heating — Extension",  amount: 3200, status: "viewed" },
      { clientName: "Anita Roy",   description: "Boiler Replacement (Combi)",      amount: 2200, status: "draft" },
    ],
    consent: [
      { clientIndex: 9, treatment: "Central Heating Install", status: "signed" },
      { clientIndex: 3, treatment: "Bathroom Fit",            status: "sent" },
    ],
  },

  // ─── ELECTRICIAN ─────────────────────────────────────────────────────────
  electrician: {
    id: "electrician", name: "Electrician", businessName: "Spark Electric", emoji: "⚡",
    tagline: "Domestic & commercial electrical services",
    treatments: [
      { name: "Consumer Unit Upgrade", price: 550 }, { name: "PAT Testing", price: 120 },
      { name: "Full Rewire", price: 3800 }, { name: "EV Charger Install", price: 850 },
      { name: "Fault Finding", price: 95 }, { name: "Solar Panel Install", price: 6500 },
    ],
    clients: [
      { name: "Steve Hardman",  email: "steve.h@gmail.com",    phone: "07711 211211", stage: "vip",      notes: "Property developer — 3 houses in progress.", ltv: 14200 },
      { name: "Claire Dobbs",   email: "claire.d@sky.com",     phone: "07722 312312", stage: "active",   notes: "EV charger installed, happy customer.", ltv: 850 },
      { name: "Frank Barlow",   email: "frank.b@hotmail.com",  phone: "07733 413413", stage: "active",   notes: "Old house rewire — mid-job.", ltv: 3800 },
      { name: "Gina Torres",    email: "gina.t@gmail.com",     phone: "07744 514514", stage: "prospect", notes: "Wants solar panel quote for farmhouse.", ltv: 0 },
      { name: "Hassan Ali",     email: "hassan.a@gmail.com",   phone: "07755 615615", stage: "active",   notes: "Restaurant PAT testing contract.", ltv: 960 },
      { name: "Irene Blackwell",email: "irene.b@outlook.com",  phone: "07766 716716", stage: "active",   notes: "Consumer unit upgrade done — warranty 5yr.", ltv: 550 },
      { name: "Jack Norris",    email: "jack.n@gmail.com",     phone: "07777 817817", stage: "lead",     notes: "Enquired about outdoor lighting circuit.", ltv: 0 },
      { name: "Kerry Hudson",   email: "kerry.h@yahoo.co.uk",  phone: "07788 918918", stage: "active",   notes: "Smoke alarm & carbon monoxide install.", ltv: 280 },
      { name: "Lee Partridge",  email: "lee.p@gmail.com",      phone: "07799 019019", stage: "lapsed",   notes: "Fault finding 8 months ago — chase up.", ltv: 190 },
      { name: "Maria Evans",    email: "maria.e@gmail.com",    phone: "07700 120120", stage: "active",   notes: "Kitchen extension circuits — phase 2 due.", ltv: 1200 },
    ],
    bookings: [
      { clientIndex: 0, treatment: "Full Rewire",           date: d(-7),  time: "08:00", status: "completed", notes: "House 2 of 3 complete" },
      { clientIndex: 1, treatment: "EV Charger Install",    date: d(-14), time: "10:00", status: "completed", notes: "Pod Point 7kW installed" },
      { clientIndex: 2, treatment: "Full Rewire",           date: d(3),   time: "08:00", status: "confirmed", notes: "Day 3 of 5 — upstairs circuits" },
      { clientIndex: 4, treatment: "PAT Testing",           date: d(5),   time: "09:00", status: "confirmed", notes: "Restaurant — 45 appliances" },
      { clientIndex: 5, treatment: "Consumer Unit Upgrade", date: d(-5),  time: "08:30", status: "completed", notes: "18th edition compliant" },
      { clientIndex: 7, treatment: "Fault Finding",         date: d(2),   time: "14:00", status: "confirmed", notes: "Intermittent trip on ring main" },
      { clientIndex: 9, treatment: "Full Rewire",           date: d(10),  time: "08:00", status: "confirmed", notes: "Phase 2 — kitchen extension" },
      { clientIndex: 3, treatment: "Solar Panel Install",   date: d(28),  time: "08:00", status: "confirmed", notes: "Survey done, quote accepted" },
    ],
    invoices: [
      { clientIndex: 0, description: "Full Rewire — House 2",           amount: 3800, vat: true, status: "paid",    daysAgo: 7 },
      { clientIndex: 1, description: "EV Charger (Pod Point 7kW)",      amount: 850,  vat: true, status: "paid",    daysAgo: 14 },
      { clientIndex: 5, description: "Consumer Unit Upgrade",           amount: 550,  vat: true, status: "overdue", daysAgo: 10 },
      { clientIndex: 4, description: "PAT Testing — Restaurant (Q1)",   amount: 120,  vat: true, status: "paid",    daysAgo: 30 },
      { clientIndex: 9, description: "Kitchen Extension — Phase 1",     amount: 1200, vat: true, status: "paid",    daysAgo: 21 },
    ],
    leads: [
      { name: "Jack Norris",    phone: "07777 817817", interest: "Garden lighting circuit",     source: "referral", notes: "Referred by Claire Dobbs" },
      { name: "Nina Pearce",    phone: "07811 221221", interest: "EV charger installation",     source: "website",  notes: "Tesla Model 3 owner" },
      { name: "Owen Drake",     phone: "07822 331331", interest: "Solar panels + battery",      source: "facebook", notes: "South-facing roof, 5 bed house" },
      { name: "Paula Shaw",     phone: "07833 441441", interest: "Full rewire 3-bed terrace",   source: "website",  notes: "Buying the house — needs cert" },
    ],
    quotes: [
      { clientName: "Gina Torres",  description: "Solar Panels 12kW + Battery Storage", amount: 9800, status: "sent" },
      { clientName: "Owen Drake",   description: "Solar Panels 8kW + Battery",          amount: 7200, status: "viewed" },
      { clientName: "Paula Shaw",   description: "Full Rewire 3-bed + EICR",            amount: 3400, status: "draft" },
    ],
    consent: [
      { clientIndex: 2, treatment: "Full Rewire", status: "signed" },
      { clientIndex: 3, treatment: "Solar Panel Install", status: "sent" },
    ],
  },

  // ─── JOINER ───────────────────────────────────────────────────────────────
  joiner: {
    id: "joiner", name: "Joiner / Carpenter", businessName: "Oak & Co Joinery", emoji: "🪵",
    tagline: "Bespoke kitchens, furniture & fitted wardrobes",
    treatments: [
      { name: "Fitted Kitchen", price: 4500 }, { name: "Fitted Wardrobes", price: 1800 },
      { name: "Decking", price: 2200 }, { name: "Staircase Refurb", price: 1200 },
      { name: "Door Hanging", price: 85 }, { name: "Loft Conversion Joinery", price: 3500 },
    ],
    clients: [
      { name: "Mark & Sarah Owen", email: "mark.owen@gmail.com",  phone: "07711 311311", stage: "vip",      notes: "Full house renovation ongoing. Pay on invoice.", ltv: 12600 },
      { name: "Ian Griffiths",     email: "ian.g@hotmail.com",    phone: "07722 412412", stage: "active",   notes: "Decking + garden room — phase 2 TBC.", ltv: 4200 },
      { name: "Carol Simmons",     email: "carol.s@gmail.com",    phone: "07733 513513", stage: "active",   notes: "Fitted wardrobes in 3 bedrooms.", ltv: 5400 },
      { name: "Ben Whitaker",      email: "ben.w@outlook.com",    phone: "07744 614614", stage: "prospect", notes: "Loft conversion joinery quote requested.", ltv: 0 },
      { name: "Laura Hennessy",    email: "laura.h@gmail.com",    phone: "07755 715715", stage: "active",   notes: "Kitchen refurb — handles and worktops only.", ltv: 980 },
      { name: "Paul Reeves",       email: "paul.r@gmail.com",     phone: "07766 816816", stage: "vip",      notes: "Builder — sends regular subcontract work.", ltv: 22000 },
      { name: "Diane Cooper",      email: "diane.c@yahoo.co.uk",  phone: "07777 917917", stage: "active",   notes: "Staircase spindles and handrail.", ltv: 1200 },
      { name: "Kevin Shaw",        email: "kevin.s@gmail.com",    phone: "07788 018018", stage: "lead",     notes: "Enquired about bespoke bed frame.", ltv: 0 },
      { name: "Alison Barker",     email: "alison.b@gmail.com",   phone: "07799 119119", stage: "lapsed",   notes: "Garage conversion joinery 18 months ago.", ltv: 2800 },
      { name: "Nick Pearson",      email: "nick.p@gmail.com",     phone: "07700 220220", stage: "active",   notes: "Garden office — door and window frames.", ltv: 1600 },
    ],
    bookings: [
      { clientIndex: 0, treatment: "Fitted Kitchen",       date: d(-10), time: "08:00", status: "completed", notes: "Units fitted, worktop templated" },
      { clientIndex: 1, treatment: "Decking",              date: d(-5),  time: "07:30", status: "completed", notes: "Composite decking — 45m²" },
      { clientIndex: 2, treatment: "Fitted Wardrobes",     date: d(5),   time: "08:00", status: "confirmed", notes: "Bedroom 1 of 3" },
      { clientIndex: 4, treatment: "Fitted Kitchen",       date: d(8),   time: "08:00", status: "confirmed", notes: "Handle & worktop replacement only" },
      { clientIndex: 6, treatment: "Staircase Refurb",     date: d(2),   time: "09:00", status: "confirmed", notes: "Spindles and oak handrail" },
      { clientIndex: 9, treatment: "Loft Conversion Joinery", date: d(14), time: "08:00", status: "confirmed", notes: "Staircase + bedroom doors" },
      { clientIndex: 5, treatment: "Door Hanging",         date: d(-2),  time: "08:00", status: "completed", notes: "10 internal doors — subcontract" },
      { clientIndex: 3, treatment: "Loft Conversion Joinery", date: d(21), time: "08:00", status: "confirmed", notes: "Survey done, drawings agreed" },
    ],
    invoices: [
      { clientIndex: 0, description: "Fitted Kitchen — Labour & Fitting",   amount: 4500, vat: true, status: "paid",    daysAgo: 10 },
      { clientIndex: 1, description: "Composite Decking 45m²",              amount: 2200, vat: true, status: "paid",    daysAgo: 5 },
      { clientIndex: 5, description: "Door Hanging x10 (subcontract)",      amount: 850,  vat: true, status: "overdue", daysAgo: 7 },
      { clientIndex: 6, description: "Staircase Refurbishment",             amount: 1200, vat: true, status: "draft",   daysAgo: 0 },
      { clientIndex: 2, description: "Fitted Wardrobes x3 Bedrooms",        amount: 5400, vat: true, status: "paid",    daysAgo: 60 },
    ],
    leads: [
      { name: "Kevin Shaw",     phone: "07788 018018", interest: "Bespoke king size bed frame",   source: "instagram", notes: "Seen our work online" },
      { name: "Ruth Dawson",    phone: "07811 331331", interest: "Garden room / office",          source: "referral",  notes: "Referred by Ian Griffiths" },
      { name: "Tom Healy",      phone: "07822 441441", interest: "Full fitted kitchen",           source: "website",   notes: "Self-builder, wants supply & fit" },
      { name: "Yvonne Clarke",  phone: "07833 551551", interest: "Attic room staircase",         source: "facebook",  notes: "Has planning permission" },
    ],
    quotes: [
      { clientName: "Ben Whitaker",  description: "Loft Conversion Joinery Package",  amount: 3500, status: "sent" },
      { clientName: "Ruth Dawson",   description: "Garden Office — Doors & Windows",  amount: 2800, status: "viewed" },
      { clientName: "Tom Healy",     description: "Fitted Kitchen Supply & Fit",      amount: 6200, status: "draft" },
    ],
    consent: [
      { clientIndex: 0, treatment: "Fitted Kitchen", status: "signed" },
      { clientIndex: 3, treatment: "Loft Conversion Joinery", status: "sent" },
    ],
  },

  // ─── LANDSCAPER ───────────────────────────────────────────────────────────
  landscaper: {
    id: "landscaper", name: "Landscaper / Lawncare", businessName: "GreenScape", emoji: "🌱",
    tagline: "Garden design, maintenance & lawncare",
    treatments: [
      { name: "Full Garden Design", price: 3500 }, { name: "Lawn Treatment Plan", price: 280 },
      { name: "Hedge Cutting", price: 120 }, { name: "Patio / Paving", price: 2800 },
      { name: "Turf Laying", price: 850 }, { name: "Weekly Maintenance", price: 65 },
    ],
    clients: [
      { name: "Robert & Judy Lang", email: "r.lang@gmail.com",    phone: "07711 411411", stage: "vip",      notes: "Large estate — weekly maintenance contract.", ltv: 8400 },
      { name: "Sandra Webb",        email: "sandra.w@sky.com",    phone: "07722 511511", stage: "active",   notes: "Full garden redesign ongoing.", ltv: 3500 },
      { name: "Chris Booth",        email: "chris.b@gmail.com",   phone: "07733 611611", stage: "active",   notes: "Lawn treatment 4x per year.", ltv: 1120 },
      { name: "Jennifer Park",      email: "jen.p@gmail.com",     phone: "07744 711711", stage: "prospect", notes: "New build — wants rear garden landscaping.", ltv: 0 },
      { name: "Alan Nuttall",       email: "alan.n@hotmail.com",  phone: "07755 811811", stage: "active",   notes: "Leylandii hedge cutting annually.", ltv: 480 },
      { name: "Beverley Cross",     email: "bev.c@gmail.com",     phone: "07766 911911", stage: "vip",      notes: "Show garden standard — high expectations.", ltv: 12000 },
      { name: "Darren Hogg",        email: "darren.h@gmail.com",  phone: "07777 011011", stage: "active",   notes: "Patio laid last summer, wants extension.", ltv: 2800 },
      { name: "Eve Madden",         email: "eve.m@yahoo.co.uk",   phone: "07788 112112", stage: "lead",     notes: "Enquired about turf laying for sports lawn.", ltv: 0 },
      { name: "Fred Horton",        email: "fred.h@gmail.com",    phone: "07799 213213", stage: "lapsed",   notes: "Hedge cutting 2 years ago — follow up.", ltv: 240 },
      { name: "Gemma Price",        email: "gemma.p@gmail.com",   phone: "07700 314314", stage: "active",   notes: "Monthly maintenance + lawn treatment.", ltv: 1560 },
    ],
    bookings: [
      { clientIndex: 0, treatment: "Weekly Maintenance",   date: d(1),   time: "08:00", status: "confirmed", notes: "Mow, edge, tidy beds" },
      { clientIndex: 1, treatment: "Full Garden Design",   date: d(3),   time: "09:00", status: "confirmed", notes: "Phase 2 — planting" },
      { clientIndex: 2, treatment: "Lawn Treatment Plan",  date: d(-3),  time: "10:00", status: "completed", notes: "Spring treatment applied" },
      { clientIndex: 4, treatment: "Hedge Cutting",        date: d(7),   time: "08:00", status: "confirmed", notes: "Leylandii — allow full day" },
      { clientIndex: 5, treatment: "Weekly Maintenance",   date: d(1),   time: "11:00", status: "confirmed", notes: "Show garden standard" },
      { clientIndex: 6, treatment: "Patio / Paving",       date: d(14),  time: "07:30", status: "confirmed", notes: "Extension to existing patio" },
      { clientIndex: 9, treatment: "Weekly Maintenance",   date: d(-1),  time: "13:00", status: "completed", notes: "Lawn + borders tidied" },
      { clientIndex: 3, treatment: "Full Garden Design",   date: d(21),  time: "10:00", status: "confirmed", notes: "Site survey — design presentation" },
    ],
    invoices: [
      { clientIndex: 2, description: "Spring Lawn Treatment",          amount: 280,  vat: true, status: "paid",    daysAgo: 3 },
      { clientIndex: 0, description: "Weekly Maintenance — April",     amount: 260,  vat: true, status: "paid",    daysAgo: 5 },
      { clientIndex: 5, description: "Weekly Maintenance — April",     amount: 260,  vat: true, status: "overdue", daysAgo: 12 },
      { clientIndex: 6, description: "Patio Extension Deposit 50%",    amount: 1400, vat: true, status: "paid",    daysAgo: 14 },
      { clientIndex: 1, description: "Garden Design Phase 1",          amount: 3500, vat: true, status: "paid",    daysAgo: 30 },
    ],
    leads: [
      { name: "Eve Madden",     phone: "07788 112112", interest: "Sports lawn turf laying",      source: "referral", notes: "Referred by Chris Booth" },
      { name: "Harry Croft",    phone: "07811 441441", interest: "Full rear garden landscaping", source: "website",  notes: "New build plot — bare earth" },
      { name: "Iris Newton",    phone: "07822 551551", interest: "Wildflower meadow design",     source: "instagram",notes: "Saw our Instagram portfolio" },
      { name: "Joel Carter",    phone: "07833 661661", interest: "Commercial maintenance",       source: "facebook", notes: "Office park — 5 acre grounds" },
    ],
    quotes: [
      { clientName: "Jennifer Park", description: "New Build Garden — Design & Landscape",  amount: 5800, status: "sent" },
      { clientName: "Joel Carter",   description: "Commercial Grounds Maintenance (Annual)", amount: 9600, status: "viewed" },
      { clientName: "Harry Croft",   description: "Full Rear Garden inc. Patio & Lawn",     amount: 4200, status: "draft" },
    ],
    consent: [
      { clientIndex: 1, treatment: "Full Garden Design", status: "signed" },
      { clientIndex: 3, treatment: "New Build Landscaping", status: "sent" },
    ],
  },

  // ─── CPD ACADEMY ─────────────────────────────────────────────────────────
  cpd: {
    id: "cpd", name: "CPD / Training Academy", businessName: "ProCert Academy", emoji: "🎓",
    tagline: "CPD accredited training & certification",
    treatments: [
      { name: "Online CPD Course", price: 400 }, { name: "In-House Training Day", price: 1500 },
      { name: "Certification Package", price: 650 }, { name: "Refresher Course", price: 180 },
      { name: "1:1 Mentorship", price: 120 }, { name: "Assessment & OSCE", price: 250 },
    ],
    clients: [
      { name: "Dr Sarah Miles",     email: "s.miles@medicentre.co.uk", phone: "07711 511511", stage: "vip",      notes: "GP — sends her whole team for training.", ltv: 7800 },
      { name: "Jenny Caldwell",     email: "jenny.c@gmail.com",        phone: "07722 611611", stage: "active",   notes: "Aesthetics nurse, completing advanced module.", ltv: 1050 },
      { name: "Marc Fielding",      email: "marc.f@hotmail.com",       phone: "07733 711711", stage: "active",   notes: "PT expanding into sports massage.", ltv: 760 },
      { name: "Leanne Cross",       email: "leanne.c@gmail.com",       phone: "07744 811811", stage: "prospect", notes: "Newly qualified nurse — interested in aesthetics.", ltv: 0 },
      { name: "Kim Baxter",         email: "kim.b@beautyroom.com",     phone: "07755 911911", stage: "active",   notes: "Beauty salon owner training her team.", ltv: 2600 },
      { name: "Dr Raj Anand",       email: "raj.a@skindr.co.uk",       phone: "07766 011011", stage: "vip",      notes: "Medical director — sends delegates quarterly.", ltv: 14000 },
      { name: "Tara Simmons",       email: "tara.s@gmail.com",         phone: "07777 112112", stage: "active",   notes: "Completed foundation, wants advanced lip filler.", ltv: 400 },
      { name: "Ahmed Hassan",       email: "ahmed.h@gmail.com",        phone: "07788 213213", stage: "lead",     notes: "Dentist — wants facial aesthetics certification.", ltv: 0 },
      { name: "Petra Walsh",        email: "petra.w@outlook.com",      phone: "07799 314314", stage: "lapsed",   notes: "Attended workshop 18 months ago.", ltv: 400 },
      { name: "Owen Marsh",         email: "owen.m@gmail.com",         phone: "07700 415415", stage: "active",   notes: "HCP doing online + in-house combo.", ltv: 1900 },
    ],
    bookings: [
      { clientIndex: 0, treatment: "In-House Training Day",  date: d(7),   time: "09:00", status: "confirmed", notes: "Full team of 6 — venue booked" },
      { clientIndex: 1, treatment: "Assessment & OSCE",      date: d(3),   time: "10:00", status: "confirmed", notes: "Advanced module sign-off" },
      { clientIndex: 2, treatment: "Online CPD Course",      date: d(-5),  time: "09:00", status: "completed", notes: "Sports massage CPD — completed online" },
      { clientIndex: 4, treatment: "In-House Training Day",  date: d(-14), time: "09:00", status: "completed", notes: "3 staff trained — certs issued" },
      { clientIndex: 5, treatment: "Certification Package",  date: d(14),  time: "09:00", status: "confirmed", notes: "Q2 delegate cohort" },
      { clientIndex: 6, treatment: "1:1 Mentorship",         date: d(2),   time: "11:00", status: "confirmed", notes: "Advanced lip filler technique" },
      { clientIndex: 9, treatment: "Refresher Course",       date: d(-2),  time: "10:00", status: "completed", notes: "Annual refresher — all passed" },
      { clientIndex: 3, treatment: "Online CPD Course",      date: d(21),  time: "09:00", status: "confirmed", notes: "Foundation aesthetics online module" },
    ],
    invoices: [
      { clientIndex: 0, description: "In-House Training Day x6 delegates",   amount: 1500, vat: true, status: "paid",    daysAgo: 21 },
      { clientIndex: 4, description: "In-House Training x3 staff",           amount: 750,  vat: true, status: "paid",    daysAgo: 14 },
      { clientIndex: 2, description: "Online CPD — Sports Massage",          amount: 400,  vat: true, status: "paid",    daysAgo: 5 },
      { clientIndex: 5, description: "Q2 Certification Package x8",          amount: 5200, vat: true, status: "overdue", daysAgo: 7 },
      { clientIndex: 9, description: "Refresher Course + Cert",              amount: 180,  vat: true, status: "paid",    daysAgo: 2 },
    ],
    leads: [
      { name: "Ahmed Hassan",    phone: "07788 213213", interest: "Facial aesthetics for dentists",  source: "referral",  notes: "Referred by Dr Raj Anand" },
      { name: "Nina Patel",      phone: "07811 551551", interest: "Foundation aesthetics course",    source: "instagram", notes: "RGN looking to diversify" },
      { name: "Sam Groves",      phone: "07822 661661", interest: "Group booking for dental team",   source: "website",   notes: "5 delegates — wants discount" },
      { name: "Faye Drummond",   phone: "07833 771771", interest: "Online CPD + in-person OSCE",    source: "facebook",  notes: "Aesthetics therapist upskilling" },
    ],
    quotes: [
      { clientName: "Sam Groves",   description: "Group Foundation Course x5 delegates", amount: 1800, status: "sent" },
      { clientName: "Faye Drummond",description: "Online CPD + OSCE Assessment",         amount: 620,  status: "viewed" },
      { clientName: "Kim Baxter",   description: "Annual Team Training Package",          amount: 3000, status: "draft" },
    ],
    consent: [
      { clientIndex: 1, treatment: "Advanced Aesthetics Module", status: "signed" },
      { clientIndex: 3, treatment: "Foundation Aesthetics Online", status: "sent" },
    ],
  },

  // ─── HEALTH & WELLNESS ────────────────────────────────────────────────────
  health: {
    id: "health", name: "Health & Wellness", businessName: "Balance Clinic", emoji: "🏥",
    tagline: "Physiotherapy, sports massage & nutrition",
    treatments: [
      { name: "Initial Assessment", price: 75 }, { name: "Physiotherapy Session", price: 65 },
      { name: "Sports Massage 60min", price: 55 }, { name: "Nutrition Consultation", price: 90 },
      { name: "Pilates Class", price: 18 }, { name: "Home Visit Physio", price: 95 },
    ],
    clients: [
      { name: "Paul Watts",      email: "paul.w@gmail.com",    phone: "07711 611611", stage: "vip",      notes: "Marathon runner — monthly maintenance.", ltv: 1560 },
      { name: "Carol Jennings",  email: "carol.j@sky.com",     phone: "07722 711711", stage: "active",   notes: "Lower back rehab — 8 session plan.", ltv: 595 },
      { name: "Liam Murphy",     email: "liam.m@gmail.com",    phone: "07733 811811", stage: "active",   notes: "Post-op knee — consultant referral.", ltv: 780 },
      { name: "Nina Soloman",    email: "nina.s@outlook.com",  phone: "07744 911911", stage: "prospect", notes: "Weight management + nutrition goals.", ltv: 0 },
      { name: "Barry White",     email: "barry.w@gmail.com",   phone: "07755 011011", stage: "active",   notes: "Corporate client — monthly chair massage.", ltv: 660 },
      { name: "Denise Fowler",   email: "denise.f@gmail.com",  phone: "07766 112112", stage: "vip",      notes: "Pilates 2x per week + monthly physio.", ltv: 2840 },
      { name: "Ethan Grant",     email: "ethan.g@gmail.com",   phone: "07777 213213", stage: "active",   notes: "Rotator cuff injury — 6 session plan.", ltv: 390 },
      { name: "Fiona Kerr",      email: "fiona.k@yahoo.co.uk", phone: "07788 314314", stage: "lead",     notes: "Enquired about postnatal physio.", ltv: 0 },
      { name: "George Nash",     email: "george.n@gmail.com",  phone: "07799 415415", stage: "lapsed",   notes: "Sports massage 10 months ago.", ltv: 220 },
      { name: "Holly Quinn",     email: "holly.q@gmail.com",   phone: "07700 516516", stage: "active",   notes: "Nutrition plan — 3 month programme.", ltv: 270 },
    ],
    bookings: [
      { clientIndex: 0, treatment: "Sports Massage 60min",     date: d(-2),  time: "08:00", status: "completed", notes: "Pre-race flush treatment" },
      { clientIndex: 1, treatment: "Physiotherapy Session",    date: d(1),   time: "10:30", status: "confirmed", notes: "Session 5 of 8 — good progress" },
      { clientIndex: 2, treatment: "Physiotherapy Session",    date: d(3),   time: "14:00", status: "confirmed", notes: "Post-op knee — ROM improving" },
      { clientIndex: 4, treatment: "Sports Massage 60min",     date: d(5),   time: "12:00", status: "confirmed", notes: "Monthly corporate chair massage" },
      { clientIndex: 5, treatment: "Pilates Class",            date: d(2),   time: "09:00", status: "confirmed", notes: "Advanced class — Denise to lead warm-up" },
      { clientIndex: 6, treatment: "Physiotherapy Session",    date: d(4),   time: "11:00", status: "confirmed", notes: "Rotator cuff — session 4 of 6" },
      { clientIndex: 9, treatment: "Nutrition Consultation",   date: d(-1),  time: "13:00", status: "completed", notes: "Month 2 review — on track" },
      { clientIndex: 3, treatment: "Initial Assessment",       date: d(7),   time: "10:00", status: "confirmed", notes: "Weight management — first visit" },
    ],
    invoices: [
      { clientIndex: 0, description: "Sports Massage x4 (Block)",        amount: 220,  vat: false, status: "paid",    daysAgo: 7 },
      { clientIndex: 1, description: "Physio x8 Session Plan",           amount: 520,  vat: false, status: "paid",    daysAgo: 14 },
      { clientIndex: 4, description: "Corporate Massage — April",        amount: 165,  vat: false, status: "overdue", daysAgo: 10 },
      { clientIndex: 5, description: "Pilates Block x10 + Monthly Physio",amount: 275, vat: false, status: "paid",    daysAgo: 21 },
      { clientIndex: 9, description: "Nutrition Programme — Month 2",    amount: 90,   vat: false, status: "paid",    daysAgo: 1 },
    ],
    leads: [
      { name: "Fiona Kerr",    phone: "07788 314314", interest: "Postnatal physio",               source: "referral",  notes: "Referred by Carol Jennings" },
      { name: "Ian Powell",    phone: "07811 661661", interest: "Sports massage for cyclists",    source: "instagram", notes: "Training for Ironman" },
      { name: "Jan Leigh",     phone: "07822 771771", interest: "Nutrition + weight management",  source: "website",   notes: "Type 2 diabetes management" },
      { name: "Karl Stone",    phone: "07833 881881", interest: "Chronic lower back pain",        source: "facebook",  notes: "GP referral pathway" },
    ],
    quotes: [
      { clientName: "Nina Soloman",  description: "12-Week Nutrition Programme",           amount: 360,  status: "sent" },
      { clientName: "Karl Stone",    description: "Physio Assessment + 6 Session Plan",    amount: 465,  status: "viewed" },
      { clientName: "Barry White",   description: "Annual Corporate Massage Contract",      amount: 1980, status: "draft" },
    ],
    consent: [
      { clientIndex: 2, treatment: "Post-Op Physiotherapy", status: "signed" },
      { clientIndex: 3, treatment: "Initial Health Assessment", status: "sent" },
    ],
  },

  // ─── BRICKLAYER ───────────────────────────────────────────────────────────
  builder: {
    id: "builder", name: "Builder / Bricklayer", businessName: "Solid Build Co", emoji: "🧱",
    tagline: "Extensions, groundwork & brickwork",
    treatments: [
      { name: "Single Storey Extension", price: 28000 }, { name: "Repointing", price: 1200 },
      { name: "Garden Wall", price: 2400 }, { name: "Driveway", price: 4500 },
      { name: "Porch Build", price: 6500 }, { name: "Groundwork & Foundations", price: 8000 },
    ],
    clients: [
      { name: "Tony Marsden",    email: "tony.m@gmail.com",    phone: "07711 711711", stage: "vip",      notes: "Developer — 2 houses per year. Pays on time.", ltv: 64000 },
      { name: "Helen & John Cross",email:"h.cross@gmail.com",  phone: "07722 811811", stage: "active",   notes: "Rear extension — planning approved.", ltv: 28000 },
      { name: "Mike Hughes",     email: "mike.h@hotmail.com",  phone: "07733 911911", stage: "active",   notes: "Repointing front elevation + chimney.", ltv: 2400 },
      { name: "Sarah Doyle",     email: "sarah.d@gmail.com",   phone: "07744 011011", stage: "prospect", notes: "Wants porch and driveway combo.", ltv: 0 },
      { name: "Ron Fielding",    email: "ron.f@outlook.com",   phone: "07755 112112", stage: "active",   notes: "Garden wall — 12m boundary.", ltv: 2400 },
      { name: "Anita Kapoor",    email: "anita.k@gmail.com",   phone: "07766 213213", stage: "vip",      notes: "Architect — sends commercial work.", ltv: 95000 },
      { name: "Pat Lynch",       email: "pat.l@yahoo.co.uk",   phone: "07777 314314", stage: "active",   notes: "Groundwork for self-build garage.", ltv: 8000 },
      { name: "Gavin Booth",     email: "gavin.b@gmail.com",   phone: "07788 415415", stage: "lead",     notes: "Wants single storey kitchen extension.", ltv: 0 },
      { name: "Mo Hassan",       email: "mo.h@gmail.com",      phone: "07799 516516", stage: "lapsed",   notes: "Garden wall 2 years ago — follow up.", ltv: 2400 },
      { name: "Sue Brennan",     email: "sue.b@gmail.com",     phone: "07700 617617", stage: "active",   notes: "Driveway block paving — started.", ltv: 4500 },
    ],
    bookings: [
      { clientIndex: 1, treatment: "Single Storey Extension", date: d(-21), time: "07:30", status: "completed", notes: "Blockwork complete — roof next" },
      { clientIndex: 2, treatment: "Repointing",              date: d(4),   time: "08:00", status: "confirmed", notes: "Front elevation + chimney stack" },
      { clientIndex: 4, treatment: "Garden Wall",             date: d(7),   time: "07:30", status: "confirmed", notes: "12m boundary wall — footings done" },
      { clientIndex: 6, treatment: "Groundwork & Foundations",date: d(-5),  time: "07:00", status: "completed", notes: "Garage footings poured" },
      { clientIndex: 9, treatment: "Driveway",                date: d(2),   time: "08:00", status: "confirmed", notes: "Block paving — day 2" },
      { clientIndex: 0, treatment: "Single Storey Extension", date: d(14),  time: "07:30", status: "confirmed", notes: "Plot 3 — start date agreed" },
      { clientIndex: 3, treatment: "Porch Build",             date: d(21),  time: "08:00", status: "confirmed", notes: "Porch + driveway combo" },
      { clientIndex: 5, treatment: "Groundwork & Foundations",date: d(28),  time: "07:00", status: "confirmed", notes: "Commercial — architect spec" },
    ],
    invoices: [
      { clientIndex: 1, description: "Extension — Blockwork Stage",           amount: 9500,  vat: true, status: "paid",    daysAgo: 21 },
      { clientIndex: 6, description: "Garage Groundwork & Foundations",       amount: 8000,  vat: true, status: "paid",    daysAgo: 5 },
      { clientIndex: 9, description: "Driveway Block Paving 50% deposit",     amount: 2250,  vat: true, status: "paid",    daysAgo: 14 },
      { clientIndex: 2, description: "Repointing — deposit",                  amount: 600,   vat: true, status: "overdue", daysAgo: 10 },
      { clientIndex: 0, description: "Plot 2 — Final Stage Payment",          amount: 14000, vat: true, status: "paid",    daysAgo: 30 },
    ],
    leads: [
      { name: "Gavin Booth",   phone: "07788 415415", interest: "Single storey kitchen extension",  source: "referral",  notes: "Referred by Helen Cross" },
      { name: "Lisa Moody",    phone: "07811 771771", interest: "Double garage build",              source: "website",   notes: "Has planning, needs builder" },
      { name: "Noel Grant",    phone: "07822 881881", interest: "Full house render + repoint",      source: "facebook",  notes: "Victorian terrace — large job" },
      { name: "Owen Baxter",   phone: "07833 991991", interest: "Rear extension + loft",            source: "referral",  notes: "Architect already appointed" },
    ],
    quotes: [
      { clientName: "Gavin Booth",  description: "Single Storey Extension — Supply & Build", amount: 28000, status: "sent" },
      { clientName: "Sarah Doyle",  description: "Porch + Block Paving Driveway",            amount: 11000, status: "viewed" },
      { clientName: "Lisa Moody",   description: "Double Garage Build",                      amount: 18500, status: "draft" },
    ],
    consent: [
      { clientIndex: 1, treatment: "Single Storey Extension", status: "signed" },
      { clientIndex: 3, treatment: "Porch + Driveway", status: "sent" },
    ],
  },
};
