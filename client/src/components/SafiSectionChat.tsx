/**
 * SafiSectionChat — reusable Safi chat UI for any section takeover.
 * Passes `sectionContext` so Safi knows which section it's operating in.
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
import ReactMarkdown from "react-markdown";

type Role = "user" | "assistant";
type Message = { id: string; role: Role; text: string };

interface Props {
  /** Short section name shown in the badge, e.g. "Invoices" */
  section: string;
  /** One-line description shown under the header */
  description: string;
  /** Icon shown in header — pass a Lucide element */
  icon: React.ReactNode;
  /** Suggestion chips shown in the empty state */
  suggestions: string[];
  /** Longer context injected at the top of each request so Safi knows where it is */
  sectionContext: string;
}

export default function SafiSectionChat({
  section, description, icon, suggestions, sectionContext,
}: Props) {
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

    historyRef.current = [...historyRef.current.slice(-9), { role: "user", content: msg }];

    try {
      const res = await apiRequest("POST", "/api/safi/chat", {
        message: msg,
        history: historyRef.current.slice(0, -1),
        sectionContext,
      });
      const data = await res.json() as any;

      if (data.message) throw new Error(data.message);

      const reply = (data.reply as string) ?? "";
      const assistantMsg: Message = { id: `a-${Date.now()}`, role: "assistant", text: reply };
      setMessages(p => [...p, assistantMsg]);

      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
    } catch (err: any) {
      toast({ title: "Safi error", description: err.message, variant: "destructive" });
      setMessages(p => [...p, {
        id: `e-${Date.now()}`, role: "assistant",
        text: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [loading, sectionContext]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const clearChat = () => { setMessages([]); historyRef.current = []; };

  return (
    <div className="flex flex-col h-full max-h-screen bg-background">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-[#E83A8E]/10 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">{section}</h1>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#E83A8E]/30 text-[#E83A8E]">
                <Zap className="h-2.5 w-2.5 mr-0.5" />Safi AI
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={clearChat} title="Clear chat" data-testid={`button-clear-${section.toLowerCase()}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
            <div className="h-16 w-16 rounded-2xl bg-[#E83A8E]/10 flex items-center justify-center mb-5">
              <Zap className="h-8 w-8 text-[#E83A8E]" />
            </div>
            <h2 className="text-base font-semibold mb-1">Safi is managing your {section}</h2>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
              Ask Safi to fetch, create, update or analyse anything in this section.
              She acts directly on your live data.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {suggestions.map(s => (
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
                <div className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[80%]",
                  msg.role === "user"
                    ? "bg-[#E83A8E] text-white rounded-br-sm whitespace-pre-wrap"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert
                      prose-p:my-1 prose-ul:my-1 prose-li:my-0.5
                      prose-headings:text-sm prose-headings:font-semibold prose-headings:my-2
                      prose-strong:font-semibold prose-code:text-xs">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  ) : msg.text}
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="h-7 w-7 rounded-full bg-[#E83A8E]/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-[#E83A8E]" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E83A8E]" />
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
            placeholder={`Ask Safi to manage your ${section.toLowerCase()}…`}
            className="resize-none min-h-[44px] max-h-[120px] text-sm rounded-xl border-border focus-visible:ring-[#E83A8E]/30"
            rows={1}
            disabled={loading}
            data-testid={`input-${section.toLowerCase()}-message`}
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-11 w-11 shrink-0 bg-[#E83A8E] hover:bg-[#c42d77] text-white rounded-xl"
            data-testid={`button-${section.toLowerCase()}-send`}
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
