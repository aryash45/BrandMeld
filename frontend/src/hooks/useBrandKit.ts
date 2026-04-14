/**
 * useBrandKit — Brand DNA state for the active workspace session.
 *
 * Encapsulates:
 *  - The currently active brand kit (analyzedURL → BrandDNA)
 *  - isAnalyzing / error states
 *  - The analyze action (calls backend discovery endpoint)
 *
 * Kept separate from useContentGenerator so the brand kit can be
 * shared between CreatePage panels without prop-drilling.
 */
import { useCallback, useState } from 'react';
import { fetchBrandDNA, type BrandDNA } from '../services/apiService';

interface UseBrandKitReturn {
  analyzeUrl: string;
  setAnalyzeUrl: (url: string) => void;
  brandKit: BrandDNA | null;
  isAnalyzing: boolean;
  analyzeError: string | null;
  handleAnalyze: (authToken?: string) => Promise<void>;
  clearBrandKit: () => void;
}

export function useBrandKit(): UseBrandKitReturn {
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [brandKit, setBrandKit] = useState<BrandDNA | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const handleAnalyze = useCallback(
    async (authToken?: string) => {
      const trimmed = analyzeUrl.trim();
      if (!trimmed) return;

      setIsAnalyzing(true);
      setAnalyzeError(null);
      setBrandKit(null);

      try {
        const dna = await fetchBrandDNA(trimmed, authToken);
        setBrandKit(dna);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
        setAnalyzeError(msg);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [analyzeUrl],
  );

  const clearBrandKit = useCallback(() => {
    setBrandKit(null);
    setAnalyzeError(null);
  }, []);

  return {
    analyzeUrl,
    setAnalyzeUrl,
    brandKit,
    isAnalyzing,
    analyzeError,
    handleAnalyze,
    clearBrandKit,
  };
}
