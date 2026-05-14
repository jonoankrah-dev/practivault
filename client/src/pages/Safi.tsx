'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Copy, Check } from 'lucide-react';

interface SaffiProps {
  onNavigate?: (section: 'dashboard' | 'clients' | 'settings') => void;
  businessId?: string;
  clientCount?: number;
  revenue?: string;
}

export default function Saffi({ 
  onNavigate, 
  businessId = "LUM-2026-0427",
  clientCount = 47,
  revenue = "£3,284"
}: SaffiProps) {
  
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { 
      role: "assistant", 
      content: `Hi, I'm Saffi. My brain runs on OurPai.ai (PAI). I'm connected to your PractiVault data. You have ${clientCount} clients and today's revenue is ${revenue}. Business ID: ${businessId}. What would you like me to handle?` 
    }
  ]);
  const [copied, setCopied] = useState(false);

  const handleCommand = (command: string) => {
    const lower = command.toLowerCase();
    let reply = "Got it! What would you like me to do next?";

    if (lower.includes("dashboard") || lower.includes("home")) {
      onNavigate?.('dashboard');
      reply = "Opening the Dashboard for you.";
    } 
    else if (lower.includes("client")) {
      onNavigate?.('clients');
      reply = "Here are your clients.";
    } 
    else if (lower.includes("setting") || lower.includes("business") || lower.includes("id")) {
      onNavigate?.('settings');
      reply = `Your Business ID is **${businessId}**.`;
    } 
    else if (lower.includes("ourpai") || lower.includes("install") || lower.includes("pai brain")) {
      reply = "To install the OurPai.ai (PAI) runtime that powers my brain:";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "curl -sSL https://ourpai.ai/install.sh | bash" 
        }]);
      }, 300);
      return;
    }

    setMessages(prev => [...prev, { role: "assistant", content: reply }]);
  };

  const sendMessage = () => {
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages([...messages, userMsg]);
    const currentInput = input;
    setInput("");

    setTimeout(() => {
      handleCommand(currentInput);
    }, 500);
  };

  const copyCommand = () => {
    navigator.clipboard.writeText("curl -sSL https://ourpai.ai/install.sh | bash");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Floating Saffi Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-[#2563EB] hover:bg-[#1E40AF] text-white rounded-full flex items-center justify-center shadow-2xl z-50"
      >
        <MessageCircle className="w-8 h-8" />
      </button>

      {/* Saffi Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={() => setIsOpen(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-[#2563EB] px-6 py-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-x-3">
                  <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">S</div>
                  <div>
                    <div className="font-semibold">Saffi AI</div>
                    <div className="text-xs opacity-80">Powered by PractiVault</div>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="h-96 overflow-y-auto p-6 space-y-4 bg-[#EEF2FF]">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    <div className={`max-w-[80%] px-4 py-3 rounded-3xl ${msg.role === 'user' ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#C7D2FE]'}`}>
                      {msg.content}
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
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-[#C7D2FE] flex gap-2 bg-white">
                <input 
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()} 
                  placeholder="Try: open settings, show clients, install ourpai..." 
                  className="flex-1 bg-white border border-[#C7D2FE] rounded-2xl px-5 py-3 focus:outline-none" 
                />
                <button 
                  onClick={sendMessage} 
                  className="px-6 bg-[#2563EB] hover:bg-[#1E40AF] text-white rounded-2xl font-semibold"
                >
                  Send
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
