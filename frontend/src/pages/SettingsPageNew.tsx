/**
 * SettingsPageNew — Tabbed settings hub.
 *
 * Tabs:
 *   Brand        — URL scanner + voice override (was DashboardPage sidebar)
 *   Connections  — LinkedIn OAuth, X status (promotes orphaned AuthSettings.tsx)
 *   Marketplace  — Fork a founder's voice (promotes orphaned VoiceMarketplace.tsx)
 *   Account      — Profile, sign out (from old SettingsPage.tsx)
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthSettings from './settings/AuthSettings';
import VoiceMarketplace from './marketplace/VoiceMarketplace';

type Tab = 'brand' | 'connections' | 'marketplace' | 'account';

// ── Helpers ──────────────────────────────────────────────────────────────────
const useTabFromUrl = (): Tab => {
  const raw = new URLSearchParams(window.location.search).get('tab');
  const valid: Tab[] = ['brand', 'connections', 'marketplace', 'account'];
  return (valid.includes(raw as Tab) ? raw : 'brand') as Tab;
};

// ── Brand tab ─────────────────────────────────────────────────────────────────
const BrandTab: React.FC = () => {
  const { session, user } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const tok = session?.access_token || '';
  const [url, setUrl]   = useState('');
  const [voice, setVoice] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ brand_name?: string; voice_personality?: string } | null>(null);
  const [error, setError] = useState('');

  const scan = async () => {
    if (!url.trim()) return;
    setScanning(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API_URL}/v1/campaign/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ url, user_id: user?.id }),
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

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Brand DNA Scanner</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Enter your website URL and the AI will automatically extract your brand voice, audience profile, and content pillars.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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
          <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--green-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginBottom: 4 }}>✓ Brand DNA extracted for {result.brand_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.voice_personality}</div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Voice Override</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
          Manually describe your brand voice. This overrides the scanned voice when generating content.
        </p>
        <textarea
          className="input"
          value={voice}
          onChange={e => setVoice(e.target.value)}
          rows={5}
          placeholder="Direct, specific, no corporate filler. Use data. Sound like a founder, not a marketer."
        />
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => {
          localStorage.setItem('brandVoiceOverride', voice);
          alert('Voice saved!');
        }}>
          Save Voice
        </button>
      </div>
    </div>
  );
};

// ── Account tab ───────────────────────────────────────────────────────────────
const AccountTab: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = (user?.user_metadata?.name as string | undefined) ?? user?.email ?? 'User';

  const handleSignOut = async () => { await signOut(); navigate('/'); };

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
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Plan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: 'var(--accent-dim)', color: 'var(--accent-light)', fontWeight: 600 }}>Free</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>50 AI generations / month</span>
        </div>
        <button className="btn btn-primary btn-sm">Upgrade Plan →</button>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Session</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Sign out of your current session on this device.</div>
        <button
          onClick={handleSignOut}
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: 'var(--red)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const SettingsPageNew: React.FC = () => {
  const [tab, setTab] = useState<Tab>(useTabFromUrl);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'brand',       label: 'Brand' },
    { id: 'connections', label: 'Connections' },
    { id: 'marketplace', label: 'Voice Marketplace' },
    { id: 'account',     label: 'Account' },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 6 }}>Configuration</div>
        <h1>Settings</h1>
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

      {tab === 'brand'       && <BrandTab />}
      {tab === 'connections' && <AuthSettings />}
      {tab === 'marketplace' && <VoiceMarketplace />}
      {tab === 'account'     && <AccountTab />}
    </div>
  );
};

export default SettingsPageNew;
