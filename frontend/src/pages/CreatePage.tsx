/**
 * CreatePage — Stepped wizard layout.
 *
 * Three focused steps instead of a dense 3-column grid:
 *   1. Brand Scan  — pull voice clues from a URL
 *   2. Compose     — set voice, pick channels, write brief
 *   3. Output      — view generated drafts + history
 */
import React, { useEffect, useState } from 'react';
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

// ─── Step definitions ─────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface StepMeta {
  id: Step;
  label: string;
  kicker: string;
  description: string;
}

const STEPS: StepMeta[] = [
  {
    id: 1,
    label: 'Brand Scan',
    kicker: 'Signal Intake',
    description: 'Pull voice cues from a company URL to build a reusable brand profile.',
  },
  {
    id: 2,
    label: 'Compose',
    kicker: 'Composition Deck',
    description: 'Set your voice blueprint, pick channels, and write your campaign brief.',
  },
  {
    id: 3,
    label: 'Output',
    kicker: 'Draft Monitor',
    description: 'Your generated drafts — ready to copy, edit, or revisit.',
  },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

const StepBar: React.FC<{
  current: Step;
  onChange: (s: Step) => void;
  outputUnlocked: boolean;
}> = ({ current, onChange, outputUnlocked }) => (
  <nav aria-label="Wizard steps" className="create-step-bar">
    {STEPS.map((s, i) => {
      const isActive = s.id === current;
      const isDone = s.id < current;
      const isLocked = s.id === 3 && !outputUnlocked;
      return (
        <React.Fragment key={s.id}>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => !isLocked && onChange(s.id)}
            className={[
              'create-step-btn',
              isActive ? 'is-active' : '',
              isDone ? 'is-done' : '',
              isLocked ? 'is-locked' : '',
            ].join(' ')}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="create-step-num">{isDone ? '✓' : s.id}</span>
            <span className="create-step-label">{s.label}</span>
          </button>
          {i < STEPS.length - 1 && <span className="create-step-connector" />}
        </React.Fragment>
      );
    })}
  </nav>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const CreatePage: React.FC = () => {
  const { session } = useAuth();
  const authToken = session?.access_token;
  const location = useLocation();

  const gen = useContentGenerator();
  const brandKitHook = useBrandKit();

  const [step, setStep] = useState<Step>(1);

  // Pre-fill workspace from dashboard "recent sessions" nav state
  useEffect(() => {
    const state = location.state as { historyItem?: HistoryItem } | null;
    if (state?.historyItem) {
      gen.loadHistoryItem(state.historyItem);
      setStep(3);
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasBatchResults = Object.keys(gen.batchResults).length > 0;
  const outputUnlocked = hasBatchResults || gen.history.length > 0;

  const meta = STEPS.find((s) => s.id === step)!;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8 animate-fade-in">
        <p className="neon-kicker">Composition Deck</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-white">
          Create in your voice
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400 sm:text-base">
          Three steps. One brand. Multi-platform content that sounds unmistakably like you.
        </p>
      </div>

      {/* Step bar */}
      <StepBar current={step} onChange={setStep} outputUnlocked={outputUnlocked} />

      {/* Step panel */}
      <div className="mt-6 animate-fade-in neon-panel px-6 py-7 sm:px-8">
        {/* Step header */}
        <div className="mb-6 border-b border-white/5 pb-6">
          <p className="neon-kicker">{meta.kicker}</p>
          <h2 className="mt-3 font-display text-2xl font-semibold text-white">{meta.label}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{meta.description}</p>
        </div>

        {/* ── Step 1: Brand Scan ── */}
        {step === 1 && (
          <div className="space-y-6">
            <BrandAnalyzer
              value={brandKitHook.analyzeUrl}
              onChange={(e) => brandKitHook.setAnalyzeUrl(e.target.value)}
              onAnalyze={() => brandKitHook.handleAnalyze(authToken)}
              disabled={gen.isGenerating}
              isAnalyzing={brandKitHook.isAnalyzing}
            />

            {brandKitHook.analyzeError && (
              <p className="text-sm text-rose-400">{brandKitHook.analyzeError}</p>
            )}

            {brandKitHook.brandKit && (
              <div>
                <BrandKitCard brandKit={brandKitHook.brandKit} />
              </div>
            )}

            {/* Image generation — lives inside Step 1 after scan */}
            {brandKitHook.brandKit && (
              <div className="rounded-2xl border border-white/5 bg-slate-950/30 px-5 py-5">
                <p className="neon-kicker mb-3">Visual Relay</p>
                <p className="mb-4 text-sm leading-relaxed text-slate-400">
                  Generate a companion image from the scanned brand palette.
                </p>
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
                {gen.generatedImage && (
                  <div className="mt-5">
                    <ImagePreview imageDataUrl={gen.generatedImage} />
                  </div>
                )}
                {gen.imageError && (
                  <p className="mt-3 text-sm text-rose-300">{gen.imageError}</p>
                )}
              </div>
            )}

            {/* Next CTA */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="neon-button rounded-2xl px-7 py-3 text-sm font-semibold"
              >
                Continue to Compose →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Compose ── */}
        {step === 2 && (
          <div className="space-y-6">
            <TextInput
              id="brand_voice_input"
              label="Voice Blueprint"
              placeholder="e.g., Casual but authoritative. I use short sentences. I hate jargon. I sound like a smart friend giving advice."
              value={gen.brandVoice}
              onChange={(e) => gen.setBrandVoice(e.target.value)}
              rows={5}
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
              placeholder="e.g., A thread about why most startups fail at distribution..."
              value={gen.contentRequest}
              onChange={(e) => gen.setContentRequest(e.target.value)}
              rows={6}
              disabled={gen.isGenerating}
            />

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="neon-ghost-button rounded-2xl px-6 py-3 text-sm font-semibold"
              >
                ← Back
              </button>
              <GenerateButton
                onClick={() => {
                  gen.handleGenerate(brandKitHook.brandKit ?? null, authToken);
                  setStep(3);
                }}
                isLoading={gen.isGenerating}
                disabled={gen.isGenerateDisabled}
              >
                {gen.generatorActionLabel}
              </GenerateButton>
            </div>
          </div>
        )}

        {/* ── Step 3: Output ── */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Output / History toggle */}
            <div className="neon-segmented w-fit">
              <button
                type="button"
                className={`neon-chip rounded-full px-4 py-2 text-sm font-semibold ${gen.activeOutputView === 'output' ? 'is-active' : ''}`}
                onClick={() => gen.setActiveOutputView('output')}
              >
                Generated Drafts
              </button>
              <button
                type="button"
                className={`neon-chip rounded-full px-4 py-2 text-sm font-semibold ${gen.activeOutputView === 'history' ? 'is-active' : ''}`}
                onClick={() => gen.setActiveOutputView('history')}
              >
                History
              </button>
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
                onLoadItem={(item) => {
                  gen.loadHistoryItem(item);
                  gen.setActiveOutputView('output');
                }}
                onClearHistory={gen.clearHistory}
              />
            )}

            <div className="flex justify-start pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="neon-ghost-button rounded-2xl px-6 py-3 text-sm font-semibold"
              >
                ← Edit brief
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatePage;
