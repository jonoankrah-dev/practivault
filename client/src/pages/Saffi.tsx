'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Copy, Check, CheckCircle, XCircle, Play, Volume2, Square, Mic } from 'lucide-react';
import { useIndustry } from '@/contexts/IndustryContext';
import { getAuthToken } from '@/lib/queryClient';
import PageHeader from '@/components/PageHeader';

interface SaffiProps {
  onNavigate?: (section: 'dashboard' | 'clients' | 'settings') => void;
  businessId?: string;
  clientCount?: number;
  revenue?: string;
}

// ============================================
// Hermes Proposal Card Component (Interactive)
// ============================================
function HermesProposalCard({ proposal, onApprove }: { 
  proposal: any; 
  onApprove: (editedProposal?: any) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedActions, setEditedActions] = useState(() => 
    proposal.actions ? JSON.parse(JSON.stringify(proposal.actions)) : []
  );

  const HERMES_ACTION_TYPES = [
    "complete_treatment",
    "deduct_consumables",
    "record_treatment_note",
    "log_client_feedback",
    "schedule_follow_up",
    "create_task",
    "send_customer_message",
    "update_job_status",
  ];

  const handleApprove = async () => {
    setApproving(true);
    const finalProposal = isEditing 
      ? { ...proposal, actions: editedActions } 
      : proposal;
    await onApprove(finalProposal);
    setApproved(true);
    setApproving(false);
    setIsEditing(false);
  };

  const addNewAction = () => {
    const newAction = {
      type: "record_treatment_note",
      payload: { note: "Additional note from Hermes" },
      description: "Record additional treatment note"
    };
    setEditedActions([...editedActions, newAction]);
  };

  const removeAction = (index: number) => {
    setEditedActions(editedActions.filter((_: any, i: number) => i !== index));
  };

  const changeActionType = (index: number, newType: string) => {
    const newActions = [...editedActions];
    newActions[index] = {
      type: newType,
      payload: getDefaultPayloadForType(newType),
      description: `Execute ${newType.replace(/_/g, " ")}`
    };
    setEditedActions(newActions);
  };

  const updateActionPayload = (index: number, newPayload: any) => {
    const newActions = [...editedActions];
    newActions[index] = {
      ...newActions[index],
      payload: newPayload,
    };
    setEditedActions(newActions);
  };

  const getDefaultPayloadForType = (type: string) => {
    if (type === "complete_treatment") return { areasTreated: [], clientName: "" };
    if (type === "deduct_consumables") return { items: [""], quantities: [1] };
    if (type === "schedule_follow_up") return { weeksFromNow: 4, service: "endoPulse Follow-up" };
    if (type === "create_task") return { title: "New internal task", priority: "medium" };
    if (type === "log_client_feedback") return { clientName: "", sentiment: "positive", message: "" };
    if (type === "send_customer_message") return { customerId: "", message: "" };
    if (type === "update_job_status") return { jobId: "", status: "completed" };
    return { note: "New note" };
  };

  return (
    <div className="bg-white border border-[#C7D2FE] rounded-3xl p-5 max-w-[85%] shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="px-3 py-1 bg-[#2563EB] text-white text-xs font-semibold rounded-full flex items-center gap-1">
          <Play className="w-3 h-3" /> HERMES
        </div>
        <div className="text-sm text-[#475569] font-medium">Proposed Actions</div>
      </div>

      <div className="text-sm text-[#1E2937] mb-4 leading-relaxed">
        {proposal.summary || "Hermes has analyzed the update and recommends the following actions:"}
      </div>

      <div className="space-y-2 mb-4">
        {((isEditing ? editedActions : editedActions.length ? editedActions : proposal.actions) || [])?.map((action: any, i: number) => (
          <div key={i} className="bg-[#F8FAFC] border border-[#E0E7FF] rounded-2xl px-4 py-3 text-sm">
            {isEditing ? (
              <div className="space-y-2">
                {/* Action Type Selector */}
                <div className="flex items-center gap-2">
                  <select
                    value={action.type}
                    onChange={(e) => changeActionType(i, e.target.value)}
                    className="text-xs font-semibold bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 text-[#1E40AF] focus:outline-none focus:border-[#2563EB]"
                  >
                    {HERMES_ACTION_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeAction(i)}
                    className="ml-auto text-red-500 hover:text-red-600 text-lg leading-none px-1"
                    title="Remove action"
                  >
                    ×
                  </button>
                </div>

                {/* Description (auto-updated) */}
                <div className="text-[#475569] text-xs">{action.description}</div>

                {/* Payload JSON Editor */}
                <div>
                  <div className="text-[10px] text-[#64748B] mb-1 font-medium">Payload (JSON)</div>
                  <textarea
                    value={JSON.stringify(action.payload || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        updateActionPayload(i, parsed);
                      } catch {
                        // allow user to type freely; only apply when valid JSON
                      }
                    }}
                    className="w-full text-[10px] font-mono bg-white border border-[#CBD5E1] rounded-lg p-2 h-24 focus:outline-none focus:border-amber-400"
                    spellCheck={false}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="font-semibold text-[#1E40AF]">{action.type.replace(/_/g, " ")}</div>
                <div className="text-[#475569] mt-1 text-xs">{action.description}</div>
                {action.payload && (
                  <div className="mt-2 text-[10px] font-mono bg-white p-2 rounded border text-[#64748B] overflow-x-auto">
                    {JSON.stringify(action.payload, null, 2)}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {isEditing && (
          <button
            onClick={addNewAction}
            className="w-full text-xs py-2 border border-dashed border-[#CBD5E1] hover:border-[#2563EB] hover:bg-[#EEF2FF] rounded-2xl text-[#475569] transition-colors"
          >
            + Add another action
          </button>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[#E0E7FF]">
        <div className="text-xs text-[#64748B]">
          Confidence: {Math.round((proposal.confidence || 0.85) * 100)}%
        </div>

        <div className="flex gap-2">
          {!approved ? (
            <>
              <button 
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-2xl disabled:opacity-60"
              >
                {approving ? "Executing..." : "Approve & Execute"}
                <CheckCircle className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`px-4 py-2 text-sm rounded-2xl border ${isEditing ? 'bg-amber-50 border-amber-300' : 'border-[#CBD5E1] hover:bg-[#F1F5F9]'}`}
              >
                {isEditing ? "Done Editing" : "Edit"}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-[#16A34A] text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Executed successfully
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Saffi({ 
  onNavigate, 
  businessId = "LUM-2026-0427",
  clientCount = 47,
  revenue = "£3,284"
}: SaffiProps) {
  
  const { businessName, hidePoweredBy } = useIndustry();
  const displayName = businessName || "your business";

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  type ChatMessage = {
    role: string;
    content: string;
    hermesProposal?: any;
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: "assistant", 
      content: "Hi, I'm Saffi — your AI assistant. How can I help you today?" 
    }
  ]);
  const [copied, setCopied] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isUserNearBottomRef = useRef(true);

  // Cleanup: stop speaking if the component unmounts or user navigates away
  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive or thinking state changes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const threshold = 120; // px from bottom
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= threshold;
  };

  const handleScroll = () => {
    isUserNearBottomRef.current = isNearBottom();
  };

  useEffect(() => {
    // Only auto-scroll if the user is already near the bottom
    if (isUserNearBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, isThinking]);

  const sendMessage = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    const currentInput = input;
    setInput("");
    setIsThinking(true);

    // When user sends a message, always scroll (they just interacted)
    isUserNearBottomRef.current = true;
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch("/api/saffi/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken() || ""}`,
        },
        body: JSON.stringify({
          message: currentInput,
          history: messages.slice(-10),
        }),
      });

      const data = await res.json();

      if (data.hermesProposal) {
        setMessages([...newMessages, { 
          role: "assistant", 
          content: "Hermes has analyzed your request and prepared actions.", 
          hermesProposal: data.hermesProposal 
        }]);
      } else if (data.reply) {
        setMessages([...newMessages, { role: "assistant", content: data.reply }]);
      } else {
        setMessages([...newMessages, { role: "assistant", content: "Sorry, something went wrong." }]);
      }
    } catch (error) {
      setMessages([...newMessages, { role: "assistant", content: "Failed to reach Saffi. Please try again." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const copyCommand = () => {
    navigator.clipboard.writeText("curl -sSL https://ourpai.ai/install.sh | bash");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Speak a message using browser speechSynthesis (prefers British English)
  const speakMessage = (text: string, index: number) => {
    // Stop any current speech
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }

    // If clicking the same message that's already speaking → just stop
    if (speakingIndex === index) {
      setSpeakingIndex(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Prefer a British English voice when available
    const voices = window.speechSynthesis.getVoices();
    const britishVoice = voices.find(v =>
      v.lang.includes("GB") || v.name.toLowerCase().includes("uk") || v.name.toLowerCase().includes("british")
    );
    if (britishVoice) {
      utterance.voice = britishVoice;
    }

    utterance.onend = () => {
      setSpeakingIndex(null);
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setSpeakingIndex(null);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeakingIndex(null);
  };

  const openVoice = () => {
    // This will open the global xAI voice component in normal (non-receptionist) mode
    window.dispatchEvent(new CustomEvent("saffi:openVoice"));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Saffi"
        subtitle="Your intelligent AI assistant for the business"
        actions={
          <button
            onClick={openVoice}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Mic className="h-4 w-4" />
            Voice Chat
          </button>
        }
      />

      {/* Chat container */}
      <div className="bg-card border border-card-border rounded-2xl flex flex-col shadow-sm overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        
        {/* Messages */}
        <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-background"
      >
        {messages.map((msg, index) => {
          // Special rendering for Hermes proposals
          if (msg.hermesProposal) {
            return (
              <HermesProposalCard 
                key={index} 
                proposal={msg.hermesProposal} 
                onApprove={async (editedProposal) => {
                  try {
                    const token = getAuthToken() || "";
                    const finalProposal = editedProposal || msg.hermesProposal;
                    const execRes = await fetch("/api/hermes/execute", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        proposal: finalProposal,
                      }),
                    });
                    const execData = await execRes.json();
                    
                    const successMsg = execData.success 
                      ? `✅ Executed: ${execData.executedActions?.join(", ") || "actions"}`
                      : `⚠️ Execution had issues: ${execData.errors?.join(", ")}`;

                    setMessages(prev => [...prev, { 
                      role: "assistant", 
                      content: successMsg 
                    }]);
                  } catch (e) {
                    setMessages(prev => [...prev, { 
                      role: "assistant", 
                      content: "Failed to execute Hermes proposal." 
                    }]);
                  }
                }}
              />
            );
          }

          const isSpeakingThis = speakingIndex === index;

          return (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : ''}`}>
              <div className={`group max-w-[80%] px-4 py-3 rounded-3xl relative ${msg.role === 'user' ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#C7D2FE]'}`}>
                {msg.content}
                
                {/* Speaker button — only on assistant messages */}
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => speakMessage(msg.content, index)}
                    className="absolute -right-2 -bottom-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-[#C7D2FE] rounded-full p-1.5 shadow-sm hover:bg-[#F0F4FF] active:scale-95"
                    title={isSpeakingThis ? "Stop speaking" : "Read aloud"}
                  >
                    {isSpeakingThis ? (
                      <Square className="w-3.5 h-3.5 text-[#2563EB]" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-[#2563EB]" />
                    )}
                  </button>
                )}

                {msg.content.includes("ourpai.ai/install.sh") && (
                  <button 
                    onClick={copyCommand}
                    className="mt-2 flex items-center gap-x-1 text-xs bg-[#2563EB] text-white px-3 py-1 rounded-xl hover:bg-[#1E40AF]"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied!" : "Copy Command"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex">
            <div className="bg-card border border-card-border rounded-3xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
              <span>Saffi is thinking…</span>
            </div>
          </div>
        )}

        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>

        {/* Input bar */}
        <div className="p-4 border-t border-border flex gap-2 bg-card shrink-0">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()} 
            placeholder={isThinking ? "Saffi is thinking..." : "Talk to Saffi..."}
            disabled={isThinking}
            className="flex-1 bg-background border border-border rounded-2xl px-5 py-3 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-60" 
          />
          <button 
            onClick={sendMessage} 
            disabled={isThinking}
            className="px-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-semibold transition-colors disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
