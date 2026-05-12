import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Summary { posts_published: number; total_impressions: number; total_likes: number; total_retweets: number; avg_engagement_rate: number }
interface TopPost { post_id: string; platform: string; content_preview: string; likes: number; impressions: number; engagement_rate: number }
interface AnalyticsData { summary: Summary; top_posts: TopPost[]; insights: string[]; platform_breakdown: Record<string, any> }

const Analytics: React.FC = () => {
  const { session } = useAuth();
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const tok = session?.access_token || '';
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API}/v1/analytics`, { headers: { Authorization: `Bearer ${tok}` } }).catch(() => null);
      if (res?.ok) setData(await res.json());
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.3)' }}>Loading analytics…</div>;
  if (!data) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.3)' }}>No data yet. Publish your first post.</div>;

  const { summary, top_posts, insights } = data;

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <p style={{ color: '#EAFF00', fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 8px' }}>Analytics</p>
      <h1 style={{ fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: '0 0 32px', color: '#fff' }}>Performance</h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        {[
          { label: 'Posts', value: summary.posts_published },
          { label: 'Impressions', value: summary.total_impressions.toLocaleString() },
          { label: 'Likes', value: summary.total_likes },
          { label: 'Eng. Rate', value: `${summary.avg_engagement_rate}%` },
        ].map(s => (
          <div key={s.label} style={{ borderTop: '2px solid #EAFF00', paddingTop: 16 }}>
            <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>{s.value}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 12px' }}>AI Insights</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ borderLeft: '2px solid #EAFF00', paddingLeft: 14 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{ins}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top posts */}
      {top_posts.length > 0 && (
        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 12px' }}>Top Posts</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {top_posts.map(p => (
              <div key={p.post_id} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '14px 18px', display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 11, color: '#EAFF00', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0, marginTop: 1 }}>{p.platform}</span>
                <p style={{ margin: 0, flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{p.content_preview}</p>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#fff' }}>♥ {p.likes}</p>
                  <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{p.engagement_rate}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
