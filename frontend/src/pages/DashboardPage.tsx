/**
 * DashboardPage — Overview hub shown immediately after login.
 *
 * Shows:
 *  - Welcome message with user's name
 *  - Stat cards (platforms, history count, brand kit status)
 *  - Quick-action tiles (navigate to /create and /audit)
 *  - Recent history (last 3 items) with link to full /history page
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useHistory } from '../hooks/useHistory';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  accent?: 'cyan' | 'lime';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, hint, accent = 'cyan' }) => (
  <div
    className={`neon-stat-card px-5 py-5 sm:px-6 ${accent === 'lime' ? 'neon-stat-card--lime' : ''}`}
  >
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
    <p className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">{value}</p>
    <p className="mt-3 text-sm leading-relaxed text-slate-400">{hint}</p>
  </div>
);

interface QuickActionProps {
  to: string;
  title: string;
  description: string;
  badge: string;
  accent: 'cyan' | 'lime';
}

const QuickAction: React.FC<QuickActionProps> = ({ to, title, description, badge, accent }) => (
  <Link
    to={to}
    className={[
      'group block rounded-2xl border p-6 transition-all duration-200',
      'hover:-translate-y-0.5 hover:shadow-lg',
      accent === 'cyan'
        ? 'border-cyan-400/10 bg-cyan-400/5 hover:border-cyan-400/25 hover:shadow-cyan-900/20'
        : 'border-lime-300/10 bg-lime-300/5 hover:border-lime-300/25 hover:shadow-lime-900/20',
    ].join(' ')}
  >
    <span
      className={[
        'inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest',
        accent === 'cyan'
          ? 'bg-cyan-400/10 text-cyan-400'
          : 'bg-lime-300/10 text-lime-300',
      ].join(' ')}
    >
      {badge}
    </span>
    <h3 className="mt-4 font-display text-xl font-semibold text-white">{title}</h3>
    <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
    <p
      className={[
        'mt-4 text-sm font-medium transition-colors',
        accent === 'cyan' ? 'text-cyan-400 group-hover:text-cyan-300' : 'text-lime-300 group-hover:text-lime-200',
      ].join(' ')}
    >
      Get started →
    </p>
  </Link>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { history } = useHistory();
  const navigate = useNavigate();

  const displayName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'there';

  const recentHistory = history.slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome */}
      <div className="mb-8 animate-fade-in">
        <p className="neon-kicker">Command Center</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
          Welcome back, {displayName}
        </h1>
        <p className="mt-2 text-slate-400">
          Your brand studio is ready. What are we building today?
        </p>
      </div>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Usage statistics">
        <StatCard
          label="Saved Sessions"
          value={history.length.toString().padStart(2, '0')}
          hint={
            history.length > 0
              ? 'Previous generations saved and ready to reload.'
              : 'Generate content to start building your archive.'
          }
          accent="cyan"
        />
        <StatCard
          label="Last Generated"
          value={
            recentHistory[0]
              ? new Date(recentHistory[0].createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : '—'
          }
          hint={
            recentHistory[0]
              ? `For: "${recentHistory[0].contentRequest.slice(0, 40)}…"`
              : 'No sessions yet.'
          }
          accent="lime"
        />
        <StatCard
          label="Platforms"
          value="4"
          hint="X/Twitter, LinkedIn, Instagram, and Newsletter all supported."
          accent="cyan"
        />
      </section>

      {/* Quick actions */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2" aria-label="Quick actions">
        <QuickAction
          to="/create"
          badge="Content Creator"
          title="Compose in your voice"
          description="Scan a brand, pick your channels, and generate multi-platform drafts with one click."
          accent="cyan"
        />
        <QuickAction
          to="/audit"
          badge="Voice Auditor"
          title="Check brand alignment"
          description="Paste any draft and get an instant score on how well it matches your brand voice."
          accent="lime"
        />
      </section>

      {/* Recent history */}
      {recentHistory.length > 0 && (
        <section className="mt-8" aria-label="Recent sessions">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">Recent Sessions</h2>
            <Link
              to="/history"
              className="text-sm text-cyan-400 transition-colors hover:text-cyan-300"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {recentHistory.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate('/create', { state: { historyItem: item } })}
                className="w-full rounded-xl border border-white/5 bg-slate-900/50 px-5 py-4 text-left transition-all hover:border-white/10 hover:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {item.contentRequest}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {item.platforms.join(', ')} ·{' '}
                      {new Date(item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/5 px-2 py-1 text-xs text-slate-500">
                    Load →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;
