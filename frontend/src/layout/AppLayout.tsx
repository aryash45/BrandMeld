import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Sidebar — always shown on desktop, slide-in on mobile */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area offset by sidebar width on desktop */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginLeft: 'var(--sidebar-w)',
      }}>
        {/* Mobile topbar */}
        <header style={{
          display: 'none',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }} className="mobile-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
            aria-label="Open navigation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>BrandMeld</span>
        </header>

        {/* Page content */}
        <main key={location.pathname} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-topbar { display: flex !important; }
          div[style*="margin-left: var(--sidebar-w)"] { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default AppLayout;
