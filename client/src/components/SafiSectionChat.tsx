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
import { SaffiVoiceButton } from "@/components/SaffiVoiceButton";
import { HermesProposalCard } from "@/components/HermesProposalCard";
import type { HermesProposal } from "../../../server/hermes/types";

type Role = "user" | "assistant" | "hermesProposal";

type Message = { id: string; role: Role; text?: string; proposal?: HermesProposal };

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
  /**
   * `full` — section takeover (default). `embedded` — compact card for use under a real UI
   * (e.g. CRM table) so the assistant stays subtle.
   */
  variant?: "full" | "embedded";
}

export default function SafiSectionChat({
  section, description, icon, suggestions, sectionContext, variant = "full",
}: Props) {
  const embedded = variant === "embedded";
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

      // Hermes proposal support — if the backend detected a treatment completion, it returns
      // a structured proposal for the user to edit/approve instead of (or alongside) plain text.
      if (data.hermesProposal) {
        const propMsg: Message = {
          id: `hp-${Date.now()}`,
          role: "hermesProposal",
          proposal: data.hermesProposal as HermesProposal,
        };
        setMessages(p => [...p, propMsg]);
      }

      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
    } catch (err: any) {
      toast({ title: "Saffi error", description: err.message, variant: "destructive" });
      setMessages(p => [...p, {
        id: `e-${Date.now()}`, role: "assistant",
        text: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [loading, sectionContext]);

  const suggestionChips = embedded ? suggestions.slice(0, 5) : suggestions;

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const clearChat = () => { setMessages([]); historyRef.current = []; };

  // Called when user clicks "Approve & Execute" (or after editing) on a Hermes proposal card
  const handleApproveProposal = async (updatedProposal: HermesProposal) => {
    try {
      const res = await apiRequest("POST", "/api/hermes/execute", { proposal: updatedProposal });
      const result = await res.json();

      if (!result.ok) throw new Error(result.message || "Execution failed");

      // Replace the proposal message with a success note in the chat
      setMessages(prev =>
        prev.map(m =>
          m.role === "hermesProposal" && m.proposal?.id === updatedProposal.id
            ? {
                id: `hp-done-${Date.now()}`,
                role: "assistant",
                text: `✅ Hermes executed the proposal: ${result.result?.summary || "Actions applied successfully."}`,
              }
            : m
        )
      );

      toast({ title: "Proposal executed", description: "The actions have been applied to your data." });
    } catch (err: any) {
      toast({ title: "Execution failed", description: err.message, variant: "destructive" });
      throw err; // let the card show the error state
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-background",
        embedded
          ? "rounded-2xl border border-[#E83A8E]/18 shadow-[0_6px_24px_rgba(0,0,0,0.06)] overflow-hidden max-h-[min(380px,46vh)] w-full ring-1 ring-black/[0.04]"
          : "h-full max-h-screen",
      )}
    >

      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b bg-background/90 backdrop-blur shrink-0",
          embedded ? "px-3 py-2" : "px-6 py-4",
        )}
      >
        <div className={cn("flex items-center gap-2 min-w-0", !embedded && "gap-3")}>
          <div
            className={cn(
              "rounded-lg bg-[#E83A8E]/10 flex items-center justify-center shrink-0",
              embedded ? "h-7 w-7" : "h-8 w-8 rounded-xl",
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={cn("font-semibold truncate", embedded ? "text-xs" : "text-sm")}>{section}</h1>
              <Badge
                variant="outline"
                className={cn(
                  "border-[#E83A8E]/30 text-[#E83A8E] shrink-0",
                  embedded ? "text-[9px] px-1 py-0 h-5" : "text-[10px] px-1.5 py-0",
                )}
              >
                <Zap className={cn("mr-0.5", embedded ? "h-2 w-2" : "h-2.5 w-2.5")} />
                Saffi AI
              </Badge>
            </div>
            <p className={cn("text-muted-foreground truncate", embedded ? "text-[10px]" : "text-xs")}>{description}</p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            onClick={clearChat} title="Clear chat" data-testid={`button-clear-${section.toLowerCase()}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className={cn("flex-1 min-h-0", embedded ? "max-h-[200px] px-3 py-2" : "px-4 py-4")}>
        {messages.length === 0 ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center text-center",
              embedded ? "min-h-[100px] py-3 px-2" : "h-full min-h-[400px] px-4 py-4",
            )}
          >
            <div
              className={cn(
                "bg-[#E83A8E]/10 flex items-center justify-center mb-3",
                embedded ? "h-9 w-9 rounded-xl mb-2" : "h-16 w-16 rounded-2xl mb-5",
              )}
            >
              <Zap className={cn("text-[#E83A8E]", embedded ? "h-4 w-4" : "h-8 w-8")} />
            </div>
            <h2 className={cn("font-semibold mb-1", embedded ? "text-xs" : "text-base")}>
              {embedded ? "Ask Saffi anything" : `Saffi is managing your ${section}`}
            </h2>
            <p
              className={cn(
                "text-muted-foreground leading-relaxed",
                embedded ? "text-[10px] max-w-lg mb-3" : "text-sm max-w-sm mb-6",
              )}
            >
              {embedded
                ? "She sees the same filtered list as you. Quick answers, insights, or writes after you confirm."
                : "Ask Saffi to fetch, create, update or analyse anything in this section. She acts directly on your live data."}
            </p>
            <div
              className={cn(
                embedded
                  ? "flex flex-wrap gap-1.5 justify-center w-full"
                  : "grid grid-cols-2 gap-2 w-full max-w-sm",
              )}
            >
              {suggestionChips.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className={cn(
                    "text-left rounded-xl border bg-muted/50 hover:bg-[#E83A8E]/5 hover:border-[#E83A8E]/30 transition-colors leading-snug",
                    embedded ? "text-[10px] px-2 py-1.5 max-w-[100%]" : "text-xs px-3 py-2.5",
                  )}
                  data-testid={`suggestion-${s.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={cn("space-y-4 mx-auto pb-2", embedded ? "max-w-full" : "max-w-2xl")}>
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-[#E83A8E]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-[#E83A8E]" />
                  </div>
                )}
                <div className="flex flex-col gap-1 max-w-[80%]">
                  <div className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-[#E83A8E] text-white rounded-br-sm whitespace-pre-wrap"
                      : msg.role === "hermesProposal"
                      ? "p-0 bg-transparent border-0" // card handles its own chrome
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}>
                    {msg.role === "hermesProposal" && msg.proposal ? (
                      <HermesProposalCard
                        proposal={msg.proposal}
                        onApprove={handleApproveProposal}
                        onReject={() => {
                          setMessages(prev => prev.filter(m => m.id !== msg.id));
                        }}
                      />
                    ) : msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert
                        prose-p:my-1 prose-ul:my-1 prose-li:my-0.5
                        prose-headings:text-sm prose-headings:font-semibold prose-headings:my-2
                        prose-strong:font-semibold prose-code:text-xs">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    ) : msg.text}
                  </div>
                  {msg.role === "assistant" && (msg.text || "").trim() && (
                    <div className="self-start">
                      <SaffiVoiceButton text={msg.text || ""} testId={`button-voice-${msg.id}`} />
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
      <div className={cn("border-t bg-background shrink-0", embedded ? "px-3 pb-3 pt-2" : "px-4 pb-4 pt-2")}>
        <div className={cn("mx-auto flex gap-2 items-end", embedded ? "max-w-full" : "max-w-2xl")}>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              embedded
                ? "Ask Saffi about this list…"
                : `Ask Saffi to manage your ${section.toLowerCase()}…`
            }
            className={cn(
              "resize-none rounded-xl border-border focus-visible:ring-[#E83A8E]/30",
              embedded ? "min-h-[40px] max-h-[88px] text-xs" : "min-h-[44px] max-h-[120px] text-sm",
            )}
            rows={1}
            disabled={loading}
            data-testid={`input-${section.toLowerCase()}-message`}
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            size="icon"
            className={cn(
              "shrink-0 bg-[#E83A8E] hover:bg-[#c42d77] text-white rounded-xl",
              embedded ? "h-9 w-9" : "h-11 w-11",
            )}
            data-testid={`button-${section.toLowerCase()}-send`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className={cn(embedded ? "h-3.5 w-3.5" : "h-4 w-4")} />}
          </Button>
        </div>
        {!embedded && (
          <p className="text-center text-[10px] text-muted-foreground mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  );
}
