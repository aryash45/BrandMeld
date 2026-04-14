/**
 * AppLayout — The persistent authenticated shell.
 *
 * Provides:
 *  - Sidebar navigation (collapsible on mobile)
 *  - Topbar with hamburger menu toggle on mobile
 *  - Main content area via <Outlet /> (React Router's child route renderer)
 *
 * The layout does NOT render for the landing page — that route sits outside
 * the ProtectedRoute → AppLayout nesting, so it has its own full-screen design.
 */
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-body">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex items-center gap-4 border-b border-white/5 bg-slate-950 px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display text-base font-bold text-white">BrandMeld</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
