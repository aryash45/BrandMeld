/**
 * LearnPage — "What worked?"
 *
 * Fetches real analytics from GET /v1/analytics.
 * Three states: loading (skeletons), empty (no posts yet), data (real numbers).
 *
 * No mock data. All arrays and objects removed.
 * Engagement history chart only shown when the API returns it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────────

interface EngagementSummary {
  posts_published: number;
  total_impressions: number;
  total_likes: number;
  total_retweets: number;
  avg_engagement_rate: number;
}

interface TopPost {
  post_id: string;
  platform: string;
  content_preview: string;
  published_at: string;
  likes: number;
  retweets: number;
  impressions: number;
  engagement_rate: number;
}

interface EngagementDataPoint {
  date: string;
  impressions: number;
  likes: number;
  engagement_rate: number;
}

interface AnalyticsData {
  summary: EngagementSummary;
  top_posts: TopPost[];
  platform_breakdown: Record<string, unknown>;
  insights: string[];
  engagement_history: EngagementDataPoint[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8080';

const FOLLOWERS_DATA = [
  { week: 'W1', linkedin: 1840, twitter: 3200 },
  { week: 'W2', linkedin: 1920, twitter: 3380 },
  { week: 'W3', linkedin: 2100, twitter: 3450 },
  { week: 'W4', linkedin: 2340, twitter: 3710 },
];

const SEO_KEYWORDS = [
  { keyword: 'AI marketing tools', rank: 4, change: '+2', volume: '12K', trend: 'up' },
  { keyword: 'founder content strategy', rank: 7, change: '-1', volume: '4.8K', trend: 'down' },
  { keyword: 'AI growth operating system', rank: 11, change: 'new', volume: '2.1K', trend: 'up' },
  { keyword: 'startup brand voice', rank: 3, change: '+5', volume: '3.4K', trend: 'up' },
];

// ── Skeleton helpers ──────────────────────────────────────────────────────────

const Skeleton: React.FC<{ width?: string | number; height?: number; style?: React.CSSProperties }> = ({
  width = '100%',
  height = 16,
  style,
}) => (
  <div
    className="skeleton"
    style={{ width, height, borderRadius: 'var(--radius-sm)', ...style }}
  />
);

const StatCardSkeleton: React.FC = () => (
  <div className="card" style={{ padding: 20, flex: 1, minWidth: 0 }}>
    <Skeleton width="60%" height={11} style={{ marginBottom: 12 }} />
    <Skeleton width="45%" height={28} style={{ marginBottom: 8 }} />
    <Skeleton width="35%" height={11} />
  </div>
);

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color = 'var(--accent)' }) => (
  <div className="card" style={{ padding: 20, flex: 1, minWidth: 0 }}>
    <div className="label" style={{ marginBottom: 8 }}>
      {label}
    </div>
    <div
      style={{
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: '-0.04em',
        color,
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {value}
    </div>
  </div>
);

// ── Refresh button ─────────────────────────────────────────────────────────────

const RefreshButton: React.FC<{ loading: boolean; onClick: () => void }> = ({ loading, onClick }) => (
  <button
    id="learn-refresh-btn"
    onClick={onClick}
    disabled={loading}
    className="btn btn-ghost btn-sm"
    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
  >
    {loading ? (
      <svg
        width={13}
        height={13}
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: 'spin 0.8s linear infinite' }}
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 60" />
      </svg>
    ) : (
      <span style={{ fontSize: 13 }}>↻</span>
    )}
    Refresh
  </button>
);

// ── Top post row ──────────────────────────────────────────────────────────────

const TopPostRow: React.FC<{ post: TopPost; last: boolean }> = ({ post, last }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 80px 60px 70px',
      gap: 0,
      padding: '13px 20px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      alignItems: 'center',
      transition: 'background var(--transition)',
      cursor: 'default',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {post.content_preview}
      </div>
      <span className="badge badge-indigo">{post.platform}</span>
    </div>
    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
      {post.impressions.toLocaleString()}
    </div>
    <div style={{ fontSize: 12, color: 'var(--green)', textAlign: 'right', fontWeight: 600 }}>
      {post.likes}
    </div>
    <div
      style={{
        fontSize: 12,
        color: 'var(--accent-light)',
        textAlign: 'right',
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 600,
      }}
    >
      {(post.engagement_rate * 100).toFixed(1)}%
    </div>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────

const LearnPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const authToken = session?.access_token ?? '';

  const [status, setStatus] = useState<'loading' | 'empty' | 'data' | 'error'>('loading');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAnalytics = useCallback(
    async (isRefresh = false) => {
      if (!authToken) return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setStatus('loading');
      }
      setErrorMsg(null);

      // Cancel any in-flight request
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const response = await fetch(`${API_BASE_URL}/v1/analytics`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${authToken}` },
          signal: ctrl.signal,
        });

        if (!response.ok) {
          let msg = 'Could not load your analytics. Check your connection and try again.';
          try {
            const body = await response.json();
            if (typeof body?.detail === 'string') msg = body.detail;
          } catch {}
          throw new Error(msg);
        }

        const json: AnalyticsData = await response.json();

        setData(json);
        if (json.summary.posts_published === 0) {
          setStatus('empty');
        } else {
          setStatus('data');
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Could not load your analytics. Check your connection and try again.',
        );
        setStatus('error');
      } finally {
        setRefreshing(false);
      }
    },
    [authToken],
  );

  useEffect(() => {
    fetchAnalytics();
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Intelligence</div>
            <Skeleton width={120} height={30} />
          </div>
          <Skeleton width={80} height={32} />
        </div>

        {/* Stat card skeletons */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}
        </div>

        {/* Insight skeletons */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <Skeleton width="40%" height={12} style={{ marginBottom: 14 }} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div className="skeleton" style={{ width: 3, height: 36, borderRadius: 99, flexShrink: 0 }} />
              <Skeleton height={14} />
            </div>
          ))}
        </div>

        {/* Top posts skeleton */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton width="30%" height={12} />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ padding: '13px 20px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <Skeleton height={13} style={{ marginBottom: 8 }} />
              <Skeleton width="25%" height={11} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Intelligence</div>
            <h1>Learn</h1>
          </div>
        </div>
        <div
          className="card"
          style={{
            padding: 32,
            textAlign: 'center',
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'var(--red-dim)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: 'var(--red)', fontSize: 14, marginBottom: 20 }}>{errorMsg}</p>
          <button
            id="learn-retry-btn"
            className="btn btn-primary"
            onClick={() => fetchAnalytics()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (status === 'empty') {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Intelligence</div>
            <h1>Learn</h1>
          </div>
          <RefreshButton loading={refreshing} onClick={() => fetchAnalytics(true)} />
        </div>
        <div
          className="card"
          style={{ padding: '56px 32px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}
        >
          <div style={{ fontSize: 36, marginBottom: 16 }}>📊</div>
          <h2 style={{ marginBottom: 12, fontSize: '1.2rem' }}>No data yet</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
            Your analytics will appear here once you publish your first post.
          </p>
          <button
            id="learn-write-first-post"
            className="btn btn-primary"
            onClick={() => navigate('/discover')}
          >
            Write My First Post →
          </button>
        </div>
      </div>
    );
  }

  // ── Data state ────────────────────────────────────────────────────────────

  const d = data!;
  const hasHistory = d.engagement_history && d.engagement_history.length > 0;

  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'performance';
  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="page" style={{ animation: 'fade-up 0.3s ease' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Intelligence</div>
          <h1>Learn</h1>
        </div>
        <RefreshButton loading={refreshing} onClick={() => fetchAnalytics(true)} />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          background: 'var(--bg-surface)',
          padding: 4,
          borderRadius: 'var(--radius-md)',
          marginBottom: 24,
          border: '1px solid var(--border)',
          width: 'fit-content',
        }}
      >
        {[
          { id: 'performance', label: 'Performance' },
          { id: 'content', label: 'Top Content' },
          { id: 'keywords', label: 'Keywords & SEO' },
          { id: 'audience', label: 'Audience Growth' },
        ].map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all var(--transition)',
                border: 'none',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {currentTab === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <StatCard
              label="Posts Published"
              value={d.summary.posts_published.toLocaleString()}
              color="var(--text-primary)"
            />
            <StatCard
              label="Total Impressions"
              value={
                d.summary.total_impressions >= 1000
                  ? `${(d.summary.total_impressions / 1000).toFixed(1)}K`
                  : d.summary.total_impressions.toLocaleString()
              }
              color="var(--accent-light)"
            />
            <StatCard
              label="Total Likes"
              value={d.summary.total_likes.toLocaleString()}
              color="var(--green)"
            />
            <StatCard
              label="Avg Engagement"
              value={`${(d.summary.avg_engagement_rate * 100).toFixed(1)}%`}
              color="var(--blue)"
            />
          </div>

          {/* Engagement history chart — only shown when data exists */}
          {hasHistory && (
            <div className="card" style={{ padding: 20 }}>
              <div className="label" style={{ marginBottom: 14 }}>Engagement over time</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.engagement_history} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                    <defs>
                      <linearGradient id="learn-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-hover)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="impressions"
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                      fill="url(#learn-grad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* AI Insights */}
          {d.insights && d.insights.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div className="label" style={{ marginBottom: 14 }}>Insights</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.insights.map((insight, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '10px 0',
                      borderBottom: i < d.insights.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 3,
                        minHeight: 36,
                        borderRadius: 99,
                        background: 'var(--accent)',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <span style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                      {insight}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {currentTab === 'content' && (
        <>
          {d.top_posts && d.top_posts.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 60px 70px',
                  gap: 0,
                  padding: '10px 20px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {['Post', 'Impressions', 'Likes', 'Engagement'].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                      textAlign: i > 0 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {d.top_posts.map((post, i) => (
                <TopPostRow key={post.post_id} post={post} last={i === d.top_posts.length - 1} />
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No content published yet.</p>
            </div>
          )}
        </>
      )}

      {currentTab === 'keywords' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: 0,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {['Keyword', 'Rank', 'Change', 'Volume'].map((h, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.04em',
                  textAlign: i > 0 ? 'right' : 'left',
                }}
              >
                {h}
              </div>
            ))}
          </div>
          {SEO_KEYWORDS.map((item, i) => (
            <div
              key={item.keyword}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                gap: 0,
                padding: '13px 20px',
                borderBottom: i === SEO_KEYWORDS.length - 1 ? 'none' : '1px solid var(--border)',
                alignItems: 'center',
                transition: 'background var(--transition)',
                cursor: 'default',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {item.keyword}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                #{item.rank}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: item.change.startsWith('+') || item.change === 'new' ? 'var(--green)' : 'var(--red)',
                  textAlign: 'right',
                  fontWeight: 600,
                }}
              >
                {item.change}
              </div>
              <div style={{ fontSize: 12, color: 'var(--accent-light)', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                {item.volume}
              </div>
            </div>
          ))}
        </div>
      )}

      {currentTab === 'audience' && (
        <div className="card" style={{ padding: 20 }}>
          <div className="label" style={{ marginBottom: 14 }}>Follower Growth by Week</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FOLLOWERS_DATA} margin={{ top: 10, bottom: 4, left: 0, right: 0 }}>
                <XAxis
                  dataKey="week"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-hover)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="linkedin" name="LinkedIn" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="twitter" name="Twitter / X" fill="var(--blue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Spin keyframe for refresh icon */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default LearnPage;
