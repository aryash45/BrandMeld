import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from 'recharts';

// ── Mock data (replace with real API later) ────────────────────────────────
const SPARKLINE_IMPRESSIONS = [
  { v: 8400 }, { v: 9200 }, { v: 8700 }, { v: 11000 }, { v: 10400 },
  { v: 12800 }, { v: 14200 },
];
const SPARKLINE_ENGAGEMENT = [
  { v: 3.1 }, { v: 3.4 }, { v: 3.2 }, { v: 3.8 }, { v: 3.6 }, { v: 3.3 }, { v: 4.1 },
];
const SPARKLINE_SEO = [
  { v: 2100 }, { v: 2300 }, { v: 2200 }, { v: 2600 }, { v: 2800 }, { v: 2700 }, { v: 3100 },
];

const RECENT_CONTENT = [
  { title: 'Why I stopped using ChatGPT for marketing', platform: 'LinkedIn', impressions: '12.4K', engagement: '4.2%', trend: 'up', aiNote: 'Top performer this week' },
  { title: '5 lessons from our first 1,000 customers',  platform: 'X',        impressions: '8.1K',  engagement: '3.7%', trend: 'up', aiNote: 'High repost velocity' },
  { title: 'How we cut CAC by 40% with SEO',           platform: 'LinkedIn', impressions: '5.9K',  engagement: '2.1%', trend: 'down', aiNote: 'Below avg — repurpose?' },
];

const PRIORITIES = [
  { label: 'Publish comparison article', tag: 'SEO',     color: 'var(--accent)', to: '/content' },
  { label: 'Fix 3 metadata titles',      tag: 'Technical', color: 'var(--red)',    to: '/seo' },
  { label: 'Repurpose viral thread',     tag: 'Content',  color: 'var(--green)',  to: '/content' },
];

// ── Typing animation ───────────────────────────────────────────────────────
const BRIEF_TEXT = `Your LinkedIn engagement is up 18% this week — your last post drove 3× normal reach. 
SEO traffic dropped on 3 high-intent keywords ("AI marketing tools", "founder content"). 
2 competitors are outranking you on AI automation searches.`;

const TypingText: React.FC<{ text: string }> = ({ text }) => {
  const [displayed, setDisplayed] = useState('');
  const i = useRef(0);

  useEffect(() => {
    const stored = sessionStorage.getItem('brief-displayed');
    if (stored === text) { setDisplayed(text); return; }
    setDisplayed('');
    i.current = 0;
    const tick = setInterval(() => {
      if (i.current < text.length) {
        setDisplayed(text.slice(0, i.current + 1));
        i.current++;
      } else {
        clearInterval(tick);
        sessionStorage.setItem('brief-displayed', text);
      }
    }, 18);
    return () => clearInterval(tick);
  }, [text]);

  return <span>{displayed}</span>;
};

// ── Metric card with sparkline ─────────────────────────────────────────────
interface MetricProps {
  label: string;
  value: string;
  change: string;
  up: boolean;
  data: { v: number }[];
  color: string;
}
const MetricCard: React.FC<MetricProps> = ({ label, value, change, up, data, color }) => (
  <div className="card" style={{ padding: 20, flex: 1, minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
      <span className="label">{label}</span>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
        background: up ? 'var(--green-dim)' : 'var(--red-dim)',
        color: up ? 'var(--green)' : 'var(--red)',
      }}>{change}</span>
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 12 }}>{value}</div>
    <div style={{ height: 44 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#grad-${label})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

// ── Dashboard ──────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = (user?.user_metadata?.name as string | undefined) ?? user?.email?.split('@')[0] ?? 'Founder';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page">
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 6 }}>{dateStr}</div>
        <h1 style={{ marginBottom: 4 }}>{greeting}, {displayName}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Here's what's happening with your brand today.</p>
      </div>

      {/* AI Daily Brief */}
      <div className="card ai-glow" style={{ padding: 24, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, var(--accent), var(--blue), var(--accent))',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600, letterSpacing: '0.05em' }}>
            ✦ AI DAILY BRIEF
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
            <span className="dot-live" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Live</span>
          </span>
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.75, color: 'var(--text-primary)', marginBottom: 20, maxWidth: 700 }}>
          <TypingText text={BRIEF_TEXT} />
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="label" style={{ marginRight: 4, paddingTop: 2 }}>Priorities today:</span>
          {PRIORITIES.map((p, i) => (
            <button
              key={i}
              onClick={() => navigate(p.to)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 99,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)',
                color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all var(--transition)',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = p.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.color }} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Snapshot */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <MetricCard label="Impressions" value="14.2K" change="↑ 24%" up={true} data={SPARKLINE_IMPRESSIONS} color="var(--accent)" />
        <MetricCard label="Engagement"  value="4.1%"  change="↑ 8%"  up={true} data={SPARKLINE_ENGAGEMENT}  color="var(--blue)" />
        <MetricCard label="SEO Traffic" value="3.1K"  change="↑ 12%" up={true} data={SPARKLINE_SEO}         color="var(--green)" />
      </div>

      {/* Content + Priorities grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Recent content */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Recent Content</span>
            <button onClick={() => navigate('/content')} className="btn btn-ghost btn-sm">New post →</button>
          </div>
          <div>
            {RECENT_CONTENT.map((post, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', padding: '14px 20px',
                borderBottom: i < RECENT_CONTENT.length - 1 ? '1px solid var(--border)' : 'none',
                gap: 16, transition: 'background var(--transition)',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="badge badge-indigo">{post.platform}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{post.aiNote}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{post.impressions}</div>
                  <div style={{ fontSize: 11, color: post.trend === 'up' ? 'var(--green)' : 'var(--red)' }}>{post.engagement} eng</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Priority actions */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>AI Priorities</span>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {PRIORITIES.map((p, i) => (
              <button
                key={i}
                onClick={() => navigate(p.to)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'left', marginBottom: 4,
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${p.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>{p.label}</div>
                  <span style={{ fontSize: 11, color: p.color, background: `${p.color}18`, padding: '1px 7px', borderRadius: 99, fontWeight: 600 }}>{p.tag}</span>
                </div>
              </button>
            ))}

            <div className="divider" />
            <button
              onClick={() => navigate('/analytics')}
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: 12.5 }}
            >
              View full analytics →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
