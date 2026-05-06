import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { to: '/content',   label: 'Content',   icon: '✦' },
  { to: '/campaigns', label: 'Campaigns', icon: '◈' },
  { to: '/seo',       label: 'SEO',       icon: '◎' },
  { to: '/analytics', label: 'Analytics', icon: '▸' },
  { to: '/competitors',label:'Competitors',icon: '◇' },
  { to: '/ai-studio', label: 'AI Studio', icon: '∿' },
  { to: '/automations',label:'Automations',icon: '⟳' },
];

const AI_ACTIONS = [
  { label: 'Generate 30-day content plan',  color: 'var(--accent)' },
  { label: 'Fix declining SEO keywords',    color: 'var(--red)' },
  { label: 'Repurpose top-performing post', color: 'var(--green)' },
  { label: 'Analyze competitor gaps',       color: 'var(--amber)' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [aiOpen, setAiOpen] = useState(true);

  const displayName = (user?.user_metadata?.name as string | undefined)
    ?? user?.email?.split('@')[0]
    ?? 'Founder';

  const initials = displayName.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (to: string) =>
    to === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(to);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      <aside style={{
        position: 'fixed',
        inset: '0 auto 0 0',
        zIndex: 50,
        width: 'var(--sidebar-w)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        transform: isOpen ? 'translateX(0)' : undefined,
        transition: 'transform var(--transition)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--blue) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0,
            }}>B</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              BrandMeld
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>
              AI
            </span>
          </div>
        </div>

        {/* AI Action Center */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setAiOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 18px', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1, textAlign: 'left' }}>
              ⚡ AI Actions
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: aiOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {aiOpen && (
            <div style={{ padding: '0 10px 12px' }}>
              {AI_ACTIONS.map((a, i) => (
                <button
                  key={i}
                  onClick={() => navigate('/ai-studio')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    transition: 'background var(--transition)',
                    color: 'var(--text-secondary)', fontSize: 12,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 10px' }}>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              style={({ isActive: linkActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 2,
                fontSize: 13.5,
                fontWeight: linkActive || isActive(item.to) ? 600 : 400,
                color: linkActive || isActive(item.to) ? 'var(--accent-light)' : 'var(--text-secondary)',
                background: linkActive || isActive(item.to) ? 'var(--accent-dim)' : 'transparent',
                textDecoration: 'none',
                transition: 'all var(--transition)',
                borderLeft: linkActive || isActive(item.to) ? '2px solid var(--accent)' : '2px solid transparent',
              })}
            >
              <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          <NavLink
            to="/settings"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 8 }}
          >
            <span>⚙</span> Settings
          </NavLink>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--blue))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Free plan</div>
            </div>
            <button onClick={handleSignOut} title="Sign out" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
