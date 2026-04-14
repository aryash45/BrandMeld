/**
 * SettingsPage — Account management and preferences.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const SettingsPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const displayName =
    (user?.user_metadata?.name as string | undefined) ?? user?.email ?? 'User';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 animate-fade-in">
        <p className="neon-kicker">Account</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-white">Settings</h1>
      </div>

      {/* Profile section */}
      <section className="neon-panel px-5 py-5 sm:px-6">
        <h2 className="font-display text-lg font-semibold text-white">Profile</h2>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/30 to-teal-600/30 text-xl font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-200">{displayName}</p>
            {user?.email && (
              <p className="text-sm text-slate-500">{user.email}</p>
            )}
            <p className="mt-1 text-xs text-slate-600">
              Member since {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section className="neon-panel mt-4 px-5 py-5 sm:px-6">
        <h2 className="font-display text-lg font-semibold text-white">Session</h2>
        <p className="mt-2 text-sm text-slate-400">
          Sign out of your current session on this device.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-5 py-2.5 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-400/10"
          >
            Sign out
          </button>
        </div>
      </section>

      {/* Coming soon */}
      <section className="neon-panel mt-4 px-5 py-5 sm:px-6">
        <h2 className="font-display text-lg font-semibold text-white">API Usage</h2>
        <p className="mt-2 text-sm text-slate-500">
          Usage statistics and rate limit information — coming in Phase 3.
        </p>
      </section>
    </div>
  );
};

export default SettingsPage;
