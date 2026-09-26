import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Sparkles, Send, RotateCcw, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { Investigation, Entity, AlertItem } from '../types';
 
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
 
export const AIAssistant: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const caseParam = searchParams.get('case');
 
  const [cases, setCases] = useState<Investigation[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseParam || '');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
 
  const activeCase = cases.find((c) => c.id === selectedCaseId);
 
  useEffect(() => {
    api.getInvestigations().then((list) => {
      setCases(list);
      if (!caseParam && list.length > 0) setSelectedCaseId(list[0].id);
    });
  }, []);
 
  useEffect(() => {
    if (caseParam) setSelectedCaseId(caseParam);
  }, [caseParam]);
 
  useEffect(() => {
    if (!selectedCaseId) return;
    Promise.all([api.getEntities(selectedCaseId), api.getAlerts(selectedCaseId)]).then(
      ([e, a]) => {
        setEntities(e);
        setAlerts(a);
      }
    );
  }, [selectedCaseId]);
 
  // Welcome message whenever the active case changes
  useEffect(() => {
    if (!activeCase) return;
    const primary = entities[0];
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text:
          `Welcome, Officer. I'm your ANVESHAK AI copilot.\n\n` +
          `Active Investigation: ${activeCase.title} (${activeCase.firNumber})\n` +
          `• Jurisdiction: ${activeCase.location} — ${activeCase.department}\n` +
          `• Lead Officer: ${activeCase.leadInvestigator}\n` +
          `${primary ? `• Primary Entity: ${primary.name}${primary.role ? ` (${primary.role})` : ''}\n` : ''}` +
          `\nAsk me anything in plain English, or try a suggested prompt below.`,
        timestamp: 'Just now',
      },
    ]);
  }, [activeCase?.id, entities.length]);
 
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);
 
  const handleCaseChange = (id: string) => {
    setSelectedCaseId(id);
    const params = new URLSearchParams(searchParams);
    params.set('case', id);
    navigate(`/ai-assistant?${params.toString()}`);
  };
 
  const [isTyping, setIsTyping] = useState(false);
 
  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: 'Just now',
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
 
    try {
      // Give the agent a little case context up front so answers aren't blind
      // to which investigation is active (the backend/agent has no notion of
      // "selectedCaseId" on its own).
      const contextualMessage = activeCase
        ? `[Case: ${activeCase.caseNumber} — ${activeCase.title}] ${text}`
        : text;
 
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
    `Who is the primary suspect in ${activeCase?.title || 'this case'}?`,
    `Show high-risk bank transfers for ${activeCase?.title || 'this case'}`,
    `Inspect forensic evidence exhibits for ${activeCase?.title || 'this case'}`,
  ];
 
  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Assistant
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
            Natural language intelligence assistant for Indian law enforcement officers
          </p>
        </div>
 
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live · Lyzr Agent
          </span>
          <button
            onClick={() => setMessages([])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>
 
      {/* Case selector */}
      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs w-fit">
        <span className="text-xs text-slate-400 font-medium">Case:</span>
        <select
          value={selectedCaseId}
          onChange={(e) => handleCaseChange(e.target.value)}
          className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
        >
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.caseNumber} — {c.title.slice(0, 26)}
            </option>
          ))}
        </select>
      </div>
 
      {/* Chat window */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[560px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${m.role === 'user' ? '' : 'flex gap-2.5'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                )}
                <div>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-slate-50 text-slate-800 border border-slate-200 rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.role === 'assistant' && m.verified && (
                    <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
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
                  className="text-left text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
 
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-xs bg-slate-50 border border-slate-200 text-slate-400">
                  Thinking...
                </div>
              </div>
            </div>
          )}
        </div>
 
        {/* Input */}
        <div className="border-t border-slate-100 p-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isTyping && sendMessage(input)}
            placeholder="Ask me anything in plain English..."
            disabled={isTyping}
            className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 disabled:opacity-60"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isTyping}
            className="w-9 h-9 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};