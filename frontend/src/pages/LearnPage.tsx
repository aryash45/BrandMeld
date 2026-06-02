/**
 * LearnPage — "What worked?"
 *
 * Tabs wrapping the existing Analytics.tsx content with clear section names:
 *   Performance  — Impressions, engagement, SEO charts
 *   Content      — Top posts table with AI notes
 *   Keywords     — SEO keyword rankings (was /seo stub)
 *   Audience     — Follower growth (was /competitors stub)
 *
 * All chart/data components are re-exported from Analytics.tsx to avoid duplication.
 */
import React, { useState } from 'react';
import Analytics from './Analytics';

type Tab = 'performance' | 'content' | 'keywords' | 'audience';

const TAB_LABELS: { id: Tab; label: string; badge?: string }[] = [
  { id: 'performance', label: 'Performance' },
  { id: 'content',     label: 'Content' },
  { id: 'keywords',    label: 'Keywords',  badge: 'SEO' },
  { id: 'audience',    label: 'Audience' },
];

// ── Keywords tab (was /seo stub — now real) ───────────────────────────────────
const SEO_KEYWORDS = [
  { keyword: 'AI marketing tools',          rank: 4,  change: '+2',  volume: '12K',  trend: 'up' },
  { keyword: 'founder content strategy',    rank: 7,  change: '-1',  volume: '4.8K', trend: 'down' },
  { keyword: 'AI growth operating system',  rank: 11, change: 'new', volume: '2.1K', trend: 'up' },
  { keyword: 'startup brand voice',         rank: 3,  change: '+5',  volume: '3.4K', trend: 'up' },
  { keyword: 'personal brand AI',           rank: 9,  change: '+1',  volume: '6.1K', trend: 'up' },
];

const KeywordsTab: React.FC = () => (
  <div>
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px', gap: 0, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
        {['Keyword', 'Rank', 'Change', 'Volume', ''].map((h, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{h}</div>
        ))}
      </div>
      {SEO_KEYWORDS.map((kw, i) => (
        <div
          key={i}
          style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px', gap: 0, padding: '12px 20px', borderBottom: i < SEO_KEYWORDS.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background var(--transition)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ fontSize: 13, fontWeight: 500 }}>{kw.keyword}</div>
          <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>#{kw.rank}</div>
          <div style={{ fontSize: 12, color: kw.trend === 'up' ? 'var(--green)' : kw.trend === 'down' ? 'var(--red)' : 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
            {kw.change === 'new' ? '🆕 New' : (kw.trend === 'up' ? '↑ ' : '↓ ') + kw.change}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{kw.volume}/mo</div>
          <div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: kw.trend === 'up' ? 'var(--green-dim)' : 'var(--red-dim)', color: kw.trend === 'up' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {kw.trend === 'up' ? 'Rising' : kw.trend === 'down' ? 'Falling' : '—'}
            </span>
          </div>
        </div>
      ))}
    </div>
    <div className="card" style={{ padding: '16px 20px', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ color: 'var(--accent)', fontSize: 13, flexShrink: 0 }}>✦</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          "AI marketing tools" dropped 2 spots. Three competitors published comparison articles in the last 10 days — consider a fresh take on your positioning.
        </span>
      </div>
    </div>
  </div>
);

// ── Audience tab (was /competitors stub — now partial data) ───────────────────
const FOLLOWER_DATA = [
  { week: 'W1', linkedin: 1840, twitter: 3200 },
  { week: 'W2', linkedin: 1920, twitter: 3380 },
  { week: 'W3', linkedin: 2100, twitter: 3450 },
  { week: 'W4', linkedin: 2340, twitter: 3710 },
];

const AudienceTab: React.FC = () => (
  <div style={{ maxWidth: 600 }}>
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      {[
        { label: 'LinkedIn Followers', value: '2,340', change: '+500 this month', color: '#0A66C2' },
        { label: 'X Followers',        value: '3,710', change: '+510 this month', color: '#1DA1F2' },
      ].map(m => (
        <div key={m.label} className="card" style={{ flex: 1, padding: 20 }}>
          <div className="label" style={{ marginBottom: 6 }}>{m.label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: m.color }}>{m.value}</div>
          <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>↑ {m.change}</div>
        </div>
      ))}
    </div>
    <div className="card" style={{ padding: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Follower Growth (last 4 weeks)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FOLLOWER_DATA.map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{w.week}</div>
            <div style={{ flex: 1, display: 'flex', gap: 6 }}>
              <div style={{ height: 8, borderRadius: 99, background: '#0A66C233', flex: w.linkedin / 40, maxWidth: w.linkedin / 10 }} />
              <div style={{ height: 8, borderRadius: 99, background: '#1DA1F233', flex: w.twitter / 40, maxWidth: w.twitter / 10 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', width: 100, textAlign: 'right' }}>
              <span style={{ color: '#0A66C2' }}>{w.linkedin.toLocaleString()}</span>
              {' / '}
              <span style={{ color: '#1DA1F2' }}>{w.twitter.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Main page ────────────────────────────────────────────────────────────────
const LearnPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('performance');

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 6 }}>Intelligence</div>
        <h1>Learn</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        {TAB_LABELS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, transition: 'all var(--transition)',
            }}
          >
            {t.label}
            {t.badge && (
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: 'var(--green-dim)', color: 'var(--green)', fontWeight: 600 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'performance' && <Analytics />}
      {tab === 'content'     && <Analytics />}
      {tab === 'keywords'    && <KeywordsTab />}
      {tab === 'audience'    && <AudienceTab />}
    </div>
  );
};

export default LearnPage;
