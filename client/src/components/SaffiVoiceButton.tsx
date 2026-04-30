/**
 * SaffiVoiceButton — manual playback only.
 *
 * Calls POST /api/saffi/voice (xAI Grok 'eve' voice) and plays the returned
 * MP3. There is intentionally no autoplay, no command execution, and no
 * voice-to-action. This button reads Saffi's reply aloud, nothing else.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/queryClient";
import { Loader2, Square, Volume2 } from "lucide-react";

type Props = {
  text: string;
  testId?: string;
};

export function SaffiVoiceButton({ text, testId }: Props) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  function cleanup() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    audioRef.current = null;
    setState("idle");
  }

  async function start() {
    if (!text.trim()) return;
    const token = getAuthToken();
    if (!token) {
      toast({
        title: "Sign in required",
        description: "Please sign in to play Saffi's voice.",
        variant: "destructive",
      });
      return;
    }
    setState("loading");
    try {
      const res = await fetch("/api/saffi/voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (res.status === 503) {
        toast({
          title: "Voice unavailable",
          description: "Saffi voice is not configured on this server.",
          variant: "destructive",
        });
        setState("idle");
        return;
      }
      if (!res.ok) {
        let detail = "";
        try {
          const j = await res.json();
          detail = j?.message ?? "";
        } catch {}
        toast({
          title: "Voice error",
          description: detail || `Failed (${res.status})`,
          variant: "destructive",
        });
        setState("idle");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = cleanup;
      audio.onerror = cleanup;
      await audio.play();
      setState("playing");
    } catch (e: any) {
      toast({ title: "Voice error", description: e?.message ?? "Unknown error", variant: "destructive" });
      cleanup();
    }
  }

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    cleanup();
  }

  if (state === "loading") {
    return (
      <Button
        size="icon"
        variant="ghost"
        disabled
        className="h-7 w-7 text-muted-foreground"
        title="Loading voice…"
        data-testid={testId ?? "button-saffi-voice"}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </Button>
    );
  }

  if (state === "playing") {
    return (
      <Button
        size="icon"
        variant="ghost"
        onClick={stop}
        className="h-7 w-7 text-[#E83A8E] hover:text-[#c42d77]"
        title="Stop voice"
        data-testid={testId ?? "button-saffi-voice-stop"}
      >
        <Square className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={start}
      disabled={!text.trim()}
      className="h-7 w-7 text-muted-foreground hover:text-[#E83A8E]"
      title="Play Saffi's voice"
      data-testid={testId ?? "button-saffi-voice"}
    >
      <Volume2 className="h-3.5 w-3.5" />
    </Button>
  );
}
