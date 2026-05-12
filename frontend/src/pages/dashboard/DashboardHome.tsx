import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface WeeklyPrompt {
  id: string;
  prompt_text: string;
  answered: boolean;
}

interface QuickStats {
  posts_published: number;
  total_likes: number;
  total_impressions: number;
}

const DashboardHome: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState<WeeklyPrompt | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const authHeader = { Authorization: `Bearer ${session?.access_token || ''}` };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [promptRes, analyticsRes] = await Promise.allSettled([
          fetch(`${API_URL}/v1/prompts/weekly`, { headers: authHeader }),
          fetch(`${API_URL}/v1/analytics`, { headers: authHeader }),
        ]);

        if (promptRes.status === 'fulfilled' && promptRes.value.ok) {
          setPrompt(await promptRes.value.json());
        }
        if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
          const data = await analyticsRes.value.json();
          setStats(data.summary);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div style={{ padding: '40px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ color: '#EAFF00', fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 8px' }}>
          BrandMeld V2
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#fff' }}>
          Your Distribution Engine
        </h1>
      </div>

      {/* Weekly Prompt Banner */}
      {!loading && prompt && !prompt.answered && (
        <div style={{
          border: '2px solid #EAFF00',
          padding: '24px 28px',
          marginBottom: 32,
          position: 'relative',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{
                color: '#EAFF00', fontSize: 10, letterSpacing: '0.2em',
                textTransform: 'uppercase', margin: '0 0 10px',
              }}>
                ⚡ Weekly Prompt
              </p>
              <p style={{ fontSize: 17, fontWeight: 600, color: '#fff', margin: '0 0 16px', lineHeight: 1.5 }}>
                "{prompt.prompt_text}"
              </p>
              <button
                onClick={() => navigate('/dashboard/create', { state: { promptId: prompt.id, promptText: prompt.prompt_text } })}
                style={{
                  background: '#EAFF00', color: '#000', border: 'none',
                  padding: '10px 20px', fontWeight: 900, cursor: 'pointer',
                  fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
                  fontFamily: 'inherit',
                }}
              >
                Answer &amp; Generate →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
        {[
          { label: 'New Campaign', sub: 'Plan & generate content', href: '/dashboard/create', accent: '#EAFF00' },
          { label: 'Published Posts', sub: 'View engagement data', href: '/dashboard/published', accent: '#00F0FF' },
          { label: 'Voice Marketplace', sub: 'Fork a founder\'s voice', href: '/marketplace/voices', accent: '#9F7AEA' },
          { label: 'Analytics', sub: 'Track performance', href: '/dashboard/analytics', accent: '#F97316' },
        ].map((item) => (
          <Link
            key={item.href}
            to={item.href}
            style={{ textDecoration: 'none' }}
          >
            <div style={{
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '20px 22px',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = item.accent)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            >
              <p style={{ fontSize: 15, fontWeight: 700, color: item.accent, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.label}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{item.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Stats row */}
      {stats && (
        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 16px' }}>
            Last 30 Days
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Posts Published', value: stats.posts_published },
              { label: 'Total Likes', value: stats.total_likes },
              { label: 'Impressions', value: stats.total_impressions.toLocaleString() },
            ].map(s => (
              <div key={s.label} style={{ borderTop: '2px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
                <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>{s.value}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ width: 16, height: 16, border: '2px solid #EAFF00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading your data…
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
