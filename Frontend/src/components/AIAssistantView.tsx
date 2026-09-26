import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, RotateCcw, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { Entity, AlertItem } from '../types';

// FastAPI backend base URL (same var used across the app for the real backend).
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  verified?: boolean;
  confidence?: number;
  timestamp: string;
}

// Confirmed shape from the Lyzr agent (via /api/chat -> lyzr_chat.call_lyzr_agent):
// { "response": "...the reply text...", "module_outputs": { "documents": [...] } }
// module_outputs.documents are the RAG source chunks the agent pulled from
// (e.g. FIR records) — not shown as chat text, but kept available for a
// future "sources" panel if wanted.
function extractReplyText(data: any): string {
  if (typeof data?.response === 'string') return data.response;
  return typeof data === 'string' ? data : JSON.stringify(data);
}

interface AIAssistantViewProps {
  currentCase: string;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({ currentCase }) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([api.getEntities(), api.getAlerts()]).then(([e, a]) => {
      setEntities(e);
      setAlerts(a);
    });
  }, []);

  useEffect(() => {
    const primary = entities[0];
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text:
          `Welcome, Officer. I'm your ANVESHAKX AI copilot.\n\n` +
          `Active Investigation: ${currentCase}\n` +
          `${primary ? `• Primary Entity: ${primary.name}${primary.role ? ` (${primary.role})` : ''}\n` : ''}` +
          `\nAsk me anything in plain English, or try a suggested prompt below.`,
        timestamp: 'Just now',
      },
    ]);
  }, [currentCase, entities.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text, timestamp: 'Just now' };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const contextualMessage = `[Case: ${currentCase}] ${text}`;
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: contextualMessage }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || `Chat request failed (HTTP ${res.status})`);
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: extractReplyText(data),
        verified: true,
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: `⚠️ Couldn't reach the AI assistant (${err?.message || 'unknown error'}). Is the backend running?`,
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestedPrompts = [
    `Who is the primary suspect in ${currentCase}?`,
    `Show high-risk bank transfers for ${currentCase}`,
    `Inspect forensic evidence exhibits for ${currentCase}`,
  ];

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="text-xs text-[#726c5d] font-medium tracking-wide mb-1">Case {currentCase}</div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#a94e2c]" />
            AI Assistant
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#3d6b53]/10 text-[#3d6b53] border border-[#3d6b53]/25">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3d6b53] animate-pulse" />
            Live · Lyzr Agent
          </span>
          <button
            onClick={() => setMessages([])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-[#f4f2ea] border border-[#ddd6c6] rounded-lg shadow-2xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Chat window */}
      <div className="bg-[#fffefb] rounded-xl border border-[#ddd6c6] shadow-2xs flex flex-col h-[560px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${m.role === 'user' ? '' : 'flex gap-2.5'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-[#a94e2c]/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-[#a94e2c]" />
                  </div>
                )}
                <div>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                      m.role === 'user'
                        ? 'bg-[#182029] text-white rounded-br-sm'
                        : 'bg-[#f4f2ea] text-slate-800 border border-[#ddd6c6] rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.role === 'assistant' && m.verified && (
                    <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 text-[#3d6b53] font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified with case data
                      </span>
                      <span>AI Confidence: {m.confidence}%</span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-300 mt-0.5 px-1">{m.timestamp}</div>
                </div>
              </div>
            </div>
          ))}

          {messages.length === 1 && (
            <div className="flex flex-col gap-2 pl-9 pt-2">
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-left text-xs font-medium text-[#a94e2c] bg-[#a94e2c]/8 hover:bg-[#a94e2c]/15 border border-[#a94e2c]/25 rounded-lg px-3 py-2 transition-colors cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#a94e2c]/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-[#a94e2c]" />
                </div>
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-xs bg-[#f4f2ea] border border-[#ddd6c6] text-slate-400">
                  Thinking...
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[#e8e2d4] p-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isTyping && sendMessage(input)}
            placeholder="Ask me anything in plain English..."
            disabled={isTyping}
            className="flex-1 px-3.5 py-2.5 text-xs bg-[#f4f2ea] border border-[#ddd6c6] rounded-xl focus:outline-none focus:border-[#a94e2c] disabled:opacity-60"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isTyping}
            className="w-9 h-9 shrink-0 rounded-xl bg-[#a94e2c] hover:bg-[#8f4124] text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};