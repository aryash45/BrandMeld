/**
 * BrandKitPage — Library of saved brand DNA profiles.
 *
 * Currently reads from localStorage history to display brand kits that were
 * analyzed in past sessions. Phase 3 will wire this to a Supabase query.
 *
 * Shows an empty state with a CTA to /create when no kits exist.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useHistory } from '../hooks/useHistory';
import BrandKitCard from '../components/BrandKitCard';
import type { BrandDNA } from '../services/apiService';

const BrandKitPage: React.FC = () => {
  const { history } = useHistory();

  // Extract unique brand kits from history (future: fetch from Supabase)
  // For now, show a placeholder — brand kits aren't yet persisted separately.
  const hasKits = false; // Phase 3: replace with Supabase data

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 animate-fade-in">
        <p className="neon-kicker">Brand Library</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
          Brand Kit
        </h1>
        <p className="mt-2 text-slate-400">
          All analyzed brand profiles, ready to reload into any workspace.
        </p>
      </div>

      {hasKits ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Phase 3: map over Supabase brand_dna rows */}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-900">
            <svg
              className="h-7 w-7 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold text-white">
            No brand kits yet
          </h2>
          <p className="mt-2 max-w-sm text-sm text-slate-400">
            Analyze a brand URL in the Create workspace to extract its DNA and start building your
            library.
          </p>
          <Link
            to="/create"
            className="mt-6 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-500"
          >
            Go to Create →
          </Link>

          <p className="mt-8 text-xs text-slate-600">
            Full brand library with Supabase persistence coming in Phase 3.
          </p>
        </div>
      )}
    </div>
  );
};

export default BrandKitPage;
