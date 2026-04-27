/**
 * IndustryContext — loads the user's industry from their profile,
 * applies the matching colour theme to CSS variables, and exposes
 * labels + nav to the rest of the app via useIndustry().
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getIndustryConfig, IndustryConfig } from "@/lib/industryConfig";

interface IndustryContextValue {
  config: IndustryConfig;
  industry: string | null;
  businessName: string | null;
  setIndustryOverride: (id: string) => void; // used by demo mode
}

const IndustryContext = createContext<IndustryContextValue>({
  config: getIndustryConfig(null),
  industry: null,
  businessName: null,
  setIndustryOverride: () => {},
});

function applyTheme(config: IndustryConfig) {
  const root = document.documentElement;
  // Override the CSS variables that drive sidebar + primary button colours
  root.style.setProperty("--sidebar-bg", config.sidebarBg);
  root.style.setProperty("--sidebar-fg", config.sidebarFg);
  root.style.setProperty("--industry-primary", config.primaryHex);
  root.style.setProperty("--industry-primary-hsl", config.primaryHsl);
  root.style.setProperty("--industry-accent", config.accentHex);

  // Also patch Tailwind HSL variables used by sidebar-primary
  root.style.setProperty("--sidebar-primary", config.primaryHsl);
  root.style.setProperty("--primary", config.primaryHsl);
}

export function IndustryProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [industry, setIndustry] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [override, setOverride] = useState<string | null>(null);

  // Load user profile when logged in
  useEffect(() => {
    if (!user || !session) return;
    supabase
      .from("users")
      .select("industry, business_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setIndustry(data.industry ?? null);
          setBusinessName(data.business_name ?? null);
        }
      });
  }, [user, session]);

  const activeIndustry = override ?? industry;
  const config = getIndustryConfig(activeIndustry);

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(config);
  }, [config]);

  return (
    <IndustryContext.Provider
      value={{
        config,
        industry: activeIndustry,
        businessName,
        setIndustryOverride: setOverride,
      }}
    >
      {children}
    </IndustryContext.Provider>
  );
}

export function useIndustry() {
  return useContext(IndustryContext);
}
