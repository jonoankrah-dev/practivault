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
  Send, Trash2, Loader2, Mic, MicOff, Sparkles, Bot,
  TrendingUp, Users, Calendar, FileText, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";

// Detect if we're inside an iframe (Perplexity embed) — mic won't work there
const IS_IFRAME = (() => { try { return window.self !== window.top; } catch { return true; } })();
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

type VoiceState = "listening" | "transcribing";

export default function Saphie() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("listening");
  const [micMuted, setMicMuted] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioUnlockedRef = useRef<boolean>(false);
  const speakQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef<boolean>(false);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/saphie/messages"],
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Unlock browser autoplay by playing a silent buffer on first user gesture
  const unlockAudio = () => {
    if (audioUnlockedRef.current) return;
    try {
      const ctx = new AudioContext();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      ctx.close();
      audioUnlockedRef.current = true;
    } catch {}
  };

  // Speak a reply aloud using Grok (xAI) TTS — queued so sentences don't overlap
  const processSpeakQueue = async () => {
    if (isSpeakingRef.current) return;
    if (speakQueueRef.current.length === 0) return;
    isSpeakingRef.current = true;
    const text = speakQueueRef.current.shift()!;
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/saphie/speak", {
        method: "POST",
        headers,
        body: JSON.stringify({ text }),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: res.statusText }));
        toast({ title: "Voice error", description: errData.message || "TTS failed", variant: "destructive" });
        isSpeakingRef.current = false;
        processSpeakQueue();
        return;
      }
      const blob = await res.blob();
      if (blob.size < 100) {
        isSpeakingRef.current = false;
        processSpeakQueue();
        return;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        isSpeakingRef.current = false;
        processSpeakQueue();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        toast({ title: "Voice error", description: "Audio playback failed", variant: "destructive" });
        isSpeakingRef.current = false;
        processSpeakQueue();
      };
      await audio.play();
    } catch (err: any) {
      toast({ title: "Voice error", description: err?.message || "Unknown TTS error", variant: "destructive" });
      isSpeakingRef.current = false;
      processSpeakQueue();
    }
  };

  const speakReply = (text: string) => {
    if (!text.trim()) return;
    speakQueueRef.current.push(text.trim());
    processSpeakQueue();
  };

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      setIsTyping(true);
      const res = await apiRequest("POST", "/api/saphie/chat", { content });
      const json = await res.json();
      return json; // { reply: "..." }
    },
    onSuccess: async (data: any) => {
      setIsTyping(false);
      queryClient.invalidateQueries({ queryKey: ["/api/saphie/messages"] });
      // Extract reply — handle both { reply } and raw string
      const reply: string = typeof data === "string" ? data : (data?.reply ?? "");
      if (reply.trim()) speakReply(reply.trim());
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

  // ── Always-on voice loop ─────────────────────────────────────────────────
  // loopActiveRef: true = loop should keep running; set false to halt entirely
  const loopActiveRef = useRef<boolean>(false);

  const stopRecordingHard = () => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  // stopAndTranscribe: stop current recording; onstop handler will transcribe then restart
  const stopAndTranscribe = () => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop(); // triggers onstop → transcribe → restart
    }
  };

  const startListeningLoop = async () => {
    if (!loopActiveRef.current) return; // loop was halted

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!loopActiveRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
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

        // If muted or loop stopped, don't transcribe — just restart or halt
        if (!loopActiveRef.current) return;

        if (blob.size < 1000) {
          // Too short — restart listening immediately (no speech detected)
          setVoiceState("listening");
          if (loopActiveRef.current) startListeningLoop();
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

          if (text?.trim()) {
            sendMutation.mutate(text.trim());
          }
          // After transcription (speech found or not), restart listening
          setVoiceState("listening");
          if (loopActiveRef.current) startListeningLoop();
        } catch (err: any) {
          setVoiceState("listening");
          toast({ title: "Voice error", description: err.message, variant: "destructive" });
          if (loopActiveRef.current) startListeningLoop();
        }
      };

      recorder.start();
      setVoiceState("listening");

      // ── Silence detection via Web Audio API ──────────────────────────────────
      try {
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.fftSize);

        let calibrationSamples: number[] = [];
        let calibrationDone = false;
        let dynamicThreshold = 15;
        const SILENCE_DURATION = 1800;
        let speechDetected = false;
        let silenceStart: number | null = null;
        const calibrationStart = Date.now();

        const getRMS = () => {
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128;
            sum += v * v;
          }
          return Math.sqrt(sum / dataArray.length) * 255;
        };

        const checkSilence = () => {
          if (!recorderRef.current || recorderRef.current.state !== "recording") return;
          if (!loopActiveRef.current) return;

          const rms = getRMS();

          if (!calibrationDone) {
            calibrationSamples.push(rms);
            if (Date.now() - calibrationStart > 400) {
              const avg = calibrationSamples.reduce((a,b) => a+b, 0) / calibrationSamples.length;
              dynamicThreshold = Math.max(avg * 2.5, 12);
              calibrationDone = true;
            }
            animFrameRef.current = requestAnimationFrame(checkSilence);
            return;
          }

          if (rms > dynamicThreshold) {
            speechDetected = true;
            silenceStart = null;
          } else if (speechDetected) {
            if (silenceStart === null) silenceStart = Date.now();
            else if (Date.now() - silenceStart >= SILENCE_DURATION) {
              stopAndTranscribe();
              return;
            }
          }

          animFrameRef.current = requestAnimationFrame(checkSilence);
        };

        animFrameRef.current = requestAnimationFrame(checkSilence);
      } catch {
        // AudioContext not available — rely on silence timer fallback
        // Auto-stop after 10s max if no silence detection
        silenceTimerRef.current = setTimeout(() => stopAndTranscribe(), 10000);
      }

    } catch (err: any) {
      if (err?.name === "SecurityError" || err?.message?.toLowerCase().includes("security") || err?.message?.toLowerCase().includes("origin")) {
        toast({
          title: "Open the app directly for voice",
          description: "Voice doesn't work inside Perplexity preview. Use the Railway link instead.",
          variant: "destructive",
        });
        loopActiveRef.current = false;
      } else if (err?.name === "NotAllowedError") {
        toast({ title: "Microphone blocked", description: "Tap the lock icon in your address bar, set Microphone to Allow, then try again.", variant: "destructive" });
        loopActiveRef.current = false;
      } else if (err?.name === "NotFoundError") {
        toast({ title: "No microphone found", description: "Please connect a mic and try again.", variant: "destructive" });
        loopActiveRef.current = false;
      } else {
        // Transient error — retry after a short pause
        setTimeout(() => { if (loopActiveRef.current) startListeningLoop(); }, 1000);
      }
    }
  };

  // Mute toggle: stop loop when muting, restart when unmuting
  const handleMuteToggle = () => {
    unlockAudio();
    if (!micMuted) {
      // Muting
      loopActiveRef.current = false;
      stopRecordingHard();
      setMicMuted(true);
      setVoiceState("listening"); // keeps UI consistent
    } else {
      // Unmuting
      setMicMuted(false);
      loopActiveRef.current = true;
      startListeningLoop();
    }
  };

  // Auto-start on mount (user must interact first to unlock mic — handled by first tap/type)
  useEffect(() => {
    // Start loop on first user interaction (click/keydown anywhere)
    const startOnInteraction = () => {
      if (loopActiveRef.current) return;
      unlockAudio();
      loopActiveRef.current = true;
      startListeningLoop();
      // Remove listeners once started
      window.removeEventListener("click", startOnInteraction);
      window.removeEventListener("keydown", startOnInteraction);
    };
    window.addEventListener("click", startOnInteraction);
    window.addEventListener("keydown", startOnInteraction);
    return () => {
      // Cleanup on unmount
      loopActiveRef.current = false;
      stopRecordingHard();
      window.removeEventListener("click", startOnInteraction);
      window.removeEventListener("keydown", startOnInteraction);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {!micMuted && voiceState === "listening" && (
        <div className="mx-4 mt-3 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-red-700 font-medium flex-1">Saphie is listening…</span>
        </div>
      )}
      {micMuted && (
        <div className="mx-4 mt-3 flex items-center gap-3 bg-muted border border-border rounded-xl px-4 py-3 text-sm">
          <MicOff className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground flex-1">Mic muted — tap to unmute</span>
        </div>
      )}
      {voiceState === "transcribing" && (
        <div className="mx-4 mt-3 flex items-center gap-3 bg-[#b1306f]/5 border border-[#b1306f]/20 rounded-xl px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 text-[#b1306f] animate-spin shrink-0" />
          <span className="text-[#b1306f] flex-1">Saphie heard you…</span>
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
                  I know your business inside out. Just speak — I'm always listening. Or type below.
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
          {messages.length > 0 && !isTyping && voiceState !== "transcribing" && (
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
              disabled={sendMutation.isPending || voiceState === "transcribing"}
            />

            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-11 w-11 shrink-0 transition-all",
                !micMuted && voiceState === "listening" && "bg-red-500 border-red-500 text-white hover:bg-red-600",
                micMuted && "border-muted-foreground text-muted-foreground hover:bg-muted",
                voiceState === "transcribing" && "opacity-50 cursor-not-allowed",
              )}
              onClick={handleMuteToggle}
              disabled={voiceState === "transcribing" || sendMutation.isPending}
              title={micMuted ? "Unmute mic" : "Mute mic"}
            >
              {voiceState === "transcribing"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : micMuted
                ? <MicOff className="h-4 w-4" />
                : <Mic className="h-4 w-4" />
              }
            </Button>

            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending || voiceState === "transcribing"}
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
            Saphie is always listening · tap mic to mute
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
