/**
 * PractiVault — Industry Configuration
 * Defines colours, vocabulary, sidebar nav, and characteristics per industry.
 * This is the single source of truth for all industry personalisation.
 */

import {
  LayoutDashboard, CalendarDays, Users, Sparkles, FileText,
  ShieldCheck, Settings, MessageSquare, Camera, Phone, BookOpen,
  ImageIcon, Receipt, Users2, Video, Package, GraduationCap,
  MapPin, Warehouse, Wrench, HardHat, Zap, Leaf, ClipboardList,
  HeartPulse, Hammer, Wind, Bot, Building2,
} from "lucide-react";

export type NavItemDef = {
  href: string;
  label: string;
  icon: any;
  badgeKey?: "newLeads" | "pipelineValue" | "pendingConsent" | "afdToday" | "missedCallsToday";
};

export interface IndustryConfig {
  id: string;
  name: string;
  emoji: string;
  // Colour theme
  primaryHex: string;       // Main brand colour (sidebar active, buttons)
  primaryHsl: string;       // HSL for CSS variable injection e.g. "330 57% 44%"
  accentHex: string;        // Secondary accent
  accentHsl: string;
  sidebarBg: string;        // Sidebar background hex
  sidebarFg: string;        // Sidebar text hex
  // Vocabulary
  labels: {
    bookings: string;       // "Jobs" | "Appointments" | "Sessions"
    clients: string;        // "Customers" | "Clients" | "Students"
    leads: string;          // "Enquiries" | "Leads"
    quotes: string;         // "Quotes" | "Proposals"
    consent: string;        // "Risk Assessment" | "Consent Forms" | "Enrollment"
    invoices: string;       // "Invoices" always but kept for completeness
    dashboard: string;      // "Dashboard" always
    stock: string;          // "Stock" | "Materials" | "Supplies"
  };
  // Sidebar nav — ordered list of items to show
  nav: NavItemDef[];
}

// ─── Shared nav item definitions ─────────────────────────────────────────────

const NAV = {
  dashboard:   { href: "/dashboard",        label: "Dashboard",       icon: LayoutDashboard },
  bookings:    { href: "/bookings",         label: "Bookings",        icon: CalendarDays,   badgeKey: undefined },
  jobs:        { href: "/bookings",         label: "Jobs",            icon: Wrench,         badgeKey: undefined },
  appointments:{ href: "/bookings",         label: "Appointments",    icon: CalendarDays,   badgeKey: undefined },
  sessions:    { href: "/bookings",         label: "Sessions",        icon: CalendarDays,   badgeKey: undefined },
  clients:     { href: "/clients",          label: "Clients",         icon: Users },
  customers:   { href: "/clients",          label: "Customers",       icon: Users },
  students:    { href: "/clients",          label: "Students",        icon: Users },
  patients:    { href: "/clients",          label: "Patients",        icon: Users },
  safi:        { href: "/safi",             label: "Safi AI",         icon: Bot },
  aiFrontDesk: { href: "/ai-front-desk",   label: "AI Front Desk",   icon: MessageSquare,  badgeKey: "afdToday" },
  aiPhone:     { href: "/phone-receptionist",label:"AI Receptionist", icon: Phone,          badgeKey: "missedCallsToday" },
  social:      { href: "/social-studio",    label: "Social Studio",   icon: Camera },
  leads:       { href: "/leads",            label: "Leads",           icon: Sparkles,       badgeKey: "newLeads" },
  enquiries:   { href: "/leads",            label: "Enquiries",       icon: Sparkles,       badgeKey: "newLeads" },
  quotes:      { href: "/quotes",           label: "Quotes",          icon: FileText,       badgeKey: "pipelineValue" },
  proposals:   { href: "/quotes",           label: "Proposals",       icon: FileText,       badgeKey: "pipelineValue" },
  consent:     { href: "/consent",          label: "Consent Forms",   icon: ShieldCheck,    badgeKey: "pendingConsent" },
  riskAssess:  { href: "/consent",          label: "Risk Assessment", icon: ClipboardList,  badgeKey: "pendingConsent" },
  enrollment:  { href: "/consent",          label: "Enrollment",      icon: ClipboardList,  badgeKey: "pendingConsent" },
  team:        { href: "/team",             label: "Team",            icon: Users2 },
  invoices:    { href: "/invoices",         label: "Invoices",        icon: Receipt },
  photos:      { href: "/photos",           label: "Before & After",  icon: ImageIcon },
  manuals:     { href: "/manuals",          label: "Manuals",         icon: BookOpen },
  videos:      { href: "/videos",           label: "Training Videos", icon: Video },
  packages:    { href: "/packages",         label: "Packages",        icon: Package },
  stock:       { href: "/stock",            label: "Stock",           icon: Warehouse },
  materials:   { href: "/stock",            label: "Materials",       icon: Warehouse },
  cpd:         { href: "/cpd",              label: "CPD Log",         icon: GraduationCap },
  locations:   { href: "/locations",        label: "Locations",       icon: MapPin },
  settings:    { href: "/settings",         label: "Settings",        icon: Settings },
  businessInfo:{ href: "/business-info",    label: "Business Info",   icon: Building2 },
} as const;

// ─── Industry configs ─────────────────────────────────────────────────────────

export const INDUSTRY_CONFIGS: Record<string, IndustryConfig> = {

  // ── Aesthetics & Beauty ──────────────────────────────────────────────────
  aesthetics: {
    id: "aesthetics", name: "Aesthetics & Beauty", emoji: "🌿",
    primaryHex: "#b1306f", primaryHsl: "330 57% 44%",
    accentHex: "#0d6b67",  accentHsl: "178 79% 23%",
    sidebarBg: "#1a0d13",  sidebarFg: "#f9e8f0",
    labels: {
      bookings: "Appointments", clients: "Clients", leads: "Leads",
      quotes: "Quotes", consent: "Consent Forms", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Stock",
    },
    nav: [
      NAV.dashboard, NAV.appointments, NAV.clients,
      NAV.safi, NAV.social,
      NAV.leads, NAV.quotes, NAV.consent,
      NAV.team, NAV.invoices, NAV.photos,
      NAV.manuals, NAV.videos, NAV.packages,
      NAV.stock, NAV.cpd, NAV.locations,
      NAV.businessInfo, NAV.settings,
    ],
  },

  // ── Hair & Nail ──────────────────────────────────────────────────────────
  hair: {
    id: "hair", name: "Hair & Nail Salon", emoji: "💇",
    primaryHex: "#7c3aed", primaryHsl: "263 65% 57%",
    accentHex: "#c026d3",  accentHsl: "292 91% 49%",
    sidebarBg: "#150d1f",  sidebarFg: "#f3eeff",
    labels: {
      bookings: "Appointments", clients: "Clients", leads: "Leads",
      quotes: "Quotes", consent: "Consent Forms", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Products",
    },
    nav: [
      NAV.dashboard, NAV.appointments, NAV.clients,
      NAV.safi, NAV.social,
      NAV.leads, NAV.quotes, NAV.consent,
      NAV.team, NAV.invoices, NAV.photos,
      NAV.stock, NAV.cpd, NAV.locations, NAV.settings,
    ],
  },

  // ── Plumbing ─────────────────────────────────────────────────────────────
  plumber: {
    id: "plumber", name: "Plumbing", emoji: "🔧",
    primaryHex: "#b45309", primaryHsl: "32 93% 36%",
    accentHex: "#1e40af",  accentHsl: "226 71% 40%",
    sidebarBg: "#0f1a2e",  sidebarFg: "#e8f0ff",
    labels: {
      bookings: "Jobs", clients: "Customers", leads: "Enquiries",
      quotes: "Quotes", consent: "Risk Assessment", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Materials",
    },
    nav: [
      NAV.dashboard, NAV.jobs, NAV.customers,
      NAV.safi,
      NAV.enquiries, NAV.quotes, NAV.riskAssess,
      NAV.team, NAV.invoices, NAV.materials,
      NAV.manuals, NAV.locations, NAV.settings,
    ],
  },

  // ── Electrician ──────────────────────────────────────────────────────────
  electrician: {
    id: "electrician", name: "Electrician", emoji: "⚡",
    primaryHex: "#d97706", primaryHsl: "38 92% 45%",
    accentHex: "#374151",  accentHsl: "220 13% 26%",
    sidebarBg: "#1a1500",  sidebarFg: "#fff9e6",
    labels: {
      bookings: "Jobs", clients: "Customers", leads: "Enquiries",
      quotes: "Quotes", consent: "Risk Assessment", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Materials",
    },
    nav: [
      NAV.dashboard, NAV.jobs, NAV.customers,
      NAV.safi,
      NAV.enquiries, NAV.quotes, NAV.riskAssess,
      NAV.team, NAV.invoices, NAV.materials,
      NAV.manuals, NAV.locations, NAV.settings,
    ],
  },

  // ── Joiner & Carpenter ───────────────────────────────────────────────────
  joiner: {
    id: "joiner", name: "Joiner & Carpenter", emoji: "🪵",
    primaryHex: "#92400e", primaryHsl: "25 94% 31%",
    accentHex: "#16a34a",  accentHsl: "142 72% 37%",
    sidebarBg: "#1a0e00",  sidebarFg: "#fff3e6",
    labels: {
      bookings: "Jobs", clients: "Customers", leads: "Enquiries",
      quotes: "Quotes", consent: "Risk Assessment", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Materials",
    },
    nav: [
      NAV.dashboard, NAV.jobs, NAV.customers,
      NAV.safi,
      NAV.enquiries, NAV.quotes, NAV.riskAssess,
      NAV.team, NAV.invoices, NAV.materials,
      NAV.manuals, NAV.locations, NAV.settings,
    ],
  },

  // ── Landscaper & Lawncare ────────────────────────────────────────────────
  landscaper: {
    id: "landscaper", name: "Landscaper & Lawncare", emoji: "🌱",
    primaryHex: "#16a34a", primaryHsl: "142 72% 37%",
    accentHex: "#713f12",  accentHsl: "30 74% 26%",
    sidebarBg: "#071a0e",  sidebarFg: "#e8fdf0",
    labels: {
      bookings: "Jobs", clients: "Customers", leads: "Enquiries",
      quotes: "Quotes", consent: "Risk Assessment", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Materials",
    },
    nav: [
      NAV.dashboard, NAV.jobs, NAV.customers,
      NAV.safi, NAV.social,
      NAV.enquiries, NAV.quotes,
      NAV.team, NAV.invoices, NAV.materials,
      NAV.locations, NAV.settings,
    ],
  },

  // ── CPD & Training Academy ───────────────────────────────────────────────
  cpd: {
    id: "cpd", name: "CPD & Training Academy", emoji: "🎓",
    primaryHex: "#4338ca", primaryHsl: "244 63% 51%",
    accentHex: "#0284c7",  accentHsl: "199 89% 40%",
    sidebarBg: "#0d0d2b",  sidebarFg: "#eef0ff",
    labels: {
      bookings: "Sessions", clients: "Students", leads: "Enquiries",
      quotes: "Proposals", consent: "Enrollment", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Supplies",
    },
    nav: [
      NAV.dashboard, NAV.sessions, NAV.students,
      NAV.safi, NAV.social,
      NAV.enquiries, NAV.proposals, NAV.enrollment,
      NAV.team, NAV.invoices,
      NAV.videos, NAV.packages,
      NAV.cpd, NAV.locations, NAV.settings,
    ],
  },

  // ── Health & Wellness ────────────────────────────────────────────────────
  health: {
    id: "health", name: "Health & Wellness", emoji: "🏥",
    primaryHex: "#0d6b67", primaryHsl: "178 79% 23%",
    accentHex: "#0f766e",  accentHsl: "175 77% 26%",
    sidebarBg: "#041a18",  sidebarFg: "#e6faf9",
    labels: {
      bookings: "Appointments", clients: "Patients", leads: "Referrals",
      quotes: "Quotes", consent: "Consent Forms", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Supplies",
    },
    nav: [
      NAV.dashboard, NAV.appointments, NAV.patients,
      NAV.safi,
      NAV.leads, NAV.consent,
      NAV.team, NAV.invoices, NAV.photos,
      NAV.manuals, NAV.cpd, NAV.locations, NAV.settings,
    ],
  },

  // ── Builder & Bricklayer ─────────────────────────────────────────────────
  builder: {
    id: "builder", name: "Builder & Bricklayer", emoji: "🧱",
    primaryHex: "#57534e", primaryHsl: "25 6% 32%",
    accentHex: "#c2410c",  accentHsl: "17 88% 40%",
    sidebarBg: "#121110",  sidebarFg: "#f5f3f0",
    labels: {
      bookings: "Jobs", clients: "Customers", leads: "Enquiries",
      quotes: "Quotes", consent: "Risk Assessment", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Materials",
    },
    nav: [
      NAV.dashboard, NAV.jobs, NAV.customers,
      NAV.safi,
      NAV.enquiries, NAV.quotes, NAV.riskAssess,
      NAV.team, NAV.invoices, NAV.materials,
      NAV.manuals, NAV.locations, NAV.settings,
    ],
  },

  // ── HVAC & Machine Servicing ─────────────────────────────────────────────
  hvac: {
    id: "hvac", name: "HVAC & Machine Servicing", emoji: "❄️",
    primaryHex: "#1d4ed8", primaryHsl: "225 73% 48%",
    accentHex: "#0e7490",  accentHsl: "192 91% 31%",
    sidebarBg: "#030d1f",  sidebarFg: "#e6f0ff",
    labels: {
      bookings: "Service Calls", clients: "Customers", leads: "Enquiries",
      quotes: "Quotes", consent: "Risk Assessment", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Parts & Materials",
    },
    nav: [
      NAV.dashboard, NAV.jobs, NAV.customers,
      NAV.safi,
      NAV.enquiries, NAV.quotes, NAV.riskAssess,
      NAV.team, NAV.invoices, NAV.materials,
      NAV.manuals, NAV.locations, NAV.settings,
    ],
  },

  // ── Default (no industry set) ────────────────────────────────────────────
  default: {
    id: "default", name: "PractiVault", emoji: "🏢",
    primaryHex: "#b1306f", primaryHsl: "330 57% 44%",
    accentHex: "#0d6b67",  accentHsl: "178 79% 23%",
    sidebarBg: "#1a0d13",  sidebarFg: "#f9e8f0",
    labels: {
      bookings: "Bookings", clients: "Clients", leads: "Leads",
      quotes: "Quotes", consent: "Consent Forms", invoices: "Invoices",
      dashboard: "Dashboard", stock: "Stock",
    },
    nav: [
      NAV.dashboard, NAV.bookings, NAV.clients,
      NAV.safi, NAV.social,
      NAV.leads, NAV.quotes, NAV.consent,
      NAV.team, NAV.invoices, NAV.photos,
      NAV.manuals, NAV.videos, NAV.packages,
      NAV.stock, NAV.cpd, NAV.locations, NAV.settings,
    ],
  },
};

export function getIndustryConfig(industry?: string | null): IndustryConfig {
  if (!industry) return INDUSTRY_CONFIGS.default;
  return INDUSTRY_CONFIGS[industry] ?? INDUSTRY_CONFIGS.default;
}
