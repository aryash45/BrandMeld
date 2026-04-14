/**
 * useHistory — Manages the content generation session history.
 *
 * Persists sessions to localStorage under 'brandmeld_history'.
 * Stores ALL platform results (not just the first platform) — fixing
 * the original bug where only the first platform was ever saved.
 *
 * Max stored items is capped at MAX_HISTORY_ITEMS to bound localStorage size.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Platform } from '../services/apiService';

const STORAGE_KEY = 'brandmeld_history';
const MAX_HISTORY_ITEMS = 20;

export interface HistoryItem {
  id: number;
  brandVoice: string;
  contentRequest: string;
  /** All generated platform results, not just the first. */
  results: Partial<Record<Platform, string>>;
  platforms: Platform[];
  createdAt: string; // ISO timestamp
}

interface UseHistoryReturn {
  history: HistoryItem[];
  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'createdAt'>) => void;
  clearHistory: () => void;
}

function loadFromStorage(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryItem[];
  } catch {
    // Corrupted data — wipe and start fresh
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function useHistory(): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryItem[]>(loadFromStorage);

  // Keep localStorage in sync whenever history state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.warn('[useHistory] Failed to persist history to localStorage:', err);
    }
  }, [history]);

  const addHistoryItem = useCallback(
    (item: Omit<HistoryItem, 'id' | 'createdAt'>) => {
      const newItem: HistoryItem = {
        ...item,
        id: Date.now(),
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS));
    },
    [],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, addHistoryItem, clearHistory };
}
