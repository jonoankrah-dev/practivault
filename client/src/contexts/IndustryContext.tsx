/**
 * IndustryContext — loads the user's profile from `/api/me`, applies the matching
 * colour theme to CSS variables, and exposes labels + nav via useIndustry().
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getIndustryConfig, IndustryConfig } from "@/lib/industryConfig";

interface IndustryContextValue {
  config: IndustryConfig;
  industry: string | null;
  businessName: string | null;
  /** When true, omit "Powered by PractiVault" in the shell (white-label). */
  hidePoweredBy: boolean;
  setIndustryOverride: (id: string) => void; // used by demo mode
}

const IndustryContext = createContext<IndustryContextValue>({
  config: getIndustryConfig(null),
  industry: null,
  businessName: null,
  hidePoweredBy: false,
  setIndustryOverride: () => {},
});

function applyTheme(config: IndustryConfig) {
  const root = document.documentElement;
  root.style.setProperty("--sidebar-bg", config.sidebarBg);
  root.style.setProperty("--sidebar-fg", config.sidebarFg);
  root.style.setProperty("--industry-primary", config.primaryHex);
  root.style.setProperty("--industry-primary-hsl", config.primaryHsl);
  root.style.setProperty("--industry-accent", config.accentHex);
  root.style.setProperty("--sidebar-primary", config.primaryHsl);
  root.style.setProperty("--primary", config.primaryHsl);
}

export function IndustryProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [industry, setIndustry] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [hidePoweredBy, setHidePoweredBy] = useState(false);
  const [override, setOverride] = useState<string | null>(null);

  const { data: profile } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/me"],
    enabled: !!user && !!session,
  });

  useEffect(() => {
    if (!profile) return;
    setIndustry((profile.industry as string) ?? null);
    setBusinessName((profile.business_name as string) ?? null);
    setHidePoweredBy(!!profile.hide_powered_by);
  }, [profile]);

  const activeIndustry = override ?? industry;
  const config = getIndustryConfig(activeIndustry);

  useEffect(() => {
    applyTheme(config);
  }, [config]);

  return (
    <IndustryContext.Provider
      value={{
        config,
        industry: activeIndustry,
        businessName,
        hidePoweredBy,
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
