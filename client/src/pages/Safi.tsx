/**
 * Safi — Agentic AI Assistant (text chat)
 * Fully autonomous business AI powered by xAI Grok via /api/safi/chat
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Send, Trash2, Loader2, Bot, User, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { SaffiVoiceButton } from "@/components/SaffiVoiceButton";
// Voice controller is mounted globally inside Protected (App.tsx). The pink
// "Talk to Saffi" button is the single mic control: it grabs the microphone
// stream INSIDE the click handler (preserves the user gesture so Safari/iOS
// don't reject it), then dispatches `saffi:startVoice` with that stream so
// the floating controller opens and starts the session immediately. If the
// browser denies mic permission, we still dispatch `saffi:openVoice` so the
// pill can show the error state.
const openSaffiVoice = async () => {
  if (typeof window === "undefined") return;
  // Some older browsers don't expose mediaDevices over http — graceful path:
  // open the pill anyway so it can show the unavailable state.
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    window.dispatchEvent(new Event("saffi:openVoice"));
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    window.dispatchEvent(
      new CustomEvent("saffi:startVoice", { detail: { stream } }),
    );
    window.dispatchEvent(new Event("saffi:openVoice"));
  } catch {
    // Permission denied / no mic — pill will surface the error.
    window.dispatchEvent(new Event("saffi:openVoice"));
  }
};

type Role = "user" | "assistant" | "tool";
type Message = { id: string; role: Role; text: string };

const SUGGESTIONS = [
  "Show me today's appointments",
  "Any overdue invoices?",
  "How many new clients this month?",
  "Check stock levels",
  "Generate a monthly report",
  "Show recent leads",
];

export default function Safi() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: msg };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setLoading(true);

    // Add to history for context
    historyRef.current = [...historyRef.current.slice(-9), { role: "user", content: msg }];

    try {
      const res = await apiRequest("POST", "/api/safi/chat", {
        message: msg,
        history: historyRef.current.slice(0, -1), // exclude the message we just added
      });
      const data = await res.json() as any;

      if (data.message) throw new Error(data.message);

      const reply = (data.reply as string) ?? "";
      const assistantMsg: Message = { id: `a-${Date.now()}`, role: "assistant", text: reply };
      setMessages(p => [...p, assistantMsg]);

      // Add assistant reply to history
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];

    } catch (err: any) {
      toast({ title: "Saffi error", description: err.message, variant: "destructive" });
      setMessages(p => [...p, { id: `e-${Date.now()}`, role: "assistant", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [loading]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    historyRef.current = [];
  };

  return (
    <div className="flex flex-col h-full max-h-screen bg-background">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-[#E83A8E]/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-[#E83A8E]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">Saffi AI</h1>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#E83A8E]/30 text-[#E83A8E]">
                <Zap className="h-2.5 w-2.5 mr-0.5" />Agentic
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Your autonomous business assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={openSaffiVoice}
            className="h-8 gap-1.5 border-[#E83A8E]/40 text-[#E83A8E] hover:bg-[#E83A8E]/10 hover:text-[#E83A8E]"
            title="Talk to Saffi"
            data-testid="button-open-voice"
          >
            <Mic className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Talk</span>
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={clearChat} title="Clear chat" data-testid="button-clear">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4 min-h-0">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
            <div className="h-16 w-16 rounded-2xl bg-[#E83A8E]/10 flex items-center justify-center mb-5">
              <Zap className="h-8 w-8 text-[#E83A8E]" />
            </div>
            <h2 className="text-base font-semibold mb-1">Meet Saffi</h2>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-4">
              Your fully agentic AI. Ask Saffi to look up data, run reports, check bookings,
              review invoices — she acts on real business data, not just answers questions.
            </p>
            <Button
              onClick={openSaffiVoice}
              className="mb-6 gap-2 bg-[#E83A8E] hover:bg-[#c42d77] text-white rounded-xl"
              data-testid="button-empty-talk"
            >
              <Mic className="h-4 w-4" />
              Talk to Saffi
            </Button>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs px-3 py-2.5 rounded-xl border bg-muted/50 hover:bg-[#E83A8E]/5 hover:border-[#E83A8E]/30 transition-colors leading-snug"
                  data-testid={`suggestion-${s.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto pb-2">
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-[#E83A8E]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-[#E83A8E]" />
                  </div>
                )}
                <div className="flex flex-col gap-1 max-w-[80%]">
                  <div className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-[#E83A8E] text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}>
                    {msg.text}
                  </div>
                  {msg.role === "assistant" && msg.text.trim() && (
                    <div className="self-start">
                      <SaffiVoiceButton text={msg.text} testId={`button-voice-${msg.id}`} />
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="h-7 w-7 rounded-full bg-[#E83A8E]/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-[#E83A8E]" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E83A8E]" />
                  <span className="text-sm text-muted-foreground">Saffi is working…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t bg-background shrink-0">
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Saffi anything — check bookings, invoices, stock, reports…"
            className="resize-none min-h-[44px] max-h-[120px] text-sm rounded-xl border-border focus-visible:ring-[#E83A8E]/30"
            rows={1}
            disabled={loading}
            data-testid="input-message"
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-11 w-11 shrink-0 bg-[#E83A8E] hover:bg-[#c42d77] text-white rounded-xl"
            data-testid="button-send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
