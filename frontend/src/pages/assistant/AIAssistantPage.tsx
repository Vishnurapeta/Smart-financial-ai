import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Bot, Plus } from 'lucide-react';
import { useAssistant } from '../../hooks/useAssistant.ts';
import { useAuth } from '../../context/AuthContext.tsx';

// ─── Lightweight Markdown Parsing ─────────────────────────────────────────────
const renderMarkdown = (text: string): React.ReactNode => {
  const lines = text.split('\n');

  return lines.map((line, idx) => {
    if (!line.trim()) {
      return <div key={idx} className="h-2" />;
    }

    // Bold Section Headers
    if (line.startsWith('**') && line.endsWith('**') && !line.slice(2, -2).includes('**')) {
      return (
        <h4 key={idx} className="text-white font-bold text-sm mt-3 mb-1 tracking-tight">
          {line.slice(2, -2)}
        </h4>
      );
    }

    // Indented Transaction Property Lines (e.g. "   Category: Entertainment & Leisure")
    const indentMatch = line.match(/^(\s{2,})(?:[-•]\s*)?([^:]+):\s*(.+)$/);
    if (indentMatch) {
      return (
        <div key={idx} className="ml-5 flex gap-2 text-xs leading-relaxed my-0.5 text-slate-300">
          <span className="text-slate-500 font-bold shrink-0">•</span>
          <span className="text-slate-400 font-medium">{indentMatch[2]}:</span>
          <span className="text-slate-100">{parseInline(indentMatch[3])}</span>
        </div>
      );
    }

    // Indented regular lines
    const indentPlainMatch = line.match(/^(\s{2,})(.+)$/);
    if (indentPlainMatch) {
      return (
        <div key={idx} className="ml-5 text-xs text-slate-300 leading-relaxed my-0.5">
          {parseInline(indentPlainMatch[2])}
        </div>
      );
    }

    // Numbered Item Headings (e.g. "1. **Movie / Cinema** — ₹1,000.00" or "1. Movie — ₹1,000")
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      return (
        <div key={idx} className="flex gap-2 text-xs sm:text-sm font-semibold text-white mt-2.5 mb-0.5 items-start">
          <span className="text-emerald-400 font-bold shrink-0">{numMatch[1]}.</span>
          <span>{parseInline(numMatch[2])}</span>
        </div>
      );
    }

    // Bullet Items
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={idx} className="flex gap-2 text-xs leading-relaxed my-1 items-start text-slate-200">
          <span className="text-emerald-400 font-bold shrink-0">•</span>
          <span>{parseInline(line.slice(2))}</span>
        </div>
      );
    }

    // Italic lines
    if (line.startsWith('_') && line.endsWith('_')) {
      return (
        <p key={idx} className="text-xs text-slate-400 italic my-1">
          {line.slice(1, -1)}
        </p>
      );
    }

    return (
      <p key={idx} className="text-xs sm:text-sm text-slate-200 leading-relaxed my-1">
        {parseInline(line)}
      </p>
    );
  });
};

function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    const italicMatch = remaining.match(/^(.*?)_(.+?)_(.*)/s);

    if (boldMatch && (!italicMatch || boldMatch[1].length <= italicMatch[1].length)) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(
        <strong key={key++} className="font-bold text-white">
          {boldMatch[2]}
        </strong>,
      );
      remaining = boldMatch[3];
    } else if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>);
      parts.push(
        <em key={key++} className="text-slate-300 italic">
          {italicMatch[2]}
        </em>,
      );
      remaining = italicMatch[3];
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return parts;
}

export const AIAssistantPage: React.FC = () => {
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, startNewConversation } = useAssistant();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Time of day greeting
  const hour = new Date().getHours();
  const greetingTime = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* ── 1. Top Header Bar ── */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">SMARTFIN AI</h1>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                FINANCIAL ASSISTANT
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Connected to Financial Data
          </span>
          <button
            type="button"
            onClick={() => {
              startNewConversation();
              inputRef.current?.focus();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-semibold transition cursor-pointer"
            title="Start a new chat"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* ── 2. Main Scrollable Conversation Area ── */}
      <main className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Welcome Screen when conversation is empty */}
          {messages.length === 0 && (
            <div className="text-center py-12 sm:py-16 space-y-6 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Good {greetingTime}, {user?.firstName || 'there'} 👋
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                  I can analyze your transactions, budgets, net worth, portfolio, and spending in real-time. What would you like to know?
                </p>
              </div>

              {/* Starter Query Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg mx-auto pt-2">
                {[
                  'Show my all transactions',
                  'What are my total expenses?',
                  'How much did I spend on food?',
                  'Give me my financial summary',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="text-left p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition flex items-center justify-between group cursor-pointer shadow-sm"
                  >
                    <span>{q}</span>
                    <span className="text-slate-500 group-hover:text-emerald-400 transition">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Messages */}
          {messages.map((msg) => (
            <div key={msg.id} className="animate-in fade-in duration-200">
              {msg.role === 'user' ? (
                /* User Message: Right Aligned */
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-xs px-4 py-3 bg-emerald-600 text-white shadow-md text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                    <p>{msg.content}</p>
                    <div className="text-[10px] text-emerald-200 mt-1.5 text-right font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ) : (
                /* AI Message: Left Aligned with Avatar */
                <div className="flex justify-start gap-3 items-start">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 max-w-[88%] rounded-2xl rounded-tl-xs px-4 py-3.5 bg-slate-900/90 border border-slate-800/80 text-slate-100 shadow-md text-xs sm:text-sm leading-relaxed">
                    {msg.isPending ? (
                      <div className="flex items-center gap-2 py-1 text-slate-400">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                        </div>
                        <span className="text-xs">Analyzing your financial data...</span>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          {renderMarkdown(msg.content)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-2 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── 3. Sticky Bottom Input Area ── */}
      <footer className="border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center bg-slate-900 border border-slate-700/80 focus-within:border-emerald-500 rounded-2xl shadow-xl transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your finances... (e.g. Show my all transactions)"
              rows={1}
              className="w-full bg-transparent pl-4 pr-12 py-3.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none resize-none max-h-32 scrollbar-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20 cursor-pointer flex items-center justify-center"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-2">
            <span>Shift + Enter for new line • Enter to send</span>
            <span>SMARTFIN AI • Real Database Connection</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AIAssistantPage;
