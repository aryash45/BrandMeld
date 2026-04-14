/**
 * CreatePage — The primary content generation workspace.
 *
 * All state is managed through useContentGenerator and useBrandKit hooks,
 * keeping this page component as a thin composition layer.
 *
 * Accepts optional react-router navigation state ({ historyItem }) so the
 * DashboardPage "recent sessions" can pre-fill the workspace by navigating here.
 */
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useContentGenerator } from '../hooks/useContentGenerator';
import { useBrandKit } from '../hooks/useBrandKit';
import type { HistoryItem } from '../hooks/useHistory';
import BrandAnalyzer from '../components/BrandAnalyzer';
import BrandKitCard from '../components/BrandKitCard';
import BatchOutputDisplay from '../components/BatchOutputDisplay';
import ContentTemplates from '../components/ContentTemplates';
import EditToolbar from '../components/EditToolbar';
import GenerateButton from '../components/GenerateButton';
import HistoryPanel from '../components/HistoryPanel';
import ImagePreview from '../components/ImagePreview';
import PlatformSelector from '../components/PlatformSelector';
import TextInput from '../components/TextInput';

// ─── Small local helper ───────────────────────────────────────────────────────

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`neon-chip rounded-full px-4 py-2 text-sm font-semibold ${isActive ? 'is-active' : ''}`}
  >
    {label}
  </button>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const CreatePage: React.FC = () => {
  const { session } = useAuth();
  const authToken = session?.access_token;
  const location = useLocation();

  const gen = useContentGenerator();
  const brandKitHook = useBrandKit();

  // If we landed here from the Dashboard with a history item, pre-fill the workspace
  useEffect(() => {
    const state = location.state as { historyItem?: HistoryItem } | null;
    if (state?.historyItem) {
      gen.loadHistoryItem(state.historyItem);
      // Clear the navigation state so a re-render doesn't reload it again
      window.history.replaceState({}, '');
    }
    // Only fire on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasBatchResults = Object.keys(gen.batchResults).length > 0;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 animate-fade-in">
        <p className="neon-kicker">Composition Deck</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-white">
          Create in your voice
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400 sm:text-base">
          Scan a brand, pick your channels, and ship multi-platform content that sounds like you.
        </p>
      </div>

      <div className="dashboard-layout animate-fade-in">
        {/* ── Left column: Brand scan + Image deck ── */}
        <section className="flex flex-col gap-4">
          {/* Brand scan */}
          <div className="neon-panel px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="neon-kicker">Signal Intake</p>
                <h2 className="mt-3 font-display text-2xl font-semibold text-white">
                  Brand scan
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  Pull voice clues from a company or site, then convert them into a reusable brand profile.
                </p>
              </div>
              <span className="status-orb mt-2 shrink-0" />
            </div>

            <div className="mt-6">
              <BrandAnalyzer
                value={brandKitHook.analyzeUrl}
                onChange={(e) => brandKitHook.setAnalyzeUrl(e.target.value)}
                onAnalyze={() => brandKitHook.handleAnalyze(authToken)}
                disabled={gen.isGenerating}
                isAnalyzing={brandKitHook.isAnalyzing}
              />
            </div>

            {brandKitHook.analyzeError && (
              <p className="mt-4 text-sm text-rose-400">{brandKitHook.analyzeError}</p>
            )}

            {brandKitHook.brandKit && (
              <div className="mt-5">
                <BrandKitCard brandKit={brandKitHook.brandKit} />
              </div>
            )}
          </div>

          {/* Image deck */}
          <div className="neon-panel px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="neon-kicker">Visual Relay</p>
                <h2 className="mt-3 font-display text-2xl font-semibold text-white">
                  Image deck
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  Generate a companion visual using the active draft and the scanned brand palette.
                </p>
              </div>
              <span className="rounded-full border border-cyan-400/10 bg-cyan-400/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {gen.canGenerateImage ? 'Ready' : 'Locked'}
              </span>
            </div>

            {brandKitHook.brandKit ? (
              <div className="mt-6">
                <GenerateButton
                  onClick={() =>
                    brandKitHook.brandKit &&
                    gen.handleGenerateImage(brandKitHook.brandKit, authToken)
                  }
                  isLoading={gen.isGeneratingImage}
                  disabled={!gen.canGenerateImage}
                >
                  Generate Image
                </GenerateButton>
              </div>
            ) : (
              <div className="mt-6 rounded-[22px] border border-white/5 bg-slate-950/30 px-4 py-4 text-sm leading-relaxed text-slate-500">
                Run a brand scan first to unlock visual generation.
              </div>
            )}

            {gen.generatedImage && (
              <div className="mt-5">
                <ImagePreview imageDataUrl={gen.generatedImage} />
              </div>
            )}

            {gen.imageError && (
              <p className="mt-4 text-sm leading-relaxed text-rose-300">{gen.imageError}</p>
            )}
          </div>
        </section>

        {/* ── Center column: Compose form ── */}
        <section>
          <div className="neon-panel px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex flex-col gap-4 border-b border-white/5 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <p className="neon-kicker">Composition Deck</p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-white">
                  Compose in your voice
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
                  Build the voice blueprint, choose your channels, and ship a prompt package that
                  feels unmistakably human.
                </p>
              </div>
              <div className="rounded-full border border-lime-300/12 bg-lime-300/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {gen.selectedPlatforms.length} live channel
                {gen.selectedPlatforms.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <TextInput
                id="brand_voice_input"
                label="Voice Blueprint"
                placeholder="e.g., Casual but authoritative. I use short sentences. I hate jargon. I sound like a smart friend giving advice."
                value={gen.brandVoice}
                onChange={(e) => gen.setBrandVoice(e.target.value)}
                rows={6}
                disabled={gen.isGenerating || brandKitHook.isAnalyzing}
              />

              <PlatformSelector
                selectedPlatforms={gen.selectedPlatforms}
                onChange={gen.setSelectedPlatforms}
                disabled={gen.isGenerating}
              />

              <ContentTemplates
                onTemplateSelect={gen.setContentRequest}
                disabled={gen.isGenerating}
              />

              <TextInput
                id="content_request_input"
                label="Campaign Brief"
                placeholder="e.g., A thread about why most startups fail..."
                value={gen.contentRequest}
                onChange={(e) => gen.setContentRequest(e.target.value)}
                rows={7}
                disabled={gen.isGenerating}
              />

              <GenerateButton
                onClick={() =>
                  gen.handleGenerate(brandKitHook.brandKit ?? null, authToken)
                }
                isLoading={gen.isGenerating}
                disabled={gen.isGenerateDisabled}
              >
                {gen.generatorActionLabel}
              </GenerateButton>
            </div>
          </div>
        </section>

        {/* ── Right column: Output ── */}
        <section className="output-stack">
          <div className="neon-panel px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="neon-kicker">Output Relay</p>
                <h2 className="mt-3 font-display text-2xl font-semibold text-white">
                  Draft monitor
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  Track live output, switch across channels, and revisit prior sessions.
                </p>
              </div>
              <div className="neon-segmented">
                <TabButton
                  label="Generated Drafts"
                  isActive={gen.activeOutputView === 'output'}
                  onClick={() => gen.setActiveOutputView('output')}
                />
                <TabButton
                  label="History"
                  isActive={gen.activeOutputView === 'history'}
                  onClick={() => gen.setActiveOutputView('history')}
                />
              </div>
            </div>
          </div>

          {gen.activeOutputView === 'output' ? (
            <>
              <BatchOutputDisplay
                isLoading={gen.isGenerating}
                error={gen.generatorError}
                results={gen.batchResults}
                selectedPlatforms={gen.selectedPlatforms}
                activeTab={gen.activeBatchTab}
                onTabChange={gen.setActiveBatchTab}
                onRetry={() => gen.handleGenerate(brandKitHook.brandKit ?? null, authToken)}
              />
              {hasBatchResults && (
                <EditToolbar
                  isEditing={gen.isEditing}
                  activeCommand={gen.activeEditCommand}
                  onEdit={(cmd) => gen.handleEdit(cmd, authToken)}
                  onUndo={gen.handleUndo}
                  canUndo={gen.canUndo}
                  disabled={gen.isGenerating}
                />
              )}
            </>
          ) : (
            <HistoryPanel
              history={gen.history}
              onLoadItem={gen.loadHistoryItem}
              onClearHistory={gen.clearHistory}
            />
          )}
        </section>
      </div>
    </div>
  );
};

export default CreatePage;
