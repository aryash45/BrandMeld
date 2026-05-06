import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface Draft { platform: string; content: string; }

const PLATFORMS = [
  { id: 'twitter',    label: 'X / Twitter', icon: '𝕏', limit: 280 },
  { id: 'linkedin',   label: 'LinkedIn',     icon: 'in', limit: 3000 },
  { id: 'newsletter', label: 'Email',        icon: '✉',  limit: 10000 },
];

const TONES = ['Original', 'More casual', 'More bold', 'Shorter', 'Add hook'];

interface LocationState { promptText?: string; }

const Content: React.FC = () => {
  const { session } = useAuth();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const token = session?.access_token || '';

  const [brief, setBrief] = useState(state.promptText || '');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter', 'linkedin']);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState<string | null>(null);
  const [published, setPublished] = useState<string[]>([]);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const generate = async () => {
    if (!brief.trim() || selectedPlatforms.length === 0) return;
    setLoading(true);
    setError('');
    setDrafts([]);
    try {
      const res = await fetch(`${API_URL}/v1/campaign/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content_request: brief, platforms: selectedPlatforms }),
      });
      if (res.ok) {
        const data = await res.json();
        const results: Record<string, string> = data.results || {};
        setDrafts(Object.entries(results).map(([platform, content]) => ({
          platform,
          content: typeof content === 'string' ? content : (content as any)?.content || '',
        })));
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Generation failed — try rephrasing your brief.');
      }
    } catch {
      setError('Network error — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (i: number, content: string) => {
    setDrafts(d => d.map((item, idx) => idx === i ? { ...item, content } : item));
  };

  const publish = async (draft: Draft) => {
    setPublishing(draft.platform);
    await new Promise(r => setTimeout(r, 1200)); // simulate
    setPublished(p => [...p, draft.platform]);
    setPublishing(null);
  };

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 6 }}>AI Content Studio</div>
        <h1>Create Content</h1>
      </div>

      {/* Context bar */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', align: 'center', gap: 8 }}>
          <span className="label">Platform</span>
          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit', border: '1px solid',
                  transition: 'all var(--transition)',
                  borderColor: selectedPlatforms.includes(p.id) ? 'var(--accent)' : 'var(--border)',
                  background: selectedPlatforms.includes(p.id) ? 'var(--accent-dim)' : 'transparent',
                  color: selectedPlatforms.includes(p.id) ? 'var(--accent-light)' : 'var(--text-secondary)',
                }}
              >{p.icon} {p.label}</button>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Brand voice active</span>
        </div>
      </div>

      {/* Brief input */}
      <div style={{ marginBottom: 16 }}>
        <textarea
          className="input"
          value={brief}
          onChange={e => setBrief(e.target.value)}
          placeholder="What do you want to share? e.g. 'We just hit 1,000 customers. Here are the 5 growth lessons I didn't expect…'"
          rows={5}
          style={{ fontSize: 15 }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(); }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>⌘ + Enter to generate</div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 16,
          background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.25)',
          color: 'var(--red)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>✗</span> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}>×</button>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={loading || !brief.trim() || selectedPlatforms.length === 0}
        className="btn btn-primary btn-lg"
        style={{ marginBottom: 32, minWidth: 180, justifyContent: 'center' }}
      >
        {loading ? (
          <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />Generating…</>
        ) : '✦ Generate with AI'}
      </button>

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="animate-fade-up">
          <div className="divider" />
          <div className="label" style={{ margin: '20px 0 16px' }}>AI Drafts — review and publish</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {drafts.map((draft, i) => {
              const meta = PLATFORMS.find(p => p.id === draft.platform);
              const isPublished = published.includes(draft.platform);
              return (
                <div key={i} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 7, background: 'var(--accent-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: 'var(--accent-light)', fontWeight: 700,
                    }}>{meta?.icon || draft.platform[0]}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{meta?.label || draft.platform}</span>
                    {meta && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: draft.content.length > (meta.limit * 0.9) ? 'var(--amber)' : 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {draft.content.length} / {meta.limit}
                      </span>
                    )}
                  </div>
                  <textarea
                    className="input"
                    value={draft.content}
                    onChange={e => updateDraft(i, e.target.value)}
                    rows={draft.platform === 'linkedin' ? 8 : 4}
                    style={{ marginBottom: 14, fontFamily: 'inherit' }}
                  />
                  {/* Tone buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {TONES.map(t => (
                      <button key={t} className="btn btn-ghost btn-sm" style={{ fontSize: 11.5 }}>{t}</button>
                    ))}
                  </div>
                  {/* Publish */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      onClick={() => publish(draft)}
                      disabled={publishing === draft.platform || isPublished}
                      className="btn btn-primary btn-sm"
                    >
                      {isPublished ? '✓ Published' : publishing === draft.platform ? 'Publishing…' : `Publish to ${meta?.label || draft.platform} →`}
                    </button>
                    <button className="btn btn-ghost btn-sm">Copy</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Content;
