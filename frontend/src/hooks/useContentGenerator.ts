/**
 * useContentGenerator — All state and actions for the multi-platform content
 * generation workflow on CreatePage.
 *
 * Responsibilities:
 *  - Brand voice input
 *  - Content brief input
 *  - Platform selection
 *  - Batch generation (concurrent per-platform via backend)
 *  - Inline editing with undo stack (per platform)
 *  - Placeholder image state for the disabled v0 image flow
 *  - Writing history entries (via useHistory hook)
 *
 * Design notes:
 *  - All state is local to this hook — navigating away and back re-runs
 *    the component mount, which is acceptable for a hackathon; a future
 *    improvement would persist draft state to sessionStorage.
 *  - Undo is implemented as a per-platform snapshot stack (array of strings).
 *    Each edit pushes the pre-edit content; undo pops it.
 */
import { useCallback, useState } from 'react';
import type { BrandDNA } from '../services/apiService';
import {
  editCampaignDraft,
  launchCampaign,
  type EditCommand,
  type Platform,
} from '../services/apiService';
import { useHistory } from './useHistory';

// Alias so internal call-sites don't need to change
const editContent = editCampaignDraft;

interface UseContentGeneratorReturn {
  // Inputs
  brandVoice: string;
  setBrandVoice: (v: string) => void;
  contentRequest: string;
  setContentRequest: (v: string) => void;
  selectedPlatforms: Platform[];
  setSelectedPlatforms: (p: Platform[]) => void;

  // Generation
  batchResults: Partial<Record<Platform, string>>;
  isGenerating: boolean;
  generatorError: string | null;
  handleGenerate: (brandKit: BrandDNA | null, authToken?: string) => Promise<void>;

  // Active platform tab
  activeBatchTab: Platform | null;
  setActiveBatchTab: (p: Platform | null) => void;
  activePlatform: Platform | null;

  // Editing
  isEditing: boolean;
  activeEditCommand: EditCommand | null;
  handleEdit: (command: EditCommand, authToken?: string) => Promise<void>;
  handleUndo: () => void;
  canUndo: boolean;

  // Image generation
  generatedImage: string | null;
  isGeneratingImage: boolean;
  imageError: string | null;
  handleGenerateImage: (brandKit: BrandDNA, authToken?: string) => Promise<void>;
  canGenerateImage: boolean;

  // View state
  activeOutputView: 'output' | 'history';
  setActiveOutputView: (v: 'output' | 'history') => void;

  // History (forwarded from useHistory)
  history: ReturnType<typeof useHistory>['history'];
  loadHistoryItem: (item: ReturnType<typeof useHistory>['history'][number]) => void;
  clearHistory: ReturnType<typeof useHistory>['clearHistory'];

  // Derived UI helpers
  isGenerateDisabled: boolean;
  generatorActionLabel: string;
}

export function useContentGenerator(): UseContentGeneratorReturn {
  const { history, addHistoryItem, clearHistory } = useHistory();

  const [brandVoice, setBrandVoice] = useState('');
  const [contentRequest, setContentRequest] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['twitter', 'linkedin', 'instagram']);

  const [batchResults, setBatchResults] = useState<Partial<Record<Platform, string>>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorError, setGeneratorError] = useState<string | null>(null);

  const [activeBatchTab, setActiveBatchTab] = useState<Platform | null>(null);

  const [editHistory, setEditHistory] = useState<Partial<Record<Platform, string[]>>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [activeEditCommand, setActiveEditCommand] = useState<EditCommand | null>(null);

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [activeOutputView, setActiveOutputView] = useState<'output' | 'history'>('output');

  // Derived: which platform's tab is actually visible
  const availablePlatforms = selectedPlatforms.filter((p) => batchResults[p]);
  const activePlatform: Platform | null =
    availablePlatforms.length === 0
      ? null
      : activeBatchTab && availablePlatforms.includes(activeBatchTab)
        ? activeBatchTab
        : (availablePlatforms[0] ?? null);

  const canUndo = activePlatform
    ? (editHistory[activePlatform]?.length ?? 0) > 0
    : false;

  const canGenerateImage = Boolean(activePlatform && batchResults[activePlatform]);

  const handleGenerate = useCallback(
    async (brandKit: BrandDNA | null, authToken?: string) => {
      const trimmedVoice = brandVoice.trim();
      const trimmedRequest = contentRequest.trim();

      if (!trimmedVoice || !trimmedRequest) {
        setGeneratorError('Please fill in both brand voice and content request fields.');
        return;
      }

      setIsGenerating(true);
      setGeneratorError(null);
      setBatchResults({});
      setEditHistory({});
      setActiveOutputView('output');
      setActiveBatchTab(selectedPlatforms[0] ?? null);
      setGeneratedImage(null);
      setImageError(null);

      try {
        const campaign = await launchCampaign(
          trimmedRequest,
          trimmedVoice,
          brandKit,
          selectedPlatforms,
          authToken,
        );
        const results = campaign.results;
        setBatchResults(results);

        // Save ALL platform results to history (not just the first)
        if (Object.keys(results).length > 0) {
          addHistoryItem({
            brandVoice: trimmedVoice,
            contentRequest: trimmedRequest,
            results,
            platforms: selectedPlatforms,
          });
        }
      } catch (err) {
        setGeneratorError(
          err instanceof Error ? err.message : 'An unknown error occurred.',
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [brandVoice, contentRequest, selectedPlatforms, addHistoryItem],
  );

  const handleEdit = useCallback(
    async (command: EditCommand, authToken?: string) => {
      if (!activePlatform || !batchResults[activePlatform] || !brandVoice.trim()) return;

      setIsEditing(true);
      setActiveEditCommand(command);

      const original = batchResults[activePlatform]!;

      // Push current content onto undo stack before mutating
      setEditHistory((prev) => ({
        ...prev,
        [activePlatform]: [...(prev[activePlatform] ?? []), original],
      }));

      try {
        const edited = await editContent(original, brandVoice, command, authToken);
        setBatchResults((prev) => ({ ...prev, [activePlatform]: edited }));
      } catch {
        // Roll back the undo stack entry on failure
        setEditHistory((prev) => {
          const snapshots = prev[activePlatform] ?? [];
          return { ...prev, [activePlatform]: snapshots.slice(0, -1) };
        });
      } finally {
        setIsEditing(false);
        setActiveEditCommand(null);
      }
    },
    [activePlatform, batchResults, brandVoice],
  );

  const handleUndo = useCallback(() => {
    if (!activePlatform) return;
    const snapshots = editHistory[activePlatform] ?? [];
    if (snapshots.length === 0) return;

    const previous = snapshots[snapshots.length - 1];
    setBatchResults((prev) => ({ ...prev, [activePlatform]: previous }));
    setEditHistory((prev) => ({
      ...prev,
      [activePlatform]: snapshots.slice(0, -1),
    }));
  }, [activePlatform, editHistory]);

  const handleGenerateImage = useCallback(
    async (_brandKit: BrandDNA, _authToken?: string) => {
      setIsGeneratingImage(true);
      setGeneratedImage(null);
      setImageError('Image generation is not available in v0.');

      try {
        await Promise.resolve();
      } finally {
        setIsGeneratingImage(false);
      }
    },
    [],
  );

  const loadHistoryItem = useCallback(
    (item: ReturnType<typeof useHistory>['history'][number]) => {
      setBrandVoice(item.brandVoice);
      setContentRequest(item.contentRequest);

      // Restore the full platform set from the saved session
      const platforms = item.platforms?.length ? item.platforms : ['twitter' as Platform];
      setSelectedPlatforms(platforms);
      setBatchResults(item.results);
      setEditHistory({});
      setGeneratedImage(null);
      setImageError(null);
      setActiveBatchTab(platforms[0] ?? null);
      setActiveOutputView('output');
    },
    [],
  );

  return {
    brandVoice,
    setBrandVoice,
    contentRequest,
    setContentRequest,
    selectedPlatforms,
    setSelectedPlatforms,

    batchResults,
    isGenerating,
    generatorError,
    handleGenerate,

    activeBatchTab,
    setActiveBatchTab,
    activePlatform,

    isEditing,
    activeEditCommand,
    handleEdit,
    handleUndo,
    canUndo,

    generatedImage,
    isGeneratingImage,
    imageError,
    handleGenerateImage,
    canGenerateImage: false,

    activeOutputView,
    setActiveOutputView,

    history,
    loadHistoryItem,
    clearHistory,

    isGenerateDisabled: !brandVoice.trim() || !contentRequest.trim(),
    generatorActionLabel:
      selectedPlatforms.length > 1
        ? `Generate for ${selectedPlatforms.length} Platforms`
        : 'Generate Draft',
  };
}
