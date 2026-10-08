import React from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutProvider } from '../../context/LayoutContext.tsx';
import { Sidebar } from './Sidebar.tsx';
import { TopHeader } from './TopHeader.tsx';
import { FloatingAIAssistant } from '../assistant/FloatingAIAssistant.tsx';

const AppLayoutInner: React.FC = () => {
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* FIXED TOP HEADER */}
      <TopHeader />

      {/* Main Workspace below top header */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* FIXED LEFT SIDEBAR */}
        <Sidebar />

        {/* SCROLLABLE CONTENT: only this area scrolls */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Floating Bottom-Right AI Assistant Launcher & Chat Panel */}
      <FloatingAIAssistant />
    </div>
  );
};

export const AppLayout: React.FC = () => {
  return (
    <LayoutProvider>
      <AppLayoutInner />
    </LayoutProvider>
  );
};

export default AppLayout;
