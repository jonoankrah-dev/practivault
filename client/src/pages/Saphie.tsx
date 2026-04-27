/**
 * Saphie — PractiVault AI assistant
 * Groq llama-3.3-70b chat + Groq Whisper voice
 * Mic permission triggered directly on tap — no pre-checks
 */

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send, Trash2, Loader2, Mic, Sparkles, Bot,
  TrendingUp, Users, Calendar, FileText, Square, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";

// Detect if we're inside an iframe (Perplexity embed) — mic won't work there
const IS_IFRAME = (() => { try { return window.self !== window.top; } catch { return true; } })();
// Open the app directly in a new tab at the BamBam page — bypasses iframe mic block
const DIRECT_URL = "https://practivault-backend-production.up.railway.app/";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: "Revenue this month",  prompt: "What's my total revenue this month?" },
  { icon: Users,      label: "Active clients",       prompt: "How many active clients do I have?" },
  { icon: Calendar,   label: "Today's bookings",     prompt: "What bookings do I have today?" },
  { icon: FileText,   label: "Overdue invoices",     prompt: "Do I have any overdue invoices?" },
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-[#b1306f] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">B</div>
      )}
      <div className={cn(
        "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
        isUser ? "bg-[#b1306f] text-white rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"
      )}>
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      <div className="h-8 w-8 rounded-full bg-[#b1306f] flex items-center justify-center text-white text-xs font-bold shrink-0">B</div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        {[0,1,2].map(i => (
          <span key={i} className="h-2 w-2 rounded-full bg-muted-foreground/50 inline-block"
            style={{ animation: `saphieDot 1.2s ease-in-out ${i*0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

type VoiceState = "idle" | "recording" | "transcribing";

export default function Saphie() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/saphie/messages"],
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      setIsTyping(true);
      return apiRequest("POST", "/api/saphie/chat", { content });
    },
    onSuccess: () => {
      setIsTyping(false);
      queryClient.invalidateQueries({ queryKey: ["/api/saphie/messages"] });
    },
    onError: (e: any) => {
      setIsTyping(false);
      toast({ title: "Saphie hit a snag", description: e.message, variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/saphie/messages"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saphie/messages"] }),
  });

  const handleSend = () => {
    const content = input.trim();
    if (!content || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Voice — tap once to start, tap again to stop ──────────────────────────

  const handleMicClick = async () => {
    // If already recording — stop it
    if (voiceState === "recording") {
      recorderRef.current?.stop();
      return;
    }

    // Start recording — getUserMedia fires browser permission popup here
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? { mimeType: "audio/webm;codecs=opus" }
        : MediaRecorder.isTypeSupported("audio/webm")
        ? { mimeType: "audio/webm" }
        : {};

      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size < 1000) {
          setVoiceState("idle");
          toast({ title: "Too short", description: "Hold the mic button while speaking, then tap again to stop." });
          return;
        }

        const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
        const formData = new FormData();
        formData.append("audio", blob, `voice.${ext}`);
        setVoiceState("transcribing");

        try {
          const token = getAuthToken();
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch("/api/saphie/transcribe", {
            method: "POST",
            headers,
            body: formData,
            credentials: "include",
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Transcription failed");
          }

          const { text } = await res.json();
          setVoiceState("idle");

          if (text?.trim()) {
            sendMutation.mutate(text.trim());
          } else {
            toast({ title: "Didn't catch that", description: "Try speaking closer to the mic." });
          }
        } catch (err: any) {
          setVoiceState("idle");
          toast({ title: "Voice error", description: err.message, variant: "destructive" });
        }
      };

      recorder.start();
      setVoiceState("recording");
    } catch (err: any) {
      // SecurityError = iframe / non-HTTPS origin
      if (err?.name === "SecurityError" || err?.message?.toLowerCase().includes("security") || err?.message?.toLowerCase().includes("origin")) {
        toast({
          title: "Open the app directly for voice",
          description: "Voice doesn't work inside the Perplexity preview. Use the 'Open app' button at the top of this page.",
          variant: "destructive",
        });
      } else if (err?.name === "NotAllowedError") {
        toast({ title: "Microphone blocked", description: "Tap the lock icon in your address bar, set Microphone to Allow, then try again.", variant: "destructive" });
      } else if (err?.name === "NotFoundError") {
        toast({ title: "No microphone found", description: "Please connect a mic and try again.", variant: "destructive" });
      } else {
        toast({ title: "Microphone error", description: err?.message || "Could not access microphone.", variant: "destructive" });
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader
        title="Saphie"
        subtitle="Your AI assistant — type or tap the mic to speak"
        icon={<Bot className="h-5 w-5" />}
        actions={
          messages.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1.5" />Clear chat
            </Button>
          ) : undefined
        }
      />

      {/* Iframe mic warning */}
      {IS_IFRAME && (
        <div className="mx-4 mt-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <span className="text-amber-700 flex-1">🎤 Voice needs the app open directly — not inside Perplexity.</span>
          <a href={DIRECT_URL} target="_blank" rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-amber-800 underline underline-offset-2">
            Open app <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Status banners */}
      {voiceState === "recording" && (
        <div className="mx-4 mt-3 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-red-700 font-medium flex-1">Listening… tap the mic again to stop</span>
        </div>
      )}
      {voiceState === "transcribing" && (
        <div className="mx-4 mt-3 flex items-center gap-3 bg-[#b1306f]/5 border border-[#b1306f]/20 rounded-xl px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 text-[#b1306f] animate-spin shrink-0" />
          <span className="text-[#b1306f] flex-1">Transcribing your voice…</span>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 px-4 py-4">
          {isLoading && (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-12 w-64 rounded-2xl" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <div className="h-16 w-16 rounded-full bg-[#b1306f]/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-[#b1306f]" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold mb-1">Hey, I'm Saphie 👋</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  I know your business inside out. Type a message or tap the mic and speak to me.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                  <button key={label} onClick={() => sendMutation.mutate(prompt)}
                    disabled={sendMutation.isPending}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-accent text-sm text-left transition-colors">
                    <Icon className="h-4 w-4 text-[#b1306f] shrink-0" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isLoading && messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          {isTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </ScrollArea>

        {/* Input bar */}
        <div className="border-t border-border bg-background px-4 py-3">
          {messages.length > 0 && !isTyping && voiceState === "idle" && (
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {QUICK_PROMPTS.map(({ label, prompt }) => (
                <button key={label} onClick={() => sendMutation.mutate(prompt)}
                  disabled={sendMutation.isPending}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Saphie anything… or tap the mic to speak"
              className="min-h-[44px] max-h-[120px] resize-none text-sm"
              rows={1}
              disabled={sendMutation.isPending || voiceState !== "idle"}
            />

            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-11 w-11 shrink-0 transition-all",
                voiceState === "recording" && "bg-red-500 border-red-500 text-white hover:bg-red-600 animate-pulse",
                voiceState === "transcribing" && "opacity-50 cursor-not-allowed",
                voiceState === "idle" && "border-[#b1306f] text-[#b1306f] hover:bg-[#b1306f]/10",
              )}
              onClick={handleMicClick}
              disabled={voiceState === "transcribing" || sendMutation.isPending}
              title={voiceState === "recording" ? "Tap to stop recording" : "Tap to speak to Saphie"}
            >
              {voiceState === "recording"
                ? <Square className="h-4 w-4 fill-current" />
                : voiceState === "transcribing"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Mic className="h-4 w-4" />
              }
            </Button>

            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending || voiceState !== "idle"}
              size="icon"
              className="h-11 w-11 shrink-0 bg-[#b1306f] hover:bg-[#9a2860]"
            >
              {sendMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Enter to send · Tap mic to speak · Tap again to stop
          </p>
        </div>
      </div>

      <style>{`
        @keyframes saphieDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
