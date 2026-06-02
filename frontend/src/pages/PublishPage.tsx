/**
 * PublishPage — "Send it now or schedule it."
 *
 * Tabs:
 *   Publish Now  — per-platform publish actions with clipboard fallback
 *   History      — promotes orphaned PublishedContent.tsx
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublishedContent from './dashboard/PublishedContent';

type Tab = 'now' | 'history';

const PLATFORM_ACTIONS = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    badge: 'in',
    color: '#0A66C2',
    description: 'Publish via LinkedIn API (OAuth required) or copy to clipboard.',
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    badge: '𝕏',
    color: '#1DA1F2',
    description: 'Opens X intent link pre-filled with your draft.',
  },
  {
    id: 'newsletter',
    label: 'Email / Newsletter',
    badge: '✉',
    color: 'var(--amber)',
    description: 'Copy your newsletter draft to your email tool.',
  },
];

const PublishNow: React.FC = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (platform: string) => {
    navigator.clipboard.writeText(`[Your ${platform} draft content here — go to Create first]`);
    setCopied(platform);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="card" style={{ padding: '20px 24px', marginBottom: 20, background: 'var(--accent-dim)', border: '1px solid var(--accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--accent-light)', fontWeight: 600 }}>💡 Tip</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Write your content in{' '}
            <button onClick={() => navigate('/create')} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, padding: 0 }}>
              Create →
            </button>{' '}
            first, then come back here to publish.
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PLATFORM_ACTIONS.map(p => (
          <div
            key={p.id}
            className="card"
            style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: `${p.color}22`, border: `2px solid ${p.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, color: p.color, fontSize: 16, flexShrink: 0,
            }}>
              {p.badge}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.description}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => handleCopy(p.id)}
                className="btn btn-ghost btn-sm"
              >
                {copied === p.id ? '✓ Copied' : 'Copy draft'}
              </button>
              {p.id === 'linkedin' && (
                <button
                  onClick={() => navigate('/settings?tab=connections')}
                  className="btn btn-primary btn-sm"
                >
                  Connect
                </button>
              )}
              {p.id === 'twitter' && (
                <button
                  onClick={() => window.open('https://twitter.com/intent/tweet?text=', '_blank')}
                  className="btn btn-primary btn-sm"
                >
                  Open X →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

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
              padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, transition: 'all var(--transition)',
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
