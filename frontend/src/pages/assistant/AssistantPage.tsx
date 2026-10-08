import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAssistant } from '../../hooks/useAssistant.ts';
import type { UIMessage, QuickAction } from '../../types/assistant.ts';

// ─── Icon helper ──────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) => {
  const icons: Record<string, React.ReactNode> = {
    send: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    bot: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>,
    user: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    plus: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trash: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    clear: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.96"/></svg>,
    sparkle: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.8 9.8 2 12l7.8 2.2L12 22l2.2-7.8L22 12l-7.8-2.2z"/></svg>,
    shield: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    check: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    receipt: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="16" y1="8" x2="8" y2="8"/><line x1="16" y1="12" x2="8" y2="12"/><line x1="16" y1="16" x2="12" y2="16"/></svg>,
    'bar-chart': <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    'trending-up': <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    target: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    wallet: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>,
    activity: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    'alert-triangle': <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    calendar: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    'shopping-bag': <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    'pie-chart': <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
    bank: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7 12 2"/></svg>,
    'chart-line': <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="3" x2="3" y2="21"/><line x1="3" y1="21" x2="21" y2="21"/><polyline points="7 14 11 10 14 13 19 8"/></svg>,
    menu: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    x: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    chat: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  };
  return <span className={`icon ${className}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icons[name] || null}</span>;
};

// ─── Markdown Renderer ────────────────────────────────────────────────────────
const renderMarkdown = (text: string): React.ReactNode => {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let keyCounter = 0;
  const key = () => `md-${keyCounter++}`;

  for (const line of lines) {
    if (!line.trim()) {
      result.push(<br key={key()} />);
      continue;
    }

    // Headers
    if (line.startsWith('**') && line.endsWith('**') && !line.slice(2, -2).includes('**')) {
      result.push(<h4 key={key()} style={{ color: '#e2e8f0', fontWeight: 700, margin: '8px 0 4px', fontSize: '1rem' }}>{line.slice(2, -2)}</h4>);
      continue;
    }

    // List items
    if (line.startsWith('- ') || line.startsWith('• ')) {
      const content = line.slice(2);
      result.push(
        <div key={key()} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'flex-start' }}>
          <span style={{ color: '#7c86f5', flexShrink: 0, marginTop: '2px' }}>•</span>
          <span style={{ flex: 1 }}>{parseInline(content)}</span>
        </div>,
      );
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\. (.+)$/);
    if (numMatch) {
      result.push(
        <div key={key()} style={{ display: 'flex', gap: '10px', marginBottom: '4px', alignItems: 'flex-start' }}>
          <span style={{ color: '#7c86f5', fontWeight: 700, minWidth: '20px', flexShrink: 0 }}>{numMatch[1]}.</span>
          <span style={{ flex: 1 }}>{parseInline(numMatch[2])}</span>
        </div>,
      );
      continue;
    }

    // Italic disclaimer lines
    if (line.startsWith('_') && line.endsWith('_')) {
      result.push(<p key={key()} style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', margin: '4px 0' }}>{line.slice(1, -1)}</p>);
      continue;
    }

    result.push(<p key={key()} style={{ margin: '2px 0' }}>{parseInline(line)}</p>);
  }

  return <>{result}</>;
};

function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let i = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    const italicMatch = remaining.match(/^(.*?)_(.+?)_(.*)/s);

    if (boldMatch && (!italicMatch || boldMatch[1].length <= italicMatch[1].length)) {
      if (boldMatch[1]) parts.push(<span key={i++}>{boldMatch[1]}</span>);
      parts.push(<strong key={i++} style={{ color: '#c9d1e0', fontWeight: 700 }}>{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
    } else if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={i++}>{italicMatch[1]}</span>);
      parts.push(<em key={i++} style={{ color: '#94a3b8' }}>{italicMatch[2]}</em>);
      remaining = italicMatch[3];
    } else {
      parts.push(<span key={i++}>{remaining}</span>);
      break;
    }
  }

  return <>{parts}</>;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
const MessageBubble: React.FC<{ message: UIMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isPending = message.isPending;
  const isError = message.isError;

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: '12px',
      alignItems: 'flex-start',
      marginBottom: '16px',
      animation: 'slideInMsg 0.3s ease-out',
    }}>
      {/* Avatar */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser
          ? 'linear-gradient(135deg, #667eea, #764ba2)'
          : 'linear-gradient(135deg, #11998e, #38ef7d)',
        boxShadow: `0 4px 15px ${isUser ? 'rgba(102, 126, 234, 0.4)' : 'rgba(17, 153, 142, 0.4)'}`,
      }}>
        <Icon name={isUser ? 'user' : 'bot'} size={16} />
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '72%',
        background: isUser
          ? 'linear-gradient(135deg, #667eea20, #764ba220)'
          : isError
          ? 'rgba(239, 68, 68, 0.1)'
          : 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${isUser ? 'rgba(102, 126, 234, 0.3)' : isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
        borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
        padding: '14px 18px',
        backdropFilter: 'blur(10px)',
      }}>
        {isPending ? (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '4px 0' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #11998e, #38ef7d)',
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '4px' }}>Analyzing your data...</span>
          </div>
        ) : (
          <>
            <div style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.6', fontFamily: 'Inter, sans-serif' }}>
              {isUser ? message.content : renderMarkdown(message.content)}
            </div>

            {/* Tool grounding badge */}
            {!isUser && message.isGrounded && message.toolsUsed && message.toolsUsed.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'rgba(56, 239, 125, 0.1)', border: '1px solid rgba(56, 239, 125, 0.25)',
                  borderRadius: '20px', padding: '2px 8px',
                  fontSize: '0.72rem', color: '#38ef7d',
                }}>
                  <Icon name="shield" size={11} />
                  Grounded data — no hallucination
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#475569', textAlign: isUser ? 'right' : 'left' }}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Quick Action Card ────────────────────────────────────────────────────────
const QuickActionCard: React.FC<{ action: QuickAction; onClick: (prompt: string) => void }> = ({ action, onClick }) => {
  const [hovered, setHovered] = useState(false);

  const categoryColors: Record<string, string> = {
    Spending: '#667eea', Budgets: '#f59e0b', Goals: '#10b981',
    Savings: '#06b6d4', Wealth: '#8b5cf6', Investments: '#ec4899',
    'Cash Flow': '#14b8a6', Anomalies: '#ef4444', Forecasts: '#f97316', Analytics: '#6366f1',
  };

  const color = categoryColors[action.category] || '#667eea';

  return (
    <button
      onClick={() => onClick(action.prompt)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? `${color}18` : 'rgba(255, 255, 255, 0.03)',
        border: `1px solid ${hovered ? `${color}50` : 'rgba(255, 255, 255, 0.07)'}`,
        borderRadius: '12px',
        padding: '12px 14px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 8px 20px ${color}20` : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px',
          background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, flexShrink: 0,
        }}>
          <Icon name={action.icon} size={14} />
        </div>
        <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600 }}>{action.label}</span>
      </div>
      <p style={{ color: '#64748b', fontSize: '0.72rem', margin: 0, lineHeight: 1.4 }}>{action.prompt}</p>
    </button>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AssistantPage: React.FC = () => {
  const {
    messages, isLoading, conversationId, conversations, quickActions,
    suggestedFollowUps, sendMessage, loadConversation, startNewConversation,
    deleteConversation, clearConversation,
  } = useAssistant();

  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasMessages = messages.length > 0;

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
    inputRef.current?.focus();
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt);
    inputRef.current?.focus();
  };

  const handleSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  // Group quick actions by category
  const actionsByCategory = quickActions.reduce<Record<string, QuickAction[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1224 50%, #0a0f1e 100%)',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <style>{`
        @keyframes slideInMsg { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%, 100% { transform: scale(0.7); opacity: 0.5; } 50% { transform: scale(1); opacity: 1; } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        textarea:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .conv-item:hover { background: rgba(255,255,255,0.06) !important; }
      `}</style>

      {/* ── Sidebar ── */}
      <div style={{
        width: sidebarOpen ? '280px' : '0',
        minWidth: sidebarOpen ? '280px' : '0',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
            }}>
              <Icon name="sparkle" size={16} />
            </div>
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>SmartFin AI</div>
              <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Financial Assistant</div>
            </div>
          </div>

          <button
            onClick={startNewConversation}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none', cursor: 'pointer', color: 'white',
              fontWeight: 600, fontSize: '0.82rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'opacity 0.2s',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.35)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <Icon name="plus" size={14} />
            New Conversation
          </button>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>
              <Icon name="chat" size={24} className="" />
              <p style={{ marginTop: '8px' }}>No conversations yet.</p>
              <p>Start by asking a question!</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div key={conv.id}
                className="conv-item"
                style={{
                  borderRadius: '8px', padding: '10px 10px',
                  marginBottom: '4px', cursor: 'pointer',
                  background: conversationId === conv.id ? 'rgba(102, 126, 234, 0.12)' : 'transparent',
                  border: conversationId === conv.id ? '1px solid rgba(102, 126, 234, 0.25)' : '1px solid transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  transition: 'all 0.15s',
                }}
                onClick={() => loadConversation(conv.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title}
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.72rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.lastMessage || `${conv.messageCount} messages`}
                  </div>
                  <div style={{ color: '#334155', fontSize: '0.68rem', marginTop: '2px' }}>
                    {new Date(conv.lastActivityAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '2px', borderRadius: '4px', opacity: 0.6 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.opacity = '0.6'; }}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Sidebar footer - disclaimer */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{
            background: 'rgba(56, 239, 125, 0.08)', border: '1px solid rgba(56, 239, 125, 0.15)',
            borderRadius: '8px', padding: '8px 10px',
            display: 'flex', gap: '6px', alignItems: 'flex-start',
          }}>
            <Icon name="shield" size={13} className="" />
            <p style={{ color: '#38ef7d', fontSize: '0.68rem', margin: 0, lineHeight: 1.4 }}>
              All responses are grounded in your actual data. No hallucination. No investment advice.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex', alignItems: 'center', gap: '14px',
          backdropFilter: 'blur(20px)',
        }}>
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '6px' }}
          >
            <Icon name={sidebarOpen ? 'x' : 'menu'} size={20} />
          </button>

          <div>
            <h1 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
              AI Financial Assistant
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.78rem', margin: 0 }}>
              Ask anything about your finances — powered by your real data
            </p>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {conversationId && (
              <button
                onClick={clearConversation}
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px', cursor: 'pointer', color: '#94a3b8', padding: '7px 12px',
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
              >
                <Icon name="clear" size={14} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Messages or Welcome */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', position: 'relative' }}>
          {!hasMessages ? (
            /* Welcome / Quick Actions Screen */
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              {/* Hero */}
              <div style={{ textAlign: 'center', marginBottom: '40px', paddingTop: '20px' }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '24px',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)',
                }}>
                  <Icon name="sparkle" size={32} />
                </div>
                <h2 style={{
                  color: 'white', fontWeight: 800, fontSize: '1.8rem', margin: '0 0 10px',
                  background: 'linear-gradient(135deg, #e2e8f0, #94a3b8)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Your AI Financial Assistant
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '460px', margin: '0 auto' }}>
                  Ask questions about your spending, budgets, goals, investments, and more. All answers come from your real financial data.
                </p>
              </div>

              {/* Quick Actions */}
              <div>
                {Object.entries(actionsByCategory).map(([category, actions]) => (
                  <div key={category} style={{ marginBottom: '20px' }}>
                    <h3 style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                      {category}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                      {actions.map((action) => (
                        <QuickActionCard key={action.label} action={action} onClick={handleQuickAction} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Example queries */}
              <div style={{
                marginTop: '24px', padding: '16px 20px',
                background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '16px',
              }}>
                <p style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Try asking:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    'How much did I spend last month?',
                    'Am I over budget?',
                    'Show my savings rate',
                    'Any unusual charges?',
                    'Show cash flow trend for 6 months',
                    "What's my net worth?",
                  ].map((q) => (
                    <button key={q} onClick={() => handleQuickAction(q)}
                      style={{
                        background: 'rgba(102, 126, 234, 0.08)', border: '1px solid rgba(102, 126, 234, 0.2)',
                        borderRadius: '20px', padding: '6px 14px', cursor: 'pointer',
                        color: '#94a3b8', fontSize: '0.8rem', transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(102, 126, 234, 0.15)'; e.currentTarget.style.color = '#c4b5fd'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Messages */
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Suggested follow-ups */}
              {!isLoading && suggestedFollowUps.length > 0 && (
                <div style={{ marginTop: '8px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {suggestedFollowUps.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSuggestion(s)}
                      style={{
                        background: 'rgba(102, 126, 234, 0.08)', border: '1px solid rgba(102, 126, 234, 0.25)',
                        borderRadius: '20px', padding: '7px 14px', cursor: 'pointer',
                        color: '#a5b4fc', fontSize: '0.8rem', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(102, 126, 234, 0.18)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)'; }}
                    >
                      <Icon name="sparkle" size={11} />
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div style={{
          padding: '16px 24px 24px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{
              display: 'flex', gap: '12px', alignItems: 'flex-end',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px', padding: '12px 16px',
              transition: 'border-color 0.2s',
            }}
              onFocus={() => {}}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your finances... (Enter to send, Shift+Enter for new line)"
                rows={1}
                disabled={isLoading}
                style={{
                  flex: 1, background: 'none', border: 'none',
                  color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5',
                  resize: 'none', maxHeight: '120px', overflowY: 'auto',
                  fontFamily: 'Inter, sans-serif',
                  cursor: isLoading ? 'not-allowed' : 'text',
                  opacity: isLoading ? 0.6 : 1,
                }}
              />

              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                style={{
                  width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                  background: (!input.trim() || isLoading)
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'linear-gradient(135deg, #667eea, #764ba2)',
                  border: 'none', cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
                  color: (!input.trim() || isLoading) ? '#475569' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: (!input.trim() || isLoading) ? 'none' : '0 4px 15px rgba(102, 126, 234, 0.4)',
                }}
              >
                <Icon name="send" size={16} />
              </button>
            </div>

            <p style={{ color: '#334155', fontSize: '0.72rem', textAlign: 'center', marginTop: '8px' }}>
              All data is sourced from your SmartFin account. Not financial advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantPage;
