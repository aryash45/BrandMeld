/**
 * SettingsPageNew — The Distribution Engine Hub.
 *
 * Tabs:
 *   Brand        — URL scanner + editable voice override → saved to Supabase
 *   Connections  — LinkedIn OAuth (live), X Web Intent, Instagram (coming soon)
 *   Marketplace  — Fork a founder's voice
 *   Account      — Profile, plan, sign out
 *
 * BUG-2 fix: removed user_id from request body (derived server-side from JWT)
 * BUG-3 fix: voice save uses API → Supabase, not localStorage
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConnectedAccounts } from '../hooks/useConnectedAccounts';
import type { SocialPlatform } from '../services/apiService';
import VoiceMarketplace from './marketplace/VoiceMarketplace';

type Tab = 'brand' | 'connections' | 'marketplace' | 'account';

const useTabFromUrl = (): Tab => {
  const raw = new URLSearchParams(window.location.search).get('tab');
  const valid: Tab[] = ['brand', 'connections', 'marketplace', 'account'];
  return (valid.includes(raw as Tab) ? raw : 'brand') as Tab;
};

// ── Platform card (Connections tab) ──────────────────────────────────────────

interface PlatformCfg {
  id: SocialPlatform;
  label: string;
  badge: string;
  color: string;
  phase: 'live' | 'intent' | 'soon';
  phaseLabel: string;
  description: string;
}

const PLATFORMS: PlatformCfg[] = [
  {
    id: 'linkedin', label: 'LinkedIn', badge: 'in', color: '#0A66C2',
    phase: 'live', phaseLabel: 'Full OAuth',
    description: 'Publish posts directly via LinkedIn API.',
  },
  {
    id: 'twitter', label: 'X / Twitter', badge: '𝕏', color: '#e2e8f0',
    phase: 'intent', phaseLabel: 'Web Intent',
    description: 'Opens X composer pre-filled with your draft.',
  },
  {
    id: 'instagram', label: 'Instagram', badge: 'IG', color: '#E1306C',
    phase: 'soon', phaseLabel: 'Coming Soon',
    description: 'Instagram API integration — coming soon.',
  },
];

const ConnectionsTab: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { accounts, loading, error, connect, disconnect, refetch } = useConnectedAccounts();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected) {
      setToast(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected!`);
      refetch();
      window.history.replaceState({}, '', '/settings?tab=connections');
    }
  }, [searchParams, refetch]);

  return (
    <div style={{ maxWidth: 560 }}>
      {toast && (
        <div style={{
          padding: '10px 16px', background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10,
          marginBottom: 16, fontSize: 12.5, color: '#10b981',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>✓ {toast}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}>×</button>
        </div>
      )}
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 12, color: '#ef4444', marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLATFORMS.map(p => {
          const acc = accounts[p.id];
          const isConnected = acc?.connected ?? false;
          const isSoon = p.phase === 'soon';
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px',
              background: isConnected ? `${p.color}08` : 'var(--bg-elevated)',
              border: `1px solid ${isConnected ? `${p.color}44` : 'var(--border)'}`,
              borderRadius: 12, opacity: isSoon ? 0.6 : 1,
              transition: 'all 0.2s',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${p.color}18`, border: `1.5px solid ${p.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, color: p.color, fontSize: 14, flexShrink: 0,
              }}>{p.badge}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                  <span style={{
                    fontSize: 9.5, fontWeight: 600, padding: '2px 6px', borderRadius: 20,
                    background: isSoon ? 'rgba(148,163,184,0.12)' : p.phase === 'live' ? 'rgba(16,185,129,0.12)' : 'rgba(251,191,36,0.12)',
                    color: isSoon ? '#94a3b8' : p.phase === 'live' ? '#10b981' : '#fbbf24',
                    border: `1px solid ${isSoon ? '#94a3b844' : p.phase === 'live' ? '#10b98144' : '#fbbf2444'}`,
                  }}>{p.phaseLabel}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {isConnected && acc?.handle
                    ? <span style={{ color: p.color, fontWeight: 500 }}>@{acc.handle}</span>
                    : p.description}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: isConnected ? '#10b981' : '#374151',
                  boxShadow: isConnected ? '0 0 5px #10b981bb' : 'none',
                }} />
                {isSoon ? (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 7 }}>Notify me</span>
                ) : isConnected ? (
                  <button
                    onClick={() => disconnect(p.id)}
                    disabled={loading}
                    style={{
                      fontSize: 12, fontWeight: 500, padding: '5px 12px',
                      border: '1px solid #ef444444', borderRadius: 7,
                      background: 'rgba(239,68,68,0.06)', color: '#ef4444',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >Disconnect</button>
                ) : (
                  <button
                    onClick={() => connect(p.id)}
                    disabled={loading}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: '5px 14px',
                      border: `1px solid ${p.color}55`, borderRadius: 7,
                      background: `${p.color}12`, color: p.color,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >Connect →</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 14, padding: '10px 14px', background: 'var(--bg-elevated)',
        border: '1px solid var(--border)', borderRadius: 8,
        fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6,
      }}>
        🔐 OAuth tokens are encrypted with AES-256 before storage. BrandMeld never stores your password.
      </div>
    </div>
  );
};

// ── Brand tab (BUG-2/3 fixed) ─────────────────────────────────────────────────

const BrandTab: React.FC = () => {
  const { session } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const tok = session?.access_token || '';
  const [url, setUrl] = useState('');
  const [voice, setVoice] = useState('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ brand_name?: string; voice_personality?: string } | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const scan = async () => {
    if (!url.trim()) return;
    setScanning(true); setError(''); setResult(null);
    try {
      // BUG-2 fix: no user_id in body — server derives from JWT
      const res = await fetch(`${API_URL}/v1/campaign/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const d = await res.json();
        setResult(d.brand_dna);
        setVoice(d.brand_dna?.voice_personality || '');
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Scan failed — check the URL and try again.');
      }
    } catch { setError('Network error — is the backend running?'); }
    finally { setScanning(false); }
  };

  const saveVoice = async () => {
    if (!voice.trim() || !tok) return;
    setSaving(true); setSaved(false);
    try {
      // BUG-3 fix: save to Supabase via API, not localStorage
      const res = await fetch(`${API_URL}/v1/campaign/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ url: url || 'manual', voice_override: voice }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
      else { setError('Failed to save voice — try again.'); }
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="card" style={{ padding: 24, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Brand DNA Scanner</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
          Enter your website URL — the AI will extract your brand voice, audience, and content pillars automatically.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="input"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && scan()}
            placeholder="https://yoursite.com"
            style={{ flex: 1 }}
          />
          <button onClick={scan} disabled={scanning || !url.trim()} className="btn btn-primary">
            {scanning ? 'Scanning…' : 'Scan →'}
          </button>
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>✗ {error}</div>}
        {result && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--green-dim)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.25)' }}>
            <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginBottom: 4 }}>✓ Brand DNA extracted for {result.brand_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.voice_personality}</div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Voice Override</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
          Manually refine your brand voice. This is what BrandMeld uses to generate content.
        </p>
        <textarea
          className="input"
          value={voice}
          onChange={e => setVoice(e.target.value)}
          rows={5}
          placeholder="Direct, specific, no corporate filler. Use data. Sound like a founder, not a marketer."
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={saveVoice}
            disabled={saving || !voice.trim()}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Voice'}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--green)' }}>Voice updated across all future generations.</span>}
        </div>
      </div>
    </div>
  );
};

// ── Account tab ───────────────────────────────────────────────────────────────

const AccountTab: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = (user?.user_metadata?.name as string | undefined) ?? user?.email ?? 'User';

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="card" style={{ padding: 24, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Profile</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{displayName}</div>
            {user?.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Distribution Plan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: 'var(--accent-dim)', color: 'var(--accent-light)', fontWeight: 600 }}>Free</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>50 AI distributions / month</span>
        </div>
        <button className="btn btn-primary btn-sm">Upgrade Plan →</button>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Session</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Sign out of your current session.</div>
        <button
          onClick={async () => { await signOut(); navigate('/'); }}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: 'var(--red)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const SettingsPageNew: React.FC = () => {
  const [tab, setTab] = useState<Tab>(useTabFromUrl);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'brand',       label: 'Brand DNA' },
    { id: 'connections', label: 'Connected Channels' },
    { id: 'marketplace', label: 'Voice Marketplace' },
    { id: 'account',     label: 'Account' },
  ];

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 6 }}>Engine Setup</div>
        <h1>Settings</h1>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer',
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

      {tab === 'brand'       && <BrandTab />}
      {tab === 'connections' && <ConnectionsTab />}
      {tab === 'marketplace' && <VoiceMarketplace />}
      {tab === 'account'     && <AccountTab />}
    </div>
  );
};

export default SettingsPageNew;
