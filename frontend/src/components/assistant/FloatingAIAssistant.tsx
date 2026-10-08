import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Bot } from 'lucide-react';

export const FloatingAIAssistant: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide floating launcher if already on the dedicated AI Assistant workspace
  const isOnAssistantRoute =
    location.pathname.startsWith('/ai-assistant') || location.pathname.startsWith('/assistant');

  if (isOnAssistantRoute) {
    return null;
  }

  const handleOpenWorkspace = () => {
    navigate('/ai-assistant');
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end pointer-events-auto">
      <button
        onClick={handleOpenWorkspace}
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-slate-950 font-bold shadow-2xl transition-all duration-300 group cursor-pointer bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-400 shadow-emerald-500/30 hover:scale-105 active:scale-95"
        title="Open SMARTFIN AI Financial Assistant"
        aria-label="Open SMARTFIN AI Financial Assistant"
      >
        {/* Subtle glow / pulsing ring */}
        <span className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 opacity-40 blur group-hover:opacity-75 transition duration-500 animate-pulse" />
        <div className="relative flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-slate-950" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-slate-950 border-2 border-emerald-400" />
        </div>

        {/* Hover Tooltip */}
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
          <span>SMARTFIN AI Assistant</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono border border-emerald-500/30">
            WORKSPACE
          </span>
        </span>
      </button>
    </div>
  );
};

export default FloatingAIAssistant;
