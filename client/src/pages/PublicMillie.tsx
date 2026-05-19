'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function PublicMillie() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi, I'm Millie from the endoPulse team. How can I help you with the machine or training today? xx",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
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
      const res = await fetch('/api/public/millie/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: userMessage,
        }),
      });

      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "Sorry, something went wrong. Please try again." },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I'm having a bit of trouble connecting right now. Please try again in a moment. xx" },
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

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      {/* Header - Clean & Professional */}
      <div className="border-b bg-white px-6 py-5 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#E83A8E] flex items-center justify-center text-white font-semibold text-lg">
            M
          </div>
          <div>
            <div className="font-semibold text-xl text-[#1E2937]">Millie</div>
            <div className="text-sm text-[#64748B]">endoPulse Advisor</div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 bg-[#F8FAFC]">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[#E83A8E] text-white rounded-br-md'
                    : 'bg-white border border-[#E2E8F0] text-[#1E2937] rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-[#E2E8F0] rounded-2xl px-5 py-3.5 flex items-center gap-2 text-sm text-[#64748B]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Millie is thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the machine, training, results, pricing..."
              className="flex-1 border border-[#CBD5E1] focus:border-[#E83A8E] rounded-2xl px-5 py-3.5 text-[15px] outline-none"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-[#E83A8E] hover:bg-[#C82A7A] disabled:opacity-50 text-white rounded-2xl p-3.5 transition-colors flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-[11px] text-[#94A3B8] mt-3">
            This is a real conversation with Millie from the endoPulse team.
          </p>
        </div>
      </div>
    </div>
  );
}
