/**
 * HistoryPanel — Compact history view embedded in the CreatePage output column.
 *
 * Uses the shared HistoryItem type from useHistory (which now stores ALL
 * platform results, not just the first).
 *
 * The full history browsing experience is at /history (HistoryPage).
 * This panel shows just the recent 10 sessions inline.
 */
import React from 'react';
import { type HistoryItem } from '../hooks/useHistory';
import { PLATFORM_META, type Platform } from '../services/apiService';

interface HistoryPanelProps {
  history: HistoryItem[];
  onLoadItem: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onLoadItem,
  onClearHistory,
}) => {
  if (history.length === 0) {
    return (
      <div className="neon-panel flex min-h-[420px] flex-col items-center justify-center px-6 py-8 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mb-4 h-14 w-14 text-slate-500/70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="font-display text-2xl font-semibold text-slate-200">
          No sessions saved yet
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
          Generated drafts will collect here so you can reload a previous voice profile and prompt.
        </p>
      </div>
    );
  }

  return (
    <div className="neon-panel flex min-h-[420px] flex-col px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 border-b border-white/5 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="neon-kicker">Session Archive</p>
          <h3 className="mt-3 font-display text-2xl font-semibold text-white">
            Recent history
          </h3>
        </div>
        <button
          type="button"
          onClick={onClearHistory}
          className="neon-danger-button rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]"
        >
          Clear History
        </button>
      </div>

      <div className="neon-scroll mt-5 flex-1 space-y-4 overflow-y-auto pr-2">
        {history.map((item) => {
          // Get preview text from the first available platform result
          const firstPlatform = item.platforms?.[0] as Platform | undefined;
          const previewText = firstPlatform ? item.results[firstPlatform] : undefined;

          return (
            <div
              key={item.id}
              className="neon-panel-soft rounded-[22px] px-4 py-4 sm:px-5"
            >
              {/* Date + platform badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-400/12 bg-cyan-400/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {new Date(item.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {item.platforms.map((p) => {
                  const meta = PLATFORM_META[p as Platform];
                  return (
                    <span
                      key={p}
                      className={`text-[11px] font-semibold ${meta?.color ?? 'text-slate-400'}`}
                    >
                      {meta?.label ?? p}
                    </span>
                  );
                })}
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Voice
              </p>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-300">
                {item.brandVoice}
              </p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Request
              </p>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-300">
                {item.contentRequest}
              </p>

              {previewText && (
                <>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Preview
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">
                    {previewText.replace(/<\/?[^>]+(>|$)/g, ' ').trim()}
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={() => onLoadItem(item)}
                className="neon-ghost-button mt-5 rounded-full px-4 py-2 text-sm font-semibold"
              >
                Load session
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryPanel;
