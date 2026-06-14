/**
 * PublishPage — "Send it now or schedule it."
 *
 * Tabs:
 *   Publish Now  — per-platform publish actions with live connection status
 *   History      — published post history
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../hooks/useConnectedAccounts';
import type { SocialPlatform } from '../services/apiService';
import PublishedContent from './dashboard/PublishedContent';

type Tab = 'now' | 'history';

interface PlatformAction {
  id: SocialPlatform | 'newsletter';
  label: string;
  badge: string;
  color: string;
  description: string;
  connectLabel: string;
}

const PLATFORM_ACTIONS: PlatformAction[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    badge: 'in',
    color: '#0A66C2',
    description: 'Publish directly via LinkedIn API.',
    connectLabel: 'Connect LinkedIn',
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    badge: '𝕏',
    color: '#e2e8f0',
    description: 'Opens X composer pre-filled with your draft.',
    connectLabel: 'Post via X →',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    badge: 'IG',
    color: '#E1306C',
    description: 'Instagram publishing — coming soon.',
    connectLabel: 'Coming Soon',
  },
  {
    id: 'newsletter',
    label: 'Email / Newsletter',
    badge: '✉',
    color: '#EAFF00',
    description: 'Copy your newsletter draft to your email tool.',
    connectLabel: 'Copy draft',
  },
];

// ─── PublishNow ───────────────────────────────────────────────────────────────

const PublishNow: React.FC = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);
  const { accounts, connect } = useConnectedAccounts();

  const handleCopy = (platform: string) => {
    navigator.clipboard.writeText(
      `[Your ${platform} draft — go to Create first to generate content]`,
    );
    setCopied(platform);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAction = (p: PlatformAction) => {
    if (p.id === 'newsletter') {
      handleCopy(p.id);
      return;
    }
    if (p.id === 'twitter') {
      // Web Intent — open X composer
      window.open('https://twitter.com/intent/tweet?text=', '_blank');
      return;
    }
    if (p.id === 'instagram') return; // coming soon
    connect(p.id as SocialPlatform);
  };

  const getStatusDot = (id: string) => {
    if (id === 'newsletter' || id === 'instagram') return null;
    const acc = accounts[id as SocialPlatform];
    return (
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: acc?.connected ? '#10b981' : '#475569',
          boxShadow: acc?.connected ? '0 0 5px #10b981bb' : 'none',
          flexShrink: 0,
        }}
        title={acc?.connected ? `Connected${acc.handle ? ` as @${acc.handle}` : ''}` : 'Not connected'}
      />
    );
  };

  const getActionLabel = (p: PlatformAction): string => {
    if (p.id === 'newsletter') return copied === p.id ? '✓ Copied' : 'Copy draft';
    if (p.id === 'twitter') return '→ Open X';
    if (p.id === 'instagram') return 'Coming Soon';
    const acc = accounts[p.id as SocialPlatform];
    if (acc?.connected) return 'Publish →';
    return 'Connect';
  };

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Tip banner */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          marginBottom: 20,
          background: 'var(--accent-dim)',
          border: '1px solid var(--accent)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 }}>💡 Tip</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Generate content in{' '}
          <button
            onClick={() => navigate('/create')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-light)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              padding: 0,
            }}
          >
            Create →
          </button>{' '}
          first, then publish here.
        </span>
      </div>

      {/* Platform cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLATFORM_ACTIONS.map(p => {
          const acc = p.id !== 'newsletter' ? accounts[p.id as SocialPlatform] : null;
          const isConnected = acc?.connected ?? false;
          const isSoon = p.id === 'instagram';

          return (
            <div
              key={p.id}
              className="card"
              style={{
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: isSoon ? 0.55 : 1,
                border: isConnected
                  ? `1px solid ${p.color}44`
                  : '1px solid var(--border)',
                background: isConnected ? `${p.color}08` : 'var(--surface)',
                transition: 'all 0.2s',
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: `${p.color}18`,
                  border: `1.5px solid ${p.color}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  color: p.color,
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                {p.badge}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                  {getStatusDot(p.id)}
                  {isConnected && acc?.handle && (
                    <span style={{ fontSize: 11, color: p.color, fontWeight: 500 }}>
                      @{acc.handle}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.description}</div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {p.id !== 'instagram' && (
                  <button
                    onClick={() => handleCopy(p.id)}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12 }}
                  >
                    {copied === p.id ? '✓ Copied' : 'Copy'}
                  </button>
                )}
                <button
                  onClick={() => handleAction(p)}
                  disabled={isSoon}
                  className={isConnected ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  style={{
                    fontSize: 12,
                    borderColor: isSoon ? 'transparent' : undefined,
                    opacity: isSoon ? 0.5 : 1,
                    cursor: isSoon ? 'not-allowed' : 'pointer',
                    ...(isConnected && !isSoon
                      ? {
                          background: `${p.color}18`,
                          borderColor: `${p.color}66`,
                          color: p.color,
                        }
                      : {}),
                  }}
                >
                  {getActionLabel(p)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manage connections link */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button
          onClick={() => navigate('/settings?section=connections')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Manage connected accounts →
        </button>
      </div>
    </div>
  );
};

// ─── PublishPage ──────────────────────────────────────────────────────────────

const PublishPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('now');

  const TABS: { id: Tab; label: string }[] = [
    { id: 'now',     label: 'Publish Now' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 6 }}>Distribution</div>
        <h1>Publish</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1,
              transition: 'all var(--transition)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'now'     && <PublishNow />}
      {tab === 'history' && <PublishedContent />}
    </div>
  );
};

export default PublishPage;
