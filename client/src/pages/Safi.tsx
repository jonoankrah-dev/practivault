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
import { Zap, Send, Trash2, Loader2, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

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
      toast({ title: "Safi error", description: err.message, variant: "destructive" });
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
          <div className="h-8 w-8 rounded-xl bg-[#b1306f]/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-[#b1306f]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">Safi AI</h1>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#b1306f]/30 text-[#b1306f]">
                <Zap className="h-2.5 w-2.5 mr-0.5" />Agentic
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Your autonomous business assistant</p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={clearChat} title="Clear chat" data-testid="button-clear">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4 min-h-0">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
            <div className="h-16 w-16 rounded-2xl bg-[#b1306f]/10 flex items-center justify-center mb-5">
              <Zap className="h-8 w-8 text-[#b1306f]" />
            </div>
            <h2 className="text-base font-semibold mb-1">Meet Safi</h2>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
              Your fully agentic AI. Ask Safi to look up data, run reports, check bookings,
              review invoices — she acts on real business data, not just answers questions.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs px-3 py-2.5 rounded-xl border bg-muted/50 hover:bg-[#b1306f]/5 hover:border-[#b1306f]/30 transition-colors leading-snug"
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
                  <div className="h-7 w-7 rounded-full bg-[#b1306f]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-[#b1306f]" />
                  </div>
                )}
                <div className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[80%] whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-[#b1306f] text-white rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {msg.text}
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
                <div className="h-7 w-7 rounded-full bg-[#b1306f]/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-[#b1306f]" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#b1306f]" />
                  <span className="text-sm text-muted-foreground">Safi is working…</span>
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
            placeholder="Ask Safi anything — check bookings, invoices, stock, reports…"
            className="resize-none min-h-[44px] max-h-[120px] text-sm rounded-xl border-border focus-visible:ring-[#b1306f]/30"
            rows={1}
            disabled={loading}
            data-testid="input-message"
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-11 w-11 shrink-0 bg-[#b1306f] hover:bg-[#9a2860] text-white rounded-xl"
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
