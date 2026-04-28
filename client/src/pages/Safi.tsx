/**
 * Safi — single unified AI with two modes:
 *   • Receptionist  — xAI realtime voice (grok-voice-think-fast-1.0)
 *   • Admin Assistant — AI Front Desk message analyser
 */

import { useState } from "react";
import { Phone, ClipboardList, ChevronRight, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import SafiReceptionist from "./SafiReceptionist";
import SafiAdmin from "./SafiAdmin";

type Mode = "receptionist" | "admin" | null;

export default function Safi() {
  const [mode, setMode] = useState<Mode>(null);

  if (mode === "receptionist") {
    return <SafiReceptionist onBack={() => setMode(null)} />;
  }
  if (mode === "admin") {
    return <SafiAdmin onBack={() => setMode(null)} />;
  }

  // ── Mode picker ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-12">
      {/* Logo / heading */}
      <div className="flex flex-col items-center mb-10">
        <div className="h-16 w-16 rounded-2xl bg-[#b1306f]/10 flex items-center justify-center mb-4">
          <Bot className="h-8 w-8 text-[#b1306f]" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Hi, I'm Safi</h1>
        <p className="text-sm text-muted-foreground mt-1.5 text-center max-w-xs">
          Your AI assistant — pick a mode to get started.
        </p>
      </div>

      {/* Mode cards */}
      <div className="w-full max-w-sm space-y-3">
        <ModeCard
          icon={<Phone className="h-5 w-5" />}
          title="Safi as Receptionist"
          description="Live voice — answers customer calls, handles enquiries and bookings in real time."
          onClick={() => setMode("receptionist")}
          accent="bg-[#b1306f]"
        />
        <ModeCard
          icon={<ClipboardList className="h-5 w-5" />}
          title="Safi as Admin Assistant"
          description="Analyse incoming messages, draft replies, manage follow-ups and admin tasks."
          onClick={() => setMode("admin")}
          accent="bg-[#0d6b67]"
        />
      </div>
    </div>
  );
}

function ModeCard({
  icon, title, description, onClick, accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border bg-card hover:border-[#b1306f]/40 hover:shadow-sm transition-all duration-150 p-5 flex items-start gap-4 group"
      data-testid={`button-mode-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0", accent)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-[#b1306f] transition-colors" />
    </button>
  );
}
