import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const PLATFORMS = [
  { id: 'website',   label: 'Website',    icon: '🌐' },
  { id: 'twitter',   label: 'X / Twitter',icon: '𝕏' },
  { id: 'linkedin',  label: 'LinkedIn',   icon: 'in' },
  { id: 'instagram', label: 'Instagram',  icon: '📸' },
  { id: 'youtube',   label: 'YouTube',    icon: '▶' },
  { id: 'tiktok',    label: 'TikTok',     icon: '♪' },
];

const SCAN_STEPS = [
  'Reading website copy…',
  'Detecting brand voice…',
  'Inferring content pillars…',
  'Building ICP profile…',
  'Scanning keyword opportunities…',
  'Mapping competitor landscape…',
];

interface BrandIntelligence {
  voice: string;
  icp: string;
  pillars: string[];
}

const MOCK_INTELLIGENCE: BrandIntelligence = {
  voice: 'Direct, founder-led, data-driven. Short sentences. Real examples.',
  icp: 'Early-stage B2B SaaS founders, 25–40, focused on growth & distribution',
  pillars: ['Startup growth tactics', 'AI-powered marketing', 'Founder distribution'],
};

const OnboardingWizard: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const token = session?.access_token || '';

  const [step, setStep] = useState<'connect' | 'scanning' | 'confirm'>('connect');
  const [url, setUrl] = useState('');
  const [connected, setConnected] = useState<string[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [intelligence, setIntelligence] = useState<BrandIntelligence>(MOCK_INTELLIGENCE);

  // Scan animation
  useEffect(() => {
    if (step !== 'scanning') return;
    let i = 0;
    const tick = setInterval(() => {
      i++;
      setScanProgress(i);
      if (i >= SCAN_STEPS.length) {
        clearInterval(tick);
        setTimeout(() => setStep('confirm'), 600);
      }
    }, 700);
    return () => clearInterval(tick);
  }, [step]);

  const startScan = async () => {
    if (!url.trim()) return;
    setStep('scanning');
    setScanProgress(0);
    try {
      const res = await fetch(`${API_URL}/v1/campaign/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.brand_dna) {
          setIntelligence({
            voice: data.brand_dna.voice_personality || MOCK_INTELLIGENCE.voice,
            icp: data.brand_dna.ideal_customer_profile || MOCK_INTELLIGENCE.icp,
            pillars: data.brand_dna.content_pillars || MOCK_INTELLIGENCE.pillars,
          });
        }
      }
    } catch {
      // Use mock data on error — never block the user
    }
  };

  const togglePlatform = (id: string) => {
    setConnected(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 540 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48, justifyContent: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366F1, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color: '#fff' }}>B</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>BrandMeld</span>
        </div>

        {/* ── STEP 1: Connect ──────────────────────────────── */}
        {step === 'connect' && (
          <div className="animate-fade-up">
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <h1 style={{ fontSize: 26, marginBottom: 10 }}>Set up your brand</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
                Add your website and the AI will automatically learn your brand voice, audience, and growth opportunities.
              </p>
            </div>

            {/* URL input */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Your website</label>
              <input
                className="input"
                type="url"
                placeholder="https://yoursite.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && url && startScan()}
                style={{ fontSize: 15 }}
                autoFocus
              />
            </div>

            {/* Optional platforms */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>Also connect (optional — add later)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PLATFORMS.filter(p => p.id !== 'website').map(p => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit', border: '1px solid',
                      transition: 'all var(--transition)',
                      borderColor: connected.includes(p.id) ? 'var(--accent)' : 'var(--border)',
                      background: connected.includes(p.id) ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      color: connected.includes(p.id) ? 'var(--accent-light)' : 'var(--text-secondary)',
                    }}
                  >
                    <span>{p.icon}</span> {p.label}
                    {connected.includes(p.id) && <span style={{ fontSize: 10, color: 'var(--green)' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startScan}
              disabled={!url.trim()}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Analyze My Brand →
            </button>
            <button onClick={() => navigate('/dashboard')} style={{ width: '100%', textAlign: 'center', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer', marginTop: 14, fontFamily: 'inherit' }}>
              Skip for now
            </button>
          </div>
        )}

        {/* ── STEP 2: Scanning ────────────────────────────── */}
        {step === 'scanning' && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 24 }}>∿</div>
            <h2 style={{ marginBottom: 8, fontSize: 22 }}>Analyzing your brand…</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginBottom: 40 }}>The AI is reading your website and building your brand intelligence profile.</p>

            <div style={{ textAlign: 'left', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 24, border: '1px solid var(--border)' }}>
              {SCAN_STEPS.map((step, i) => (
                <div key={i} className={i < scanProgress ? 'animate-slide-in' : ''} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', opacity: i < scanProgress ? 1 : 0.25, transition: 'opacity 0.3s', }}>
                  <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>
                    {i < scanProgress - 1 ? <span style={{ color: 'var(--green)' }}>✓</span> : i === scanProgress - 1 ? <span className="dot-live" /> : <span style={{ opacity: 0.3 }}>○</span>}
                  </span>
                  <span style={{ fontSize: 13, color: i < scanProgress ? 'var(--text-primary)' : 'var(--text-muted)' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm ─────────────────────────────── */}
        {step === 'confirm' && (
          <div className="animate-fade-up">
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>✦</div>
              <h2 style={{ fontSize: 22, marginBottom: 8 }}>Your brand intelligence is ready</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>The AI learned about your brand. Does this look accurate?</p>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
              {[
                { label: 'Brand voice', value: intelligence.voice },
                { label: 'ICP', value: intelligence.icp },
                ...intelligence.pillars.map((p, i) => ({ label: `Content pillar ${i + 1}`, value: p })),
              ].map((row, i, arr) => (
                <div key={i} style={{ display: 'flex', gap: 20, padding: '14px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', width: 110, flexShrink: 0, paddingTop: 2 }}>{row.label}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>{row.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-primary btn-lg"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Looks good, let's go →
              </button>
              <button
                onClick={() => setStep('connect')}
                className="btn btn-ghost btn-lg"
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
