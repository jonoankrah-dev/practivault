'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Square } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function DeveloperAgentChat({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi, I'm your internal Developer Agent (powered by Hermes + Grok + PAI memory coming soon). I can read the codebase, diagnose issues, and propose fixes. I'll always ask for your approval before making any changes. What would you like to work on?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<any>(null);
  const [toolActivity, setToolActivity] = useState<any[]>([]);
  const [sessionId] = useState(() => (typeof crypto !== 'undefined' ? crypto.randomUUID() : 'dev-' + Date.now()));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/developer-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage },
          ],
          sessionId,
        }),
      });

      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);

        // Show tool activity for reads etc (makes "read actual files" visible)
        if (data.toolResults && Array.isArray(data.toolResults)) {
          setToolActivity((prev) => [...prev, ...data.toolResults]);
          const lastTool = data.toolResults[data.toolResults.length - 1];
          if (lastTool && lastTool.status === "proposed") {
            setPendingProposal(lastTool);
          }
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "Sorry, I ran into an issue. Please try again." },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I'm having trouble connecting to the agent right now." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopAgent = () => {
    // For Phase 1, just clear the conversation and close.
    // Later we'll add a proper stop signal to the backend.
    setMessages([
      {
        role: 'assistant',
        content: "Agent stopped. What would you like to work on next?",
      },
    ]);
    setLoading(false);
    if (onClose) onClose();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#0A66C2] text-white'
                  : 'bg-white border border-[#E2E8F0] text-[#1E2937]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Tool activity for visibility of reads, lists, etc (1) */}
        {toolActivity.length > 0 && (
          <div className="space-y-2">
            {toolActivity.map((t, i) => (
              <div key={i} className="text-xs bg-[#F1F5F9] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#475569]">
                <span className="font-medium">Agent tool:</span> {t.name || t.tool || 'action'} {t.path ? `→ ${t.path}` : ''}
                {t.content && <div className="mt-1 text-[10px] opacity-70 line-clamp-2">{String(t.content).slice(0, 200)}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Pending proposal card with Approve/Reject (2) */}
        {pendingProposal && (
          <div className="border border-[#0A66C2] bg-white rounded-2xl p-4 text-sm">
            <div className="font-semibold text-[#0A66C2] mb-1">📝 Proposed Edit</div>
            <div className="text-[#334155] mb-2">{pendingProposal.explanation || 'Code change proposed.'}</div>
            {pendingProposal.path && <div className="text-xs text-[#64748B] mb-2">File: {pendingProposal.path}</div>}
            {pendingProposal.diff && (
              <pre className="bg-[#0F172A] text-[#E2E8F0] text-[10px] p-2 rounded overflow-auto max-h-32 mb-3">{pendingProposal.diff}</pre>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Approve: send approval message so agent applies (real flow)
                  const approvalMsg = `I approve the proposed edit to ${pendingProposal.path}. Please call the apply_edit tool now with the new content.`;
                  setPendingProposal(null);
                  setInput(approvalMsg);
                  // auto send
                  setTimeout(() => sendMessage(), 50);
                }}
                className="flex-1 bg-[#0A66C2] text-white rounded-xl py-2 text-sm font-medium hover:bg-[#0952A0]"
              >
                Approve & Apply
              </button>
              <button
                onClick={() => {
                  setPendingProposal(null);
                  setMessages((prev) => [...prev, { role: 'assistant', content: 'Proposal rejected. What would you like to do instead?' }]);
                }}
                className="flex-1 border border-[#CBD5E1] rounded-xl py-2 text-sm hover:bg-[#F8FAFC]"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the issue or what you want to build..."
            className="flex-1 rounded-xl border px-4 py-2 text-sm focus:outline-none focus:border-[#0A66C2]"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-[#0A66C2] px-4 text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
          <button
            onClick={stopAgent}
            className="rounded-xl border px-3 text-red-600 hover:bg-red-50"
            title="Stop agent"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[#94A3B8]">
          Developer Agent • Phase 1 • Asks before major changes
        </p>
      </div>
    </div>
  );
}
