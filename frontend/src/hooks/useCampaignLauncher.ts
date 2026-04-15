/**
 * useCampaignLauncher — Powers the Magic Box Dashboard.
 *
 * Uses the new /v1/campaign/launch endpoint which:
 *  - Hits X, LinkedIn, and Instagram in parallel by default
 *  - Runs internal brand-voice self-correction on every draft
 *  - Returns a companion lifestyle image automatically
 */
import { useCallback, useState } from 'react';
import { launchCampaign, type BrandDNA, type CampaignLaunchResult, type Platform } from '../services/apiService';
import { useHistory } from './useHistory';

const DEFAULT_PLATFORMS: Platform[] = ['twitter', 'linkedin', 'instagram'];

export interface UseCampaignLauncherReturn {
  // Input
  contentRequest: string;
  setContentRequest: (v: string) => void;
  brandVoice: string;
  setBrandVoice: (v: string) => void;

  // State
  isLaunching: boolean;
  error: string | null;
  result: CampaignLaunchResult | null;

  // Active tab in output
  activeTab: Platform | null;
  setActiveTab: (p: Platform) => void;

  // Actions
  launch: (brandDna?: BrandDNA | null, authToken?: string) => Promise<void>;
  reset: () => void;

  // History
  history: ReturnType<typeof useHistory>['history'];
  loadHistoryItem: (item: ReturnType<typeof useHistory>['history'][number]) => void;
  clearHistory: ReturnType<typeof useHistory>['clearHistory'];

  // Derived
  canLaunch: boolean;
}

export function useCampaignLauncher(): UseCampaignLauncherReturn {
  const { history, addHistoryItem, clearHistory } = useHistory();

  const [contentRequest, setContentRequest] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CampaignLaunchResult | null>(null);
  const [activeTab, setActiveTab] = useState<Platform | null>(null);

  const launch = useCallback(
    async (brandDna?: BrandDNA | null, authToken?: string) => {
      const trimmedRequest = contentRequest.trim();
      const trimmedVoice = brandVoice.trim();

      if (!trimmedRequest) {
        setError('Tell me what you\'re promoting first.');
        return;
      }

      setIsLaunching(true);
      setError(null);
      setResult(null);
      setActiveTab(DEFAULT_PLATFORMS[0]);

      try {
        const campaignResult = await launchCampaign(
          trimmedRequest,
          trimmedVoice || (brandDna?.voice_personality ?? 'Confident, direct, and human. I share ideas plainly without corporate jargon.'),
          brandDna ?? null,
          DEFAULT_PLATFORMS,
          true, // always generate image
          authToken,
        );

        setResult(campaignResult);

        // Persist to history
        const platforms = Object.keys(campaignResult.results) as Platform[];
        if (platforms.length > 0) {
          addHistoryItem({
            brandVoice: trimmedVoice || (brandDna?.voice_personality ?? ''),
            contentRequest: trimmedRequest,
            results: campaignResult.results,
            platforms,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLaunching(false);
      }
    },
    [contentRequest, brandVoice, addHistoryItem],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setActiveTab(null);
    setContentRequest('');
  }, []);

  const loadHistoryItem = useCallback(
    (item: ReturnType<typeof useHistory>['history'][number]) => {
      setBrandVoice(item.brandVoice);
      setContentRequest(item.contentRequest);
      const platforms = (item.platforms?.length ? item.platforms : DEFAULT_PLATFORMS) as Platform[];
      setResult({
        results: item.results,
        image_base64: null,
        image_platform: null,
        success: true,
        message: 'Loaded from history',
      });
      setActiveTab(platforms[0] ?? null);
      setError(null);
    },
    [],
  );

  return {
    contentRequest,
    setContentRequest,
    brandVoice,
    setBrandVoice,
    isLaunching,
    error,
    result,
    activeTab,
    setActiveTab,
    launch,
    reset,
    history,
    loadHistoryItem,
    clearHistory,
    canLaunch: contentRequest.trim().length > 0,
  };
}
