/**
 * Sidebar.tsx — 5-section outcome-first navigation (IA_REDESIGN.md)
 *
 * Before: 8 nav items (5 dead stubs) + 4 dead AI Actions = 9/12 broken
 * After:  5 nav items (all live) + 1 CTA = 6/6 working
 *
 * Removed:
 *   - "⚡ AI Actions" panel (all buttons pointed to /ai-studio dead stub)
 *   - Campaigns, SEO, Competitors, AI Studio, Automations
 *
 * Added:
 *   - "New Campaign" primary CTA → /plan
 *   - Outcome-first labels: Discover / Plan / Create / Publish / Learn
 */
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV = [
  { to: '/discover', label: 'Discover', icon: '🔭', desc: 'What to talk about' },
  { to: '/plan',     label: 'Plan',     icon: '📐', desc: 'Angle & campaign' },
  { to: '/create',   label: 'Create',   icon: '✦',  desc: 'Write & edit drafts' },
  { to: '/publish',  label: 'Publish',  icon: '📤', desc: 'Send or schedule' },
  { to: '/learn',    label: 'Learn',    icon: '📊', desc: 'What worked' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Founder';
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

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

        {/* New Campaign CTA */}
        <div style={{ padding: '12px 12px 8px' }}>
          <button
            onClick={() => { navigate('/plan'); onClose(); }}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              color: '#fff', letterSpacing: '-0.01em',
              transition: 'all var(--transition)',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <span style={{ fontSize: 15 }}>+</span>
            New Campaign
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 10px 8px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '8px 10px 4px' }}>
            Workflow
          </div>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              title={item.desc}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 2,
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent-light)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                textDecoration: 'none',
                transition: 'all var(--transition)',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              })}
            >
              <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          <NavLink
            to="/settings"
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 8, transition: 'color var(--transition)' }}
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
            <button
              onClick={handleSignOut}
              title="Sign out"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
