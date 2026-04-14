/**
 * AuthContext — Global authentication state using Supabase Auth.
 *
 * Provides:
 *  - session / user: current Supabase session and user object (null when logged out)
 *  - isLoading: true while the initial session check is in flight
 *  - signOut: clean logout function
 *
 * Design notes:
 *  - Uses Supabase's onAuthStateChange listener so the context is always
 *    in sync with the Supabase session cache (handles tab-focus refresh, etc.)
 *  - The context intentionally does NOT expose signIn / signUp directly;
 *    those are handled inside AuthModal which has the UI context to show errors.
 *  - useAuth() throws at dev-time if called outside the provider tree —
 *    this catches wiring mistakes early rather than silent null-checks everywhere.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { supabase } from '../services/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch any existing session immediately (avoids flash of unauthenticated UI)
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
      })
      .catch((err) => {
        console.error('[AuthContext] Failed to get initial session:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // 2. Subscribe to future auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AuthContext] Sign-out failed:', err);
    }
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    isLoading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error(
      '[useAuth] Must be used inside <AuthProvider>. ' +
      'Wrap your app root with <AuthProvider>.',
    );
  }
  return ctx;
};
