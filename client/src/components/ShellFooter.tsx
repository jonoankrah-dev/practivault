import { useQuery } from "@tanstack/react-query";
import { Instagram, Facebook, Globe, Music2 } from "lucide-react";
import { ENDO_PULSE_DEMO } from "@/lib/demoBranding";
import { cn } from "@/lib/utils";

type BizInfo = {
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
};

function resolveSocials(bi: BizInfo | undefined) {
  const hasAny = !!(bi?.instagram_url || bi?.facebook_url || bi?.tiktok_url || bi?.website_url);
  if (!hasAny) {
    return {
      website: ENDO_PULSE_DEMO.website,
      instagram: ENDO_PULSE_DEMO.instagram_url,
      facebook: ENDO_PULSE_DEMO.facebook_url,
      tiktok: ENDO_PULSE_DEMO.tiktok_url,
      isDemoFallback: true,
    };
  }
  return {
    website: bi?.website_url || undefined,
    instagram: bi?.instagram_url || undefined,
    facebook: bi?.facebook_url || undefined,
    tiktok: bi?.tiktok_url || undefined,
    isDemoFallback: false,
  };
}

export default function ShellFooter() {
  const { data: bi } = useQuery<BizInfo>({ queryKey: ["/api/business-info"], staleTime: 60_000 });
  const s = resolveSocials(bi);

  const items = [
    { href: s.instagram, icon: Instagram, label: "Instagram" },
    { href: s.facebook, icon: Facebook, label: "Facebook" },
    { href: s.tiktok, icon: Music2, label: "TikTok" },
    { href: s.website, icon: Globe, label: "Website" },
  ].filter((x) => x.href);

  if (items.length === 0) return null;

  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border/80 bg-muted/30 px-4 py-2.5",
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground",
      )}
    >
      {s.isDemoFallback && (
        <span className="text-[10px] opacity-80 w-full text-center sm:w-auto sm:inline">
          Demo social links (endoPulse) — set your own in Settings → Social.
        </span>
      )}
      <div className="flex items-center gap-3">
        {items.map(({ href, icon: Icon, label }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-[#E83A8E] transition-colors"
            aria-label={label}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </a>
        ))}
      </div>
    </footer>
  );
}
