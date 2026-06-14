/**
 * SettingsPage — Account management, connected platforms, and preferences.
 *
 * Sections:
 *   Profile          — avatar, name, email, member since
 *   Connected Accounts — LinkedIn (OAuth), Twitter (Web Intent), Instagram (coming soon)
 *   Preferences      — timezone, notification toggles
 *   Session          — sign out
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConnectedAccounts } from '../hooks/useConnectedAccounts';
import type { SocialPlatform } from '../services/apiService';

// ─── Platform metadata ────────────────────────────────────────────────────────

interface PlatformConfig {
  id: SocialPlatform;
  label: string;
  description: string;
  badge: string;
  color: string;
  bg: string;
  border: string;
  phase: 'live' | 'intent' | 'soon';
  phaseLabel: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    description: 'Publish posts directly via LinkedIn API',
    badge: 'in',
    color: '#0A66C2',
    bg: 'rgba(10,102,194,0.08)',
    border: 'rgba(10,102,194,0.3)',
    phase: 'live',
    phaseLabel: 'Full OAuth',
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    description: 'Opens X composer pre-filled with your draft',
    badge: '𝕏',
    color: '#e2e8f0',
    bg: 'rgba(226,232,240,0.06)',
    border: 'rgba(226,232,240,0.2)',
    phase: 'intent',
    phaseLabel: 'Web Intent',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    description: 'Instagram API integration — coming soon',
    badge: 'IG',
    color: '#E1306C',
    bg: 'rgba(225,48,108,0.06)',
    border: 'rgba(225,48,108,0.15)',
    phase: 'soon',
    phaseLabel: 'Coming Soon',
  },
];

// ─── Connected platform card ──────────────────────────────────────────────────

interface PlatformCardProps {
  config: PlatformConfig;
  connected: boolean;
  handle?: string;
  note?: string;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

const PlatformCard: React.FC<PlatformCardProps> = ({
  config, connected, handle, loading, onConnect, onDisconnect,
}) => {
  const isSoon = config.phase === 'soon';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '18px 20px',
        background: connected ? `${config.bg}` : 'var(--surface)',
        border: `1px solid ${connected ? config.border : 'var(--border)'}`,
        borderRadius: 12,
        transition: 'all 0.2s ease',
        opacity: isSoon ? 0.6 : 1,
      }}
    >
      {/* Platform icon */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: `${config.color}18`,
          border: `1.5px solid ${config.color}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          color: config.color,
          fontSize: 15,
          flexShrink: 0,
          letterSpacing: -0.5,
        }}
      >
        {config.badge}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {config.label}
          </span>
          {/* Phase badge */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 20,
              background: isSoon
                ? 'rgba(148,163,184,0.12)'
                : config.phase === 'live'
                ? 'rgba(16,185,129,0.12)'
                : 'rgba(251,191,36,0.12)',
              color: isSoon ? '#94a3b8' : config.phase === 'live' ? '#10b981' : '#fbbf24',
              border: `1px solid ${isSoon ? '#94a3b844' : config.phase === 'live' ? '#10b98144' : '#fbbf2444'}`,
            }}
          >
            {config.phaseLabel}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {connected && handle ? (
            <span style={{ color: config.color, fontWeight: 500 }}>@{handle}</span>
          ) : (
            config.description
          )}
        </div>
      </div>

      {/* Status dot + action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Status indicator */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#10b981' : isSoon ? '#475569' : '#475569',
            boxShadow: connected ? '0 0 6px #10b981aa' : 'none',
          }}
        />

        {/* Action button */}
        {isSoon ? (
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              padding: '6px 14px',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            Notify me
          </span>
        ) : connected ? (
          <button
            onClick={onDisconnect}
            disabled={loading}
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: '6px 14px',
              border: '1px solid #ef444444',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.06)',
              color: '#ef4444',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={loading}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 16px',
              border: `1px solid ${config.color}66`,
              borderRadius: 8,
              background: `${config.color}14`,
              color: config.color,
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
          >
            Connect →
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main settings page ───────────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accounts, loading: accountsLoading, error: accountsError, connect, disconnect, refetch } =
    useConnectedAccounts();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('profile');

  const displayName =
    (user?.user_metadata?.name as string | undefined) ?? user?.email ?? 'User';
  const initials = displayName.charAt(0).toUpperCase();

  // Handle OAuth callback redirects
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      setSuccessMessage(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully!`);
      refetch();
      // Clear query param without re-render loop
      window.history.replaceState({}, '', '/settings');
    }
    if (error) {
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams, refetch]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const sections = [
    { id: 'profile', label: 'Profile' },
    { id: 'connections', label: 'Connected Accounts' },
    { id: 'session', label: 'Session' },
  ];

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 6 }}>Account</div>
        <h1>Settings</h1>
      </div>

      {/* Success toast */}
      {successMessage && (
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 13,
            color: '#10b981',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✓ {successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Nav tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--border)',
          marginBottom: 28,
        }}
      >
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              padding: '8px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: activeSection === s.id ? 600 : 400,
              color: activeSection === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${activeSection === s.id ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1,
              transition: 'all 0.15s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Profile section ── */}
      {activeSection === 'profile' && (
        <div className="card" style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: 'linear-gradient(135deg, var(--accent-dim), rgba(234,255,0,0.08))',
                border: '1.5px solid var(--accent-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--accent)',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{displayName}</div>
              {user?.email && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {user.email}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Member since{' '}
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Connected Accounts section ── */}
      {activeSection === 'connections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Connected Accounts</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Connect your social platforms to publish directly from BrandMeld.
            </div>
          </div>

          {accountsError && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8,
                fontSize: 12,
                color: '#ef4444',
              }}
            >
              {accountsError}
            </div>
          )}

          {PLATFORMS.map(platform => (
            <PlatformCard
              key={platform.id}
              config={platform}
              connected={accounts[platform.id]?.connected ?? false}
              handle={accounts[platform.id]?.handle}
              note={accounts[platform.id]?.note}
              loading={accountsLoading}
              onConnect={() => connect(platform.id)}
              onDisconnect={() => disconnect(platform.id)}
            />
          ))}

          <div
            style={{
              marginTop: 8,
              padding: '12px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}
          >
            🔐 OAuth tokens are encrypted with AES-256 before storage. BrandMeld never stores your social media password.
          </div>
        </div>
      )}

      {/* ── Session section ── */}
      {activeSection === 'session' && (
        <div className="card" style={{ padding: '24px 28px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sign Out</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Sign out of your current session on this device.
          </div>
          <button
            onClick={handleSignOut}
            style={{
              padding: '9px 22px',
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10,
              color: '#ef4444',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
