/**
 * useConnectedAccounts — fetches connected social platforms for the current user.
 * Provides connect / disconnect actions with optimistic UI updates.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getConnectedAccounts,
  getConnectUrl,
  disconnectAccount,
  ConnectedAccountsResponse,
  ConnectedAccountStatus,
  SocialPlatform,
} from '../services/apiService';

export interface UseConnectedAccountsResult {
  accounts: ConnectedAccountsResponse;
  loading: boolean;
  error: string | null;
  connect: (platform: SocialPlatform) => Promise<void>;
  disconnect: (platform: SocialPlatform) => Promise<void>;
  refetch: () => void;
}

const DEFAULT_ACCOUNTS: ConnectedAccountsResponse = {
  linkedin:  { connected: false },
  twitter:   { connected: false, note: 'Opens X composer (Web Intent)' },
  instagram: { connected: false, note: 'Coming soon' },
};

export function useConnectedAccounts(): UseConnectedAccountsResult {
  const { session } = useAuth() as any;
  const token: string | undefined = session?.access_token;

  const [accounts, setAccounts] = useState<ConnectedAccountsResponse>(DEFAULT_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await getConnectedAccounts(token);
      // Merge with defaults so instagram always exists even if backend omits it
      setAccounts({
        linkedin:  data.linkedin  ?? DEFAULT_ACCOUNTS.linkedin,
        twitter:   data.twitter   ?? DEFAULT_ACCOUNTS.twitter,
        instagram: data.instagram ?? DEFAULT_ACCOUNTS.instagram,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetch(); }, [fetch]);

  // Re-fetch on window focus (catches OAuth callback redirect)
  useEffect(() => {
    const onFocus = () => fetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetch]);

  const connect = useCallback(async (platform: SocialPlatform) => {
    if (!token) return;
    if (platform === 'instagram') {
      window.open('https://help.instagram.com/contact/185819881608116', '_blank');
      return;
    }
    if (platform === 'twitter') {
      // Twitter uses Web Intent — open X directly
      window.open('https://twitter.com', '_blank');
      return;
    }
    try {
      const authUrl = await getConnectUrl(platform, token);
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to connect ${platform}`);
    }
  }, [token]);

  const disconnect = useCallback(async (platform: SocialPlatform) => {
    if (!token) return;
    try {
      // Optimistic update
      setAccounts(prev => ({
        ...prev,
        [platform]: { connected: false },
      }));
      await disconnectAccount(platform, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to disconnect ${platform}`);
      fetch(); // Revert on error
    }
  }, [token, fetch]);

  return { accounts, loading, error, connect, disconnect, refetch: fetch };
}
