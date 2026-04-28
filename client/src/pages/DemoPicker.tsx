import { useState } from "react";
import { useLocation } from "wouter";
import { SECTORS, type Sector, type SubIndustry } from "@/lib/sectorConfig";
import { getIndustryConfig } from "@/lib/industryConfig";

// ─── Header ──────────────────────────────────────────────────────────────────

function PickerHeader() {
  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#E83A8E] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white fill-current">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
          </div>
          <span className="font-bold text-[15px] text-[#241f19]">PractiVault</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/#/login" className="text-sm text-gray-500 hover:text-[#241f19] transition-colors">Sign in</a>
          <a href="/#/login" className="text-sm font-semibold bg-[#E83A8E] text-white px-4 py-1.5 rounded-lg hover:bg-[#c42d77] transition-colors">
            Start free trial
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Level 1 — Sector grid ────────────────────────────────────────────────────

function SectorGrid({ onSelect }: { onSelect: (sector: Sector) => void }) {
  return (
    <div className="max-w-6xl mx-auto px-6 pb-20">
      {/* Hero */}
      <div className="pt-12 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-[#E83A8E]/10 text-[#E83A8E] text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
          ✨ Live interactive demo — no login required
        </div>
        <h1 className="text-4xl font-bold text-[#241f19] mb-4 leading-tight">
          See PractiVault built<br />for your type of business
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Choose your sector below and we'll show you a live demo pre-filled with real data — clients, jobs, invoices and more — just like your account would look.
        </p>
      </div>

      {/* Sector cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {SECTORS.map((sector) => (
          <button
            key={sector.id}
            onClick={() => onSelect(sector)}
            className={`text-left bg-gradient-to-br ${sector.colour} border-2 rounded-2xl p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] group`}
          >
            <div className="text-3xl mb-3">{sector.emoji}</div>
            <h3 className="font-bold text-[#241f19] text-[15px] mb-1 group-hover:text-[#E83A8E] transition-colors leading-tight">
              {sector.label}
            </h3>
            <p className="text-xs text-gray-500 mb-3">{sector.description}</p>
            <p className={`text-[11px] font-semibold ${sector.accentText}`}>
              {sector.subIndustries.length} business types →
            </p>
          </button>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-14 text-center bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10">
        <h2 className="text-xl font-bold text-[#241f19] mb-2">Ready to get started?</h2>
        <p className="text-sm text-gray-500 mb-6">
          Join thousands of service businesses using PractiVault — from £19/month.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a href="/#/login" className="inline-flex items-center gap-2 px-6 py-3 bg-[#E83A8E] text-white text-sm font-semibold rounded-xl hover:bg-[#c42d77] transition-colors shadow-sm">
            Start free trial
          </a>
          <a href="/#/pricing" className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
            View pricing
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Level 2 — Sub-industry list ──────────────────────────────────────────────

function SubIndustryList({
  sector,
  onBack,
  onSelect,
}: {
  sector: Sector;
  onBack: () => void;
  onSelect: (sub: SubIndustry) => void;
}) {
  const cfg = getIndustryConfig(sector.subIndustries[0]?.id);

  return (
    <div className="max-w-4xl mx-auto px-6 pb-20">
      {/* Back + sector header */}
      <div className="pt-10 pb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#241f19] transition-colors mb-6 group"
        >
          <svg className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All sectors
        </button>

        <div className="flex items-center gap-4 mb-3">
          <div className={`text-5xl`}>{sector.emoji}</div>
          <div>
            <h1 className="text-3xl font-bold text-[#241f19] leading-tight">{sector.label}</h1>
            <p className="text-gray-500 mt-1">{sector.description} — pick your specific business type</p>
          </div>
        </div>
      </div>

      {/* Sub-industry grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sector.subIndustries.map((sub) => (
          <button
            key={sub.id}
            onClick={() => onSelect(sub)}
            className={`text-left bg-gradient-to-br ${sector.colour} border-2 rounded-xl p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] group`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5 shrink-0">{sub.emoji}</span>
              <div>
                <h3 className="font-bold text-[#241f19] text-sm mb-0.5 group-hover:text-[#E83A8E] transition-colors">
                  {sub.label}
                </h3>
                <p className="text-xs text-gray-500">{sub.tagline}</p>
              </div>
            </div>
            <div className={`mt-3 flex items-center gap-1 text-[11px] font-semibold ${sector.accentText} group-hover:text-[#E83A8E] transition-colors`}>
              Try this demo
              <svg className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main DemoPicker ──────────────────────────────────────────────────────────

export default function DemoPicker() {
  const [, navigate] = useLocation();
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);

  function handleSubSelect(sub: SubIndustry) {
    // Navigate to demo using the seedKey (maps to a real demo dataset)
    navigate(`/demo/${sub.seedKey}?label=${encodeURIComponent(sub.label)}&emoji=${encodeURIComponent(sub.emoji)}`);
  }

  return (
    <div className="min-h-screen bg-[#f6f3ef]">
      <PickerHeader />

      {selectedSector ? (
        <SubIndustryList
          sector={selectedSector}
          onBack={() => setSelectedSector(null)}
          onSelect={handleSubSelect}
        />
      ) : (
        <SectorGrid onSelect={setSelectedSector} />
      )}
    </div>
  );
}
