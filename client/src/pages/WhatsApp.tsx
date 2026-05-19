/**
 * WhatsApp Inbox — split-panel: thread list left, conversation right, Saffi chat far right
 */
import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Loader2, ChevronLeft, CheckCheck, Clock, Wifi, WifiOff } from "lucide-react";
import SaffiSectionChat from "@/components/SaffiSectionChat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface WaMessage {
  id: string;
  contact_phone: string;
  contact_name?: string;
  client_id?: string;
  direction: "inbound" | "outbound";
  body: string;
  sent_at: string;
  is_read: boolean;
  status?: string;
}

interface WaThread {
  contact_phone: string;
  contact_name?: string;
  client_id?: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  messages: WaMessage[];
}

const SUGGESTIONS = [
  "Show all WhatsApp conversations",
  "Any unread messages?",
  "Draft a reply to my last client message",
  "Send a booking reminder to Sarah Jones",
  "Message all clients with appointments tomorrow",
  "Write a follow-up for a client who hasn't booked in 3 months",
];

const SECTION_CONTEXT = `You are Saffi, the practice manager for this business. You are in the WhatsApp Inbox section.

When this section opens, immediately call get_whatsapp_threads and show a summary — how many conversations, how many unread, and who has messaged recently.

Your job:
- Summarise inbound messages and flag anything urgent
- Draft professional, warm replies for the owner to review and send
- Suggest proactive outreach — booking reminders, follow-ups, promotions
- Help compose messages to clients based on their booking history

Tools available:
- get_whatsapp_threads — list all conversations, unread counts, last messages (use immediately, no approval needed)
- send_whatsapp_message — send a WhatsApp message to a contact (APPROVAL REQUIRED)

APPROVAL RULE — before sending any message, show the full draft and ask:
"I'd like to send this WhatsApp to [name]:

'[message text]'

Shall I send it?"

Only send after explicit yes. Be warm, concise, professional. Think like a receptionist who knows every client personally.

The business WhatsApp number is +44 7537 167007.`;

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function initials(name?: string) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function WhatsApp() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: threads = [], isLoading: threadsLoading } = useQuery<WaThread[]>({
    queryKey: ["/api/whatsapp/threads"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/whatsapp/threads");
      return r.json();
    },
    refetchInterval: 15000, // poll every 15s for new messages
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<WaMessage[]>({
    queryKey: ["/api/whatsapp/messages", selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return [];
      const r = await apiRequest("GET", `/api/whatsapp/messages/${encodeURIComponent(selectedPhone)}`);
      return r.json();
    },
    enabled: !!selectedPhone,
    refetchInterval: 10000,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Invalidate thread list when a conversation is opened (marks as read)
  useEffect(() => {
    if (selectedPhone) {
      setTimeout(() => qc.invalidateQueries({ queryKey: ["/api/whatsapp/threads"] }), 500);
    }
  }, [selectedPhone, messages.length]);

  const selectedThread = threads.find(t => t.contact_phone === selectedPhone);
  const totalUnread = threads.reduce((s, t) => s + t.unread_count, 0);

  const handleSend = async () => {
    if (!selectedPhone || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/whatsapp/send", {
        to: selectedPhone,
        body: replyText.trim(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Send failed");

      if (data.warning) {
        toast({ title: "Saved (not sent yet)", description: data.warning });
      } else {
        toast({ title: "Sent", description: "Message delivered via WhatsApp." });
      }

      setReplyText("");
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/messages", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/threads"] });
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const credentialsConfigured = true; // optimistic — server will warn if not

  return (
    <div className="flex h-full max-h-screen overflow-hidden">

      {/* LEFT PANEL — thread list */}
      <div className="w-[280px] shrink-0 border-r bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#25D366]" />
            <span className="text-sm font-semibold">WhatsApp</span>
            {totalUnread > 0 && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-[#25D366] text-white border-0">
                {totalUnread}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {credentialsConfigured
              ? <><Wifi className="h-3 w-3 text-[#25D366]" /> Live</>
              : <><WifiOff className="h-3 w-3 text-amber-500" /> Setup needed</>
            }
          </div>
        </div>

        {/* Setup notice */}
        <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          <p className="font-medium mb-0.5">Connect your number</p>
          <p className="text-amber-700">Add your Meta API credentials to Railway to go live. Ask Saffi for the setup guide.</p>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto mt-2">
          {threadsLoading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : threads.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No messages yet.</p>
              <p className="text-[11px] text-muted-foreground mt-1">Messages from clients will appear here once your number is connected.</p>
            </div>
          ) : (
            threads.map(thread => {
              const active = selectedPhone === thread.contact_phone;
              return (
                <button
                  key={thread.contact_phone}
                  onClick={() => setSelectedPhone(thread.contact_phone)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border/50",
                    active && "bg-[#25D366]/8 border-l-2 border-l-[#25D366]"
                  )}
                >
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-full bg-[#25D366]/15 text-[#25D366] flex items-center justify-center text-xs font-bold shrink-0">
                    {initials(thread.contact_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("text-sm truncate", thread.unread_count > 0 ? "font-semibold" : "font-medium")}>
                        {thread.contact_name || thread.contact_phone}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(thread.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className={cn("text-xs truncate", thread.unread_count > 0 ? "text-foreground" : "text-muted-foreground")}>
                        {thread.last_message}
                      </p>
                      {thread.unread_count > 0 && (
                        <span className="h-4 w-4 rounded-full bg-[#25D366] text-white text-[9px] flex items-center justify-center shrink-0 font-bold">
                          {thread.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* CENTRE PANEL — conversation */}
      <div className="flex-1 min-w-0 flex flex-col border-r bg-[#f0f2f5]">
        {!selectedPhone ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <MessageCircle className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Select a conversation</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Choose a contact from the left, or ask Saffi to draft a message.</p>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="px-4 py-3 bg-background border-b flex items-center gap-3">
              <button onClick={() => setSelectedPhone(null)} className="lg:hidden text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="h-8 w-8 rounded-full bg-[#25D366]/15 text-[#25D366] flex items-center justify-center text-xs font-bold">
                {initials(selectedThread?.contact_name)}
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedThread?.contact_name || selectedPhone}</p>
                <p className="text-[11px] text-muted-foreground">+{selectedPhone}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {msgsLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Loading messages…
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">No messages in this thread yet.</div>
              ) : (
                messages.map(msg => {
                  const isOut = msg.direction === "outbound";
                  return (
                    <div key={msg.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        isOut
                          ? "bg-[#dcf8c6] text-gray-900 rounded-br-sm"
                          : "bg-white text-gray-900 rounded-bl-sm"
                      )}>
                        <p className="leading-snug whitespace-pre-wrap break-words">{msg.body}</p>
                        <div className={cn("flex items-center gap-1 mt-1", isOut ? "justify-end" : "justify-start")}>
                          <span className="text-[10px] text-gray-500">{formatTime(msg.sent_at)}</span>
                          {isOut && (
                            msg.status === "pending_credentials"
                              ? <Clock className="h-3 w-3 text-amber-500" />
                              : <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            <div className="bg-background border-t px-4 py-3 flex gap-2 items-end">
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Type a message… (Enter to send)"
                className="flex-1 min-h-[40px] max-h-[120px] text-sm resize-none"
                rows={1}
              />
              <Button
                onClick={handleSend}
                disabled={!replyText.trim() || sending}
                className="h-10 w-10 p-0 bg-[#25D366] hover:bg-[#1ebe57] text-white shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* RIGHT PANEL — Saffi */}
      <div className="w-[340px] shrink-0">
        <SaffiSectionChat
          section="WhatsApp"
          description="Saffi reads your messages and drafts replies"
          icon={<MessageCircle className="h-4 w-4 text-[#25D366]" />}
          suggestions={SUGGESTIONS}
          sectionContext={SECTION_CONTEXT}
        />
      </div>
    </div>
  );
}
