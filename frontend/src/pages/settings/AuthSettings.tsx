import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Accounts { linkedin?: { connected: boolean; handle?: string }; twitter?: { connected: boolean } }

const AuthSettings: React.FC = () => {
  const { session } = useAuth();
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const tok = session?.access_token || '';
  const [accounts, setAccounts] = useState<Accounts>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`${API}/v1/publish/connected`, { headers: { Authorization: `Bearer ${tok}` } }).catch(() => null);
    if (res?.ok) setAccounts(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const connectLinkedIn = async () => {
    const res = await fetch(`${API}/v1/publish/connect/linkedin`, { headers: { Authorization: `Bearer ${tok}` } });
    if (res.ok) { const d = await res.json(); if (d.auth_url) window.location.href = d.auth_url; }
  };

  const disconnect = async (p: string) => {
    await fetch(`${API}/v1/publish/disconnect/${p}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } });
    load();
  };

  const q = new URLSearchParams(window.location.search);

  return (
    <div style={{ padding: '40px 32px', maxWidth: 680, margin: '0 auto' }}>
      <p style={{ color: '#EAFF00', fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 8px' }}>Settings</p>
      <h1 style={{ fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: '0 0 36px', color: '#fff' }}>Connected Accounts</h1>

      {loading ? <p style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', badge: 'in', desc: 'Publish via API', acc: accounts.linkedin, canConnect: true },
            { id: 'twitter', label: 'X (Twitter)', color: '#1DA1F2', badge: 'X', desc: 'Opens X composer pre-filled — no API key needed', acc: accounts.twitter, canConnect: false },
          ].map(p => (
            <div key={p.id} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${p.color}22`, border: `2px solid ${p.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: p.color, flexShrink: 0 }}>{p.badge}</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {p.label} {p.acc?.connected && <span style={{ fontSize: 10, color: '#EAFF00', marginLeft: 8 }}>✓ CONNECTED{p.acc.handle ? ` · ${p.acc.handle}` : ''}</span>}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{p.desc}</p>
              </div>
              {p.acc?.connected
                ? <button onClick={() => disconnect(p.id)} style={{ background: 'transparent', border: '1px solid rgba(255,74,74,0.4)', color: '#FF4A4A', padding: '8px 16px', cursor: 'pointer', fontSize: 11, textTransform: 'uppercase', fontFamily: 'inherit' }}>Disconnect</button>
                : p.canConnect
                  ? <button onClick={connectLinkedIn} style={{ background: p.color, color: '#fff', border: 'none', padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 11, textTransform: 'uppercase', fontFamily: 'inherit' }}>Connect</button>
                  : <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Auto-enabled</span>
              }
            </div>
          ))}
        </div>
      )}

      {q.get('connected') === 'linkedin' && <div style={{ marginTop: 24, padding: '12px 16px', border: '1px solid rgba(234,255,0,0.3)', color: '#EAFF00', fontSize: 12 }}>✓ LinkedIn connected.</div>}
      {q.get('error') === 'linkedin_failed' && <div style={{ marginTop: 24, padding: '12px 16px', border: '1px solid rgba(255,74,74,0.3)', color: '#FF4A4A', fontSize: 12 }}>LinkedIn connection failed. Try again.</div>}
    </div>
  );
};

export default AuthSettings;
