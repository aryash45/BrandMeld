/**
 * HistoryPage — Full session archive with search.
 *
 * Reads from the same useHistory hook as CreatePage so data is always
 * in sync. All platform results per session are displayed (not just the first).
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHistory, type HistoryItem } from '../hooks/useHistory';
import { PLATFORM_META, type Platform } from '../services/apiService';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface HistoryCardProps {
  item: HistoryItem;
  onLoad: (item: HistoryItem) => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ item, onLoad }) => {
  const date = new Date(item.createdAt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="group rounded-2xl border border-white/5 bg-slate-900/50 p-5 transition-all hover:border-white/10 hover:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Brief */}
          <p className="truncate text-sm font-medium text-slate-200">{item.contentRequest}</p>

          {/* Brand voice excerpt */}
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
            Voice: {item.brandVoice}
          </p>

          {/* Platform badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {item.platforms.map((platform) => {
              const meta = PLATFORM_META[platform as Platform];
              return (
                <span
                  key={platform}
                  className={`rounded-full border border-white/5 bg-slate-800 px-2.5 py-0.5 text-xs font-medium ${meta?.color ?? 'text-slate-400'}`}
                >
                  {meta?.label ?? platform}
                </span>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-slate-600">{date}</p>
        </div>

        <button
          type="button"
          onClick={() => onLoad(item)}
          className="shrink-0 rounded-xl border border-cyan-400/10 bg-cyan-400/5 px-3 py-2 text-xs font-semibold text-cyan-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-cyan-400/10"
        >
          Load →
        </button>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const HistoryPage: React.FC = () => {
  const { history, clearHistory } = useHistory();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.toLowerCase();
    return history.filter(
      (item) =>
        item.contentRequest.toLowerCase().includes(q) ||
        item.brandVoice.toLowerCase().includes(q),
    );
  }, [history, search]);

  const loadItem = (item: HistoryItem) => {
    navigate('/create', { state: { historyItem: item } });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 animate-fade-in">
        <p className="neon-kicker">Session Archive</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-white">
          History
        </h1>
        <p className="mt-2 text-slate-400">
          {history.length} session{history.length === 1 ? '' : 's'} saved locally.
        </p>
      </div>

      {history.length > 0 ? (
        <>
          {/* Search */}
          <div className="mb-6 flex gap-3">
            <input
              type="search"
              placeholder="Search sessions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-xl border border-white/5 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/30 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            />
            <button
              type="button"
              onClick={clearHistory}
              className="rounded-xl border border-rose-400/10 bg-rose-400/5 px-4 py-2.5 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-400/10"
            >
              Clear all
            </button>
          </div>

          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((item) => (
                <HistoryCard key={item.id} item={item} onLoad={loadItem} />
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500">
              No sessions match "{search}".
            </p>
          )}
        </>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
          <svg
            className="h-10 w-10 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="mt-4 font-display text-xl font-semibold text-white">No history yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Generate content in the Create workspace to start building your archive.
          </p>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
