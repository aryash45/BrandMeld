import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts';

// ── Mock data ──────────────────────────────────────────────────────────────
const AREA_DATA = [
  { date: 'Apr 8',  impressions: 8400,  engagement: 3.1, seo: 2100 },
  { date: 'Apr 15', impressions: 9800,  engagement: 3.4, seo: 2300 },
  { date: 'Apr 22', impressions: 9200,  engagement: 3.2, seo: 2200 },
  { date: 'Apr 29', impressions: 12100, engagement: 3.8, seo: 2800 },
  { date: 'May 1',  impressions: 11400, engagement: 3.6, seo: 2650 },
  { date: 'May 6',  impressions: 14200, engagement: 4.1, seo: 3100 },
];

const FOLLOWERS_DATA = [
  { week: 'W1', linkedin: 1840, twitter: 3200 },
  { week: 'W2', linkedin: 1920, twitter: 3380 },
  { week: 'W3', linkedin: 2100, twitter: 3450 },
  { week: 'W4', linkedin: 2340, twitter: 3710 },
];

const CONTENT_TABLE = [
  { post: 'Why I stopped using ChatGPT for marketing', platform: 'LinkedIn', impressions: '12,400', engagement: '4.2%', ctr: '2.1%', trend: '+18%' },
  { post: '5 lessons from our first 1,000 customers',  platform: 'X',        impressions: '8,100',  engagement: '3.7%', ctr: '1.8%', trend: '+12%' },
  { post: 'How we cut CAC by 40% with SEO',           platform: 'LinkedIn', impressions: '5,900',  engagement: '2.1%', ctr: '0.9%', trend: '-5%' },
  { post: 'Competitor analysis thread: 10 finds',      platform: 'X',        impressions: '4,200',  engagement: '5.1%', ctr: '3.2%', trend: '+31%' },
];

const SEO_KEYWORDS = [
  { keyword: 'AI marketing tools',    rank: 4,  change: '+2',  volume: '12K',  trend: 'up' },
  { keyword: 'founder content strategy',rank: 7, change: '-1',  volume: '4.8K', trend: 'down' },
  { keyword: 'AI growth operating system',rank:11,change: 'new', volume: '2.1K', trend: 'up' },
  { keyword: 'startup brand voice',   rank: 3,  change: '+5',  volume: '3.4K', trend: 'up' },
];

// ── Custom tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)',
        borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ── Insight pill ───────────────────────────────────────────────────────────
const Insight: React.FC<{ text: string; color?: string }> = ({ text, color = 'var(--accent)' }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '10px 14px', background: `${color}0d`, borderRadius: 'var(--radius-sm)',
    border: `1px solid ${color}22`, marginTop: 14,
  }}>
    <span style={{ color, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✦</span>
    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
  </div>
);

// ── Analytics page ─────────────────────────────────────────────────────────
const RANGES = ['7D', '30D', '90D'];
const PLATFORMS = ['All', 'LinkedIn', 'X / Twitter', 'Instagram', 'SEO'];

const Analytics: React.FC = () => {
  const [range, setRange] = useState('30D');
  const [platform, setPlatform] = useState('All');

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 6 }}>Performance</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1>Analytics</h1>
          {/* Range selector */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', padding: 3, borderRadius: 'var(--radius-sm)' }}>
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '5px 14px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 500, transition: 'all var(--transition)',
                  background: range === r ? 'var(--accent)' : 'transparent',
                  color: range === r ? '#fff' : 'var(--text-secondary)',
                }}
              >{r}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Platform tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        {PLATFORMS.map(p => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            style={{
              padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: platform === p ? 600 : 400,
              color: platform === p ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${platform === p ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, transition: 'all var(--transition)',
            }}
          >{p}</button>
        ))}
      </div>

      {/* Primary chart — Impressions */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div className="section-header">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Impressions</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em' }}>14,200 <span style={{ fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>↑ 24%</span></div>
          </div>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={AREA_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gImpressions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="impressions" stroke="var(--accent)" strokeWidth={2} fill="url(#gImpressions)" dot={false} activeDot={{ r: 4, fill: 'var(--accent)' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <Insight text="Spike on May 1 correlates with your product launch post — LinkedIn audiences responded 3× faster than X. Consider doubling LinkedIn publishing frequency." color="var(--accent)" />
      </div>

      {/* 2×2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Engagement */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Engagement Rate</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>4.1% <span style={{ fontSize: 12, color: 'var(--green)' }}>↑ 8%</span></div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={AREA_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="engagement" name="Engagement %" stroke="var(--blue)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Insight text="Engagement peaks on Tuesdays 9–11 AM. Schedule 2 posts per week in that window." color="var(--blue)" />
        </div>

        {/* Follower growth */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Follower Growth</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>+487 <span style={{ fontSize: 12, color: 'var(--green)' }}>this month</span></div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FOLLOWERS_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="linkedin" name="LinkedIn" fill="var(--accent)" radius={[3,3,0,0]} maxBarSize={20} />
                <Bar dataKey="twitter"  name="X" fill="var(--blue)" radius={[3,3,0,0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Insight text="LinkedIn growing 2× faster than X. Repost LinkedIn threads natively to X for cross-growth." color="var(--green)" />
        </div>

        {/* SEO Traffic */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>SEO Traffic</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>3,100 <span style={{ fontSize: 12, color: 'var(--green)' }}>↑ 12%</span></div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={AREA_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gSEO" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="seo" name="SEO Visits" stroke="var(--green)" strokeWidth={2} fill="url(#gSEO)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <Insight text="3 high-intent keywords dropped rank. Publishing comparison articles could recover 800+ monthly visits." color="var(--amber)" />
        </div>

        {/* CTR */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Click-Through Rate</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>2.4% <span style={{ fontSize: 12, color: 'var(--red)' }}>↓ 3%</span></div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={AREA_DATA.map((d, i) => ({ ...d, ctr: [2.8, 2.6, 2.5, 2.7, 2.3, 2.4][i] }))} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="ctr" name="CTR %" stroke="var(--amber)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Insight text="CTR declining — your headlines may need refreshing. Use AI Studio to A/B test 3 new hook variants." color="var(--red)" />
        </div>
      </div>

      {/* Content performance table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Content Performance</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Post', 'Platform', 'Impressions', 'Engagement', 'CTR', 'vs Last'].map(h => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONTENT_TABLE.map((row, i) => (
              <tr key={i}
                style={{ borderBottom: i < CONTENT_TABLE.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background var(--transition)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.post}</td>
                <td style={{ padding: '14px 20px' }}><span className="badge badge-indigo">{row.platform}</span></td>
                <td style={{ padding: '14px 20px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>{row.impressions}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>{row.engagement}</td>
                <td style={{ padding: '14px 20px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>{row.ctr}</td>
                <td style={{ padding: '14px 20px', fontSize: 12.5, fontWeight: 600, color: row.trend.startsWith('+') ? 'var(--green)' : 'var(--red)' }}>{row.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SEO Keywords table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Keyword Rankings</span>
          <span className="badge badge-amber">3 declining</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Keyword', 'Rank', 'Change', 'Search Volume'].map(h => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEO_KEYWORDS.map((kw, i) => (
              <tr key={i}
                style={{ borderBottom: i < SEO_KEYWORDS.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background var(--transition)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '13px 20px', fontSize: 13 }}>{kw.keyword}</td>
                <td style={{ padding: '13px 20px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>#{kw.rank}</td>
                <td style={{ padding: '13px 20px', fontSize: 12.5, fontWeight: 600, color: kw.trend === 'up' ? 'var(--green)' : 'var(--red)' }}>{kw.change}</td>
                <td style={{ padding: '13px 20px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{kw.volume}/mo</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Analytics;
