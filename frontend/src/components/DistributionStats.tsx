/**
 * DistributionStats — "Your engine at a glance."
 * Shows weekly distribution count, streak, and channels at the top of the Signal page.
 * Data from GET /v1/engine/analytics/summary
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Stats {
  posts_this_week: number;
  total_posts: number;
  streak_weeks: number;
  channels_used: string[];
  best_post_hook?: string;
}

const CHANNEL_ICONS: Record<string, string> = {
  linkedin: 'in',
  twitter: '𝕏',
  instagram: 'IG',
  newsletter: '✉',
};

const DistributionStats: React.FC = () => {
  const { session } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }
    const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8080';

    fetch(`${API_URL}/v1/engine/analytics/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  // Don't render until we have data (or hide if no posts at all)
  if (loading || !stats || stats.total_posts === 0) return null;

  const channelIcons = stats.channels_used
    .filter(c => CHANNEL_ICONS[c])
    .map(c => CHANNEL_ICONS[c]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      marginBottom: 28,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      animation: 'fade-in 0.4s ease',
    }}>
      {/* Stat: This week */}
      <div style={{
        flex: 1,
        padding: '14px 20px',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-light)', letterSpacing: '-0.03em', fontFamily: 'JetBrains Mono, monospace' }}>
          {stats.posts_this_week}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          This week
        </div>
      </div>

      {/* Stat: Streak */}
      <div style={{
        flex: 1,
        padding: '14px 20px',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'JetBrains Mono, monospace', color: stats.streak_weeks > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
          {stats.streak_weeks > 0 ? `${stats.streak_weeks}w 🔥` : '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Streak
        </div>
      </div>

      {/* Stat: Total */}
      <div style={{
        flex: 1,
        padding: '14px 20px',
        borderRight: channelIcons.length > 0 ? '1px solid var(--border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', fontFamily: 'JetBrains Mono, monospace' }}>
          {stats.total_posts}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Total distributed
        </div>
      </div>

      {/* Channels used */}
      {channelIcons.length > 0 && (
        <div style={{
          flex: 1,
          padding: '14px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {channelIcons.map((icon, i) => (
              <span key={i} style={{
                fontSize: 10, fontWeight: 800,
                width: 22, height: 22,
                borderRadius: 5,
                background: 'var(--accent-dim)',
                color: 'var(--accent-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--accent)',
              }}>{icon}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Channels
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributionStats;
