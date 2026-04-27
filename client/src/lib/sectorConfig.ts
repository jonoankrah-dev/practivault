/**
 * PractiVault — Sector & Sub-industry Config
 * Two-level picker: 10 broad sectors → specific sub-industries.
 * Each sub-industry maps to an industryConfig key (or inherits sector defaults).
 * Keeps the app lean — no new pages, just config.
 */

export interface SubIndustry {
  id: string;           // Maps to INDUSTRY_CONFIGS key
  label: string;        // Display name
  emoji: string;
  tagline: string;
  seedKey: string;      // Which demo dataset to use (maps to DEMO_INDUSTRIES)
}

export interface Sector {
  id: string;
  label: string;
  emoji: string;
  colour: string;       // Tailwind gradient classes for the sector card
  accentText: string;   // Tailwind text colour class
  borderHover: string;
  description: string;
  subIndustries: SubIndustry[];
}

export const SECTORS: Sector[] = [

  // ── 💆 Beauty & Personal Care ─────────────────────────────────────────────
  {
    id: "beauty",
    label: "Beauty & Personal Care",
    emoji: "💆",
    colour: "from-pink-50 to-rose-50 border-pink-200 hover:border-pink-400",
    accentText: "text-rose-600",
    borderHover: "border-pink-400",
    description: "Salons, clinics & personal treatments",
    subIndustries: [
      { id: "aesthetics",   label: "Medical Aesthetics",    emoji: "🌿", tagline: "Botox, fillers, laser & skin",         seedKey: "aesthetics" },
      { id: "hair",         label: "Hair & Nail Salon",     emoji: "💇", tagline: "Cuts, colour, extensions & nails",    seedKey: "hair" },
      { id: "beauty-spa",   label: "Beauty & Spa",          emoji: "🧖", tagline: "Facials, massages & body treatments", seedKey: "aesthetics" },
      { id: "lash-brow",    label: "Lash & Brow Studio",    emoji: "👁️", tagline: "Lash lifts, brow lamination & HD",   seedKey: "hair" },
      { id: "tanning",      label: "Tanning & Spray Tan",   emoji: "☀️", tagline: "Spray tans, sunbeds & bronzing",     seedKey: "aesthetics" },
      { id: "tattoo",       label: "Tattoo & Piercing",     emoji: "🖊️", tagline: "Ink, piercings & body art",         seedKey: "aesthetics" },
      { id: "barbershop",   label: "Barbershop",            emoji: "✂️", tagline: "Cuts, fades, shaves & grooming",    seedKey: "hair" },
      { id: "makeup",       label: "Makeup Artist",         emoji: "💄", tagline: "Bridal, events & editorial makeup",  seedKey: "hair" },
    ],
  },

  // ── 🏥 Health & Wellbeing ─────────────────────────────────────────────────
  {
    id: "health",
    label: "Health & Wellbeing",
    emoji: "🏥",
    colour: "from-teal-50 to-cyan-50 border-teal-200 hover:border-teal-400",
    accentText: "text-teal-700",
    borderHover: "border-teal-400",
    description: "Clinical, therapy & wellness services",
    subIndustries: [
      { id: "health",         label: "Physiotherapy",         emoji: "🏥", tagline: "Physio, rehab & injury treatment",    seedKey: "health" },
      { id: "massage",        label: "Massage Therapy",       emoji: "🤲", tagline: "Sports, deep tissue & holistic",      seedKey: "health" },
      { id: "dentist",        label: "Dentistry",             emoji: "🦷", tagline: "Check-ups, hygiene & cosmetic",       seedKey: "health" },
      { id: "optician",       label: "Optician",              emoji: "👓", tagline: "Eye tests, glasses & contact lenses", seedKey: "health" },
      { id: "counselling",    label: "Counselling & Therapy", emoji: "🧠", tagline: "Mental health, CBT & psychotherapy",  seedKey: "health" },
      { id: "chiropractic",   label: "Chiropractic & Osteo",  emoji: "🦴", tagline: "Spinal care, manipulation & joints", seedKey: "health" },
      { id: "podiatry",       label: "Podiatry & Footcare",   emoji: "🦶", tagline: "Foot health, orthotics & chiropody", seedKey: "health" },
      { id: "nutrition",      label: "Nutrition & Dietitian", emoji: "🥗", tagline: "Dietary plans, weight & wellness",    seedKey: "health" },
      { id: "acupuncture",    label: "Acupuncture & TCM",     emoji: "🪡", tagline: "Traditional Chinese medicine",        seedKey: "health" },
    ],
  },

  // ── 🔧 Trades & Construction ──────────────────────────────────────────────
  {
    id: "trades",
    label: "Trades & Construction",
    emoji: "🔧",
    colour: "from-blue-50 to-slate-50 border-blue-200 hover:border-blue-400",
    accentText: "text-blue-700",
    borderHover: "border-blue-400",
    description: "Skilled trades, building & installation",
    subIndustries: [
      { id: "plumber",      label: "Plumbing",              emoji: "🔧", tagline: "Boilers, leaks & installations",      seedKey: "plumber" },
      { id: "electrician",  label: "Electrician",           emoji: "⚡", tagline: "Rewires, consumer units & EV",        seedKey: "electrician" },
      { id: "builder",      label: "Builder & Bricklayer",  emoji: "🧱", tagline: "Extensions, groundwork & blockwork",  seedKey: "builder" },
      { id: "joiner",       label: "Joiner & Carpenter",    emoji: "🪵", tagline: "Kitchens, wardrobes & staircases",    seedKey: "joiner" },
      { id: "hvac",         label: "HVAC & Gas Engineer",   emoji: "❄️", tagline: "Heating, cooling & gas servicing",   seedKey: "hvac" },
      { id: "roofer",       label: "Roofer",                emoji: "🏠", tagline: "Repairs, replacements & guttering",  seedKey: "builder" },
      { id: "plasterer",    label: "Plasterer",             emoji: "🪣", tagline: "Plastering, rendering & coving",     seedKey: "builder" },
      { id: "tiler",        label: "Tiler",                 emoji: "🟫", tagline: "Floor, wall & bathroom tiling",      seedKey: "builder" },
      { id: "glazier",      label: "Glazier & Windows",     emoji: "🪟", tagline: "Double glazing, doors & conservatories", seedKey: "builder" },
    ],
  },

  // ── 🌱 Outdoor & Environmental ────────────────────────────────────────────
  {
    id: "outdoor",
    label: "Outdoor & Environmental",
    emoji: "🌱",
    colour: "from-green-50 to-emerald-50 border-green-200 hover:border-green-400",
    accentText: "text-green-700",
    borderHover: "border-green-400",
    description: "Grounds, gardens & outdoor services",
    subIndustries: [
      { id: "landscaper",   label: "Landscaper",            emoji: "🌱", tagline: "Garden design & transformation",     seedKey: "landscaper" },
      { id: "lawncare",     label: "Lawncare",              emoji: "🌿", tagline: "Treatments, mowing & lawn health",   seedKey: "landscaper" },
      { id: "tree-surgeon", label: "Tree Surgeon",          emoji: "🌳", tagline: "Felling, pruning & stump removal",   seedKey: "landscaper" },
      { id: "pest-control", label: "Pest Control",          emoji: "🐀", tagline: "Rodents, insects & bird proofing",   seedKey: "landscaper" },
      { id: "window-clean", label: "Window Cleaning",       emoji: "🪣", tagline: "Residential & commercial cleaning",  seedKey: "landscaper" },
      { id: "pressure-wash",label: "Pressure Washing",      emoji: "💧", tagline: "Driveways, patios & fascias",        seedKey: "landscaper" },
      { id: "skip-waste",   label: "Skip & Waste Removal",  emoji: "🗑️", tagline: "Skip hire, clearances & recycling", seedKey: "landscaper" },
    ],
  },

  // ── 🎓 Education & Training ───────────────────────────────────────────────
  {
    id: "education",
    label: "Education & Training",
    emoji: "🎓",
    colour: "from-indigo-50 to-violet-50 border-indigo-200 hover:border-indigo-400",
    accentText: "text-indigo-700",
    borderHover: "border-indigo-400",
    description: "Teaching, CPD & professional development",
    subIndustries: [
      { id: "cpd",           label: "CPD & Training Academy", emoji: "🎓", tagline: "Professional courses & certification", seedKey: "cpd" },
      { id: "tutor",         label: "Private Tutor",          emoji: "📚", tagline: "1-to-1 & group tuition all subjects", seedKey: "cpd" },
      { id: "driving",       label: "Driving Instructor",     emoji: "🚗", tagline: "Lessons, theory & intensive courses", seedKey: "cpd" },
      { id: "music",         label: "Music Teacher",          emoji: "🎵", tagline: "Instruments, grades & performance",   seedKey: "cpd" },
      { id: "language",      label: "Language School",        emoji: "🌍", tagline: "ESOL, conversational & exam prep",    seedKey: "cpd" },
      { id: "fitness-pt",    label: "Personal Trainer",       emoji: "🏋️", tagline: "1-to-1 training & fitness coaching", seedKey: "health" },
      { id: "life-coach",    label: "Life & Business Coach",  emoji: "🧭", tagline: "Coaching, mindset & goal setting",    seedKey: "cpd" },
    ],
  },

  // ── 🍽️ Food & Hospitality ─────────────────────────────────────────────────
  {
    id: "hospitality",
    label: "Food & Hospitality",
    emoji: "🍽️",
    colour: "from-orange-50 to-amber-50 border-orange-200 hover:border-orange-400",
    accentText: "text-orange-700",
    borderHover: "border-orange-400",
    description: "Catering, events & food businesses",
    subIndustries: [
      { id: "caterer",       label: "Caterer",               emoji: "🍽️", tagline: "Events, weddings & corporate dining", seedKey: "cpd" },
      { id: "mobile-bar",    label: "Mobile Bar",            emoji: "🍹", tagline: "Cocktails, prosecco & events bars",   seedKey: "cpd" },
      { id: "personal-chef", label: "Personal Chef",         emoji: "👨‍🍳", tagline: "Private dining & meal prep services", seedKey: "cpd" },
      { id: "food-truck",    label: "Food Truck & Street",   emoji: "🚚", tagline: "Street food, markets & festivals",    seedKey: "cpd" },
      { id: "cake-baker",    label: "Baker & Cake Maker",    emoji: "🎂", tagline: "Custom cakes, bakes & celebration",   seedKey: "hair" },
      { id: "wedding-plan",  label: "Wedding Planner",       emoji: "💒", tagline: "Full-service wedding coordination",   seedKey: "cpd" },
      { id: "events",        label: "Events Manager",        emoji: "🎉", tagline: "Corporate, private & venue events",   seedKey: "cpd" },
    ],
  },

  // ── 💼 Professional Services ──────────────────────────────────────────────
  {
    id: "professional",
    label: "Professional Services",
    emoji: "💼",
    colour: "from-slate-50 to-gray-50 border-slate-200 hover:border-slate-400",
    accentText: "text-slate-700",
    borderHover: "border-slate-400",
    description: "Consulting, legal, finance & B2B",
    subIndustries: [
      { id: "accountant",    label: "Accountant & Bookkeeper",emoji: "📊", tagline: "Accounts, tax returns & payroll",     seedKey: "cpd" },
      { id: "solicitor",     label: "Solicitor & Legal",      emoji: "⚖️", tagline: "Conveyancing, wills & contracts",    seedKey: "cpd" },
      { id: "architect",     label: "Architect & Designer",   emoji: "🏛️", tagline: "Plans, planning permission & design", seedKey: "cpd" },
      { id: "consultant",    label: "Business Consultant",    emoji: "💼", tagline: "Strategy, growth & advisory services",seedKey: "cpd" },
      { id: "hr-recruit",    label: "HR & Recruitment",       emoji: "🤝", tagline: "Staffing, HR & people management",    seedKey: "cpd" },
      { id: "marketing-ag",  label: "Marketing Agency",       emoji: "📣", tagline: "Campaigns, SEO & brand strategy",     seedKey: "cpd" },
      { id: "insurance",     label: "Insurance Broker",       emoji: "🛡️", tagline: "Cover, claims & risk management",    seedKey: "cpd" },
      { id: "mortgage",      label: "Mortgage Broker",        emoji: "🏡", tagline: "Mortgages, remortgages & finance",    seedKey: "cpd" },
    ],
  },

  // ── 🏋️ Fitness & Recreation ───────────────────────────────────────────────
  {
    id: "fitness",
    label: "Fitness & Recreation",
    emoji: "🏋️",
    colour: "from-red-50 to-orange-50 border-red-200 hover:border-red-400",
    accentText: "text-red-700",
    borderHover: "border-red-400",
    description: "Sports, fitness & leisure activities",
    subIndustries: [
      { id: "personal-train",label: "Personal Trainer",      emoji: "🏋️", tagline: "Gym, outdoor & online PT sessions",  seedKey: "health" },
      { id: "yoga-pilates",  label: "Yoga & Pilates",        emoji: "🧘", tagline: "Studio, mat & online classes",        seedKey: "health" },
      { id: "sports-coach",  label: "Sports Coach",          emoji: "⚽", tagline: "Team & individual sports coaching",   seedKey: "health" },
      { id: "swim-coach",    label: "Swimming Coach",        emoji: "🏊", tagline: "Lessons, squads & technique",         seedKey: "health" },
      { id: "martial-arts",  label: "Martial Arts",          emoji: "🥋", tagline: "Classes, gradings & competitions",    seedKey: "cpd" },
      { id: "dance",         label: "Dance Studio",          emoji: "💃", tagline: "Classes, shows & dance exams",        seedKey: "cpd" },
      { id: "gym",           label: "Gym & Fitness Studio",  emoji: "🏟️", tagline: "Memberships, classes & PT",          seedKey: "health" },
    ],
  },

  // ── 🖥️ Tech, Creative & Media ─────────────────────────────────────────────
  {
    id: "creative",
    label: "Tech, Creative & Media",
    emoji: "🖥️",
    colour: "from-violet-50 to-purple-50 border-violet-200 hover:border-violet-400",
    accentText: "text-violet-700",
    borderHover: "border-violet-400",
    description: "Digital, design & creative professionals",
    subIndustries: [
      { id: "photographer",  label: "Photographer",          emoji: "📸", tagline: "Portraits, events & commercial",      seedKey: "hair" },
      { id: "videographer",  label: "Videographer",          emoji: "🎬", tagline: "Weddings, promos & social content",   seedKey: "cpd" },
      { id: "web-dev",       label: "Web Developer",         emoji: "💻", tagline: "Websites, apps & e-commerce",         seedKey: "cpd" },
      { id: "graphic-design",label: "Graphic Designer",      emoji: "🎨", tagline: "Brand identity, print & digital",     seedKey: "cpd" },
      { id: "social-media",  label: "Social Media Manager",  emoji: "📱", tagline: "Content, ads & community management", seedKey: "cpd" },
      { id: "copywriter",    label: "Copywriter & SEO",      emoji: "✍️", tagline: "Content, blogs & search marketing",  seedKey: "cpd" },
      { id: "it-support",    label: "IT Support",            emoji: "🖥️", tagline: "Networks, repairs & cyber security", seedKey: "hvac" },
    ],
  },

  // ── 🏢 Other Service Business ─────────────────────────────────────────────
  {
    id: "other",
    label: "Other Service Business",
    emoji: "🏢",
    colour: "from-stone-50 to-neutral-50 border-stone-200 hover:border-stone-400",
    accentText: "text-stone-700",
    borderHover: "border-stone-400",
    description: "Any service business not listed above",
    subIndustries: [
      { id: "cleaner",       label: "Cleaning Service",      emoji: "🧹", tagline: "Domestic, commercial & end of tenancy", seedKey: "landscaper" },
      { id: "dog-groomer",   label: "Dog Groomer",           emoji: "🐕", tagline: "Grooming, styling & pet care",         seedKey: "hair" },
      { id: "childcare",     label: "Childcare & Nursery",   emoji: "👶", tagline: "Childminding, after-school & care",    seedKey: "health" },
      { id: "funeral",       label: "Funeral Director",      emoji: "🕊️", tagline: "Funerals, memorials & bereavement",   seedKey: "health" },
      { id: "property-mgt",  label: "Property Management",   emoji: "🏠", tagline: "Lettings, maintenance & tenancies",    seedKey: "cpd" },
      { id: "courier",       label: "Courier & Delivery",    emoji: "📦", tagline: "Same-day, logistics & collections",    seedKey: "landscaper" },
      { id: "security",      label: "Security Services",     emoji: "🔒", tagline: "CCTV, manned guarding & alarms",      seedKey: "builder" },
      { id: "default",       label: "General Business",      emoji: "🏢", tagline: "Any service business — fully flexible",seedKey: "aesthetics" },
    ],
  },
];

// Helper — look up sector by sub-industry id
export function getSectorForIndustry(industryId: string): Sector | undefined {
  return SECTORS.find(s => s.subIndustries.some(sub => sub.id === industryId));
}

// Helper — look up sub-industry by id
export function getSubIndustry(industryId: string): SubIndustry | undefined {
  for (const sector of SECTORS) {
    const sub = sector.subIndustries.find(s => s.id === industryId);
    if (sub) return sub;
  }
  return undefined;
}
