
import React, { useState, useCallback, useEffect } from 'react';
import {
  generateContent,
  batchGenerateContent,
  editContent,
  analyzeBrandVoice,
  auditContent,
  fetchBrandDNA,
  generateImage,
  type Platform,
  type EditCommand,
  type BrandDNA,
} from './services/apiService';
import Header from './components/Header';
import TextInput from './components/TextInput';
import GenerateButton from './components/GenerateButton';
import OutputDisplay from './components/OutputDisplay';
import ContentTemplates from './components/ContentTemplates';
import BrandAnalyzer from './components/BrandAnalyzer';
import HistoryPanel, { HistoryItem } from './components/HistoryPanel';
import BrandKitCard from './components/BrandKitCard';
import ImagePreview from './components/ImagePreview';
import LandingPage from './components/LandingPage';
import PlatformSelector from './components/PlatformSelector';
import BatchOutputDisplay from './components/BatchOutputDisplay';
import EditToolbar from './components/EditToolbar';

type MainView = 'generator' | 'auditor';
type GeneratorOutputView = 'output' | 'history';

interface User {
  name: string;
  email: string;
}

const App: React.FC = () => {
  // Navigation & Auth State
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  // Main view state
  const [activeMainView, setActiveMainView] = useState<MainView>('generator');

  // Generator state
  const [brandVoice, setBrandVoice] = useState<string>('');
  const [contentRequest, setContentRequest] = useState<string>('');
  const [analyzeUrl, setAnalyzeUrl] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeGeneratorView, setActiveGeneratorView] = useState<GeneratorOutputView>('output');

  // ── Feature 1: Multi-Platform Batch Generation ──────────────────────────
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['twitter']);
  const [batchResults, setBatchResults] = useState<Partial<Record<Platform, string>>>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatorError, setGeneratorError] = useState<string | null>(null);

  // ── Feature 2: Inline Editing ────────────────────────────────────────────
  // Editing operates on "focused" content (the active tab's text or single output)
  const [editHistory, setEditHistory] = useState<Partial<Record<Platform, string[]>>>({});
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeEditCommand, setActiveEditCommand] = useState<EditCommand | null>(null);
  const [activeBatchTab, setActiveBatchTab] = useState<Platform | null>(null);

  // Auditor state
  const [auditBrandVoice, setAuditBrandVoice] = useState<string>('');
  const [contentToAudit, setContentToAudit] = useState<string>('');
  const [auditResult, setAuditResult] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  // Brand kit state
  const [brandKit, setBrandKit] = useState<BrandDNA | null>(null);
  // Image generation state
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Check for persisted user
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('brandmeld_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setShowLanding(false);
      }
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
    }

    try {
      const storedHistory = localStorage.getItem('brandmeld_history');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error('Failed to parse history from localStorage', e);
      localStorage.removeItem('brandmeld_history');
    }
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('brandmeld_user', JSON.stringify(userData));
    setShowAuthModal(false);
    setShowLanding(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('brandmeld_user');
    setShowLanding(true);
    setBrandVoice('');
    setBatchResults({});
    setEditHistory({});
    setHistory([]);
    localStorage.removeItem('brandmeld_history');
  };

  // ── Batch Generate ───────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!brandVoice.trim() || !contentRequest.trim()) {
      setGeneratorError('Please fill in both brand voice and content request fields.');
      return;
    }

    setIsGenerating(true);
    setGeneratorError(null);
    setBatchResults({});
    setEditHistory({});
    setActiveGeneratorView('output');

    try {
      const results = await batchGenerateContent(brandVoice, contentRequest, selectedPlatforms);
      setBatchResults(results);

      // Persist the first platform's result in history for backward compat
      const firstPlatform = selectedPlatforms[0];
      const firstContent = results[firstPlatform] ?? '';
      if (firstContent) {
        const newItem: HistoryItem = {
          brandVoice,
          contentRequest,
          generatedContent: firstContent,
          id: Date.now(),
        };
        const updatedHistory = [newItem, ...history].slice(0, 20);
        setHistory(updatedHistory);
        localStorage.setItem('brandmeld_history', JSON.stringify(updatedHistory));
      }
    } catch (err) {
      setGeneratorError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsGenerating(false);
    }
  }, [brandVoice, contentRequest, selectedPlatforms, history]);

  // ── Inline Edit ──────────────────────────────────────────────────────────
  const getActivePlatform = (): Platform | null => {
    // Determine which tab is currently being viewed in BatchOutputDisplay
    const availablePlatforms = selectedPlatforms.filter((p) => batchResults[p]);
    if (availablePlatforms.length === 0) return null;
    return activeBatchTab && availablePlatforms.includes(activeBatchTab)
      ? activeBatchTab
      : availablePlatforms[0];
  };

  const handleEdit = useCallback(async (command: EditCommand) => {
    const platform = getActivePlatform();
    if (!platform || !batchResults[platform] || !brandVoice.trim()) return;

    setIsEditing(true);
    setActiveEditCommand(command);

    const originalContent = batchResults[platform]!;

    // Save undo snapshot
    setEditHistory((prev) => ({
      ...prev,
      [platform]: [...(prev[platform] ?? []), originalContent],
    }));

    try {
      const edited = await editContent(originalContent, brandVoice, command);
      setBatchResults((prev) => ({ ...prev, [platform]: edited }));
    } catch (err) {
      // Roll back the undo snapshot on error
      setEditHistory((prev) => {
        const snapshots = prev[platform] ?? [];
        return { ...prev, [platform]: snapshots.slice(0, -1) };
      });
    } finally {
      setIsEditing(false);
      setActiveEditCommand(null);
    }
  }, [batchResults, brandVoice, activeBatchTab, selectedPlatforms]);

  const handleGenerateImage = useCallback(async () => {
    const platform = getActivePlatform();
    if (!platform || !brandKit) return;
    const content = batchResults[platform];
    if (!content) return;
    setIsGeneratingImage(true);
    setImageError(null);
    try {
      const imgUrl = await generateImage([brandKit.primary_hex], content, platform);
      setGeneratedImage(imgUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  }, [brandKit, batchResults, selectedPlatforms]);

  const handleUndo = useCallback(() => {
    const platform = getActivePlatform();
    if (!platform) return;
    const snapshots = editHistory[platform] ?? [];
    if (snapshots.length === 0) return;

    const previous = snapshots[snapshots.length - 1];
    setBatchResults((prev) => ({ ...prev, [platform]: previous }));
    setEditHistory((prev) => ({
      ...prev,
      [platform]: snapshots.slice(0, -1),
    }));
  }, [editHistory, activeBatchTab, selectedPlatforms, batchResults]);

  const canUndo = (): boolean => {
    const platform = getActivePlatform();
    return platform ? (editHistory[platform]?.length ?? 0) > 0 : false;
  };

  // ── Audit ────────────────────────────────────────────────────────────────
  const handleAudit = useCallback(async () => {
    if (!auditBrandVoice.trim() || !contentToAudit.trim()) {
      setAuditError('Please fill in both brand voice and content to audit fields.');
      return;
    }

    setIsAuditing(true);
    setAuditError(null);
    setAuditResult('');

    try {
      const result = await auditContent(auditBrandVoice, contentToAudit);
      setAuditResult(result);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsAuditing(false);
    }
  }, [auditBrandVoice, contentToAudit]);

  const handleTemplateSelect = (template: string) => {
    setContentRequest(template);
  };

  const handleAnalyze = useCallback(async () => {
    if (!analyzeUrl.trim()) return;

    setIsAnalyzing(true);
    setBrandVoice('');
    setBrandKit(null);

    try {
      const analyzedVoice = await analyzeBrandVoice(analyzeUrl);
      setBrandVoice(analyzedVoice);
      // Fetch full DNA for UI display
      const dna = await fetchBrandDNA(analyzeUrl);
      setBrandKit(dna);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during analysis.';
      setBrandVoice(`Error: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [analyzeUrl]);

  const loadHistoryItem = (item: HistoryItem) => {
    setBrandVoice(item.brandVoice);
    setContentRequest(item.contentRequest);
    setBatchResults({ twitter: item.generatedContent });
    setEditHistory({});
    setActiveGeneratorView('output');
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('brandmeld_history');
  };

  const TabButton: React.FC<{ view: MainView; label: string }> = ({ view, label }) => (
    <button
      onClick={() => setActiveMainView(view)}
      className={`px-6 py-3 text-lg font-bold rounded-t-lg transition-colors duration-200 ${activeMainView === view ? 'bg-slate-800/80 text-teal-400 border-t border-x border-slate-700/50' : 'bg-transparent text-slate-500 hover:bg-slate-800/30 hover:text-slate-200'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen text-slate-200 font-sans selection:bg-teal-500/30 bg-slate-950">
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleLogin}
      />

      {showLanding ? (
        <LandingPage onLoginClick={() => setShowAuthModal(true)} />
      ) : (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
          <Header user={user} onLogout={handleLogout} />

          <div className="mt-10 lg:mt-12 border-b border-slate-800 flex space-x-2">
            <TabButton view="generator" label="Content Creator" />
            <TabButton view="auditor" label="Voice Auditor" />
          </div>

          {activeMainView === 'generator' && (
            <main className="mt-8 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-12 gap-8">
                {/* ── Left column: inputs ── */}
                <div className="flex flex-col space-y-8">
                  <BrandAnalyzer
                    value={analyzeUrl}
                    onChange={(e) => setAnalyzeUrl(e.target.value)}
                    onAnalyze={handleAnalyze}
                    disabled={isGenerating}
                    isAnalyzing={isAnalyzing}
                  />
                  {/* Brand Kit Card */}
                  {brandKit && (
                    <BrandKitCard brandKit={brandKit} />
                  )}
                  {/* Generate Image Button */}
                  {brandKit && (
                    <div className="pt-4">
                      <GenerateButton
                        onClick={handleGenerateImage}
                        isLoading={isGeneratingImage}
                        disabled={!brandKit || !getActivePlatform()}
                      >
                        Generate Image
                      </GenerateButton>
                    </div>
                  )}
                  {/* Image Preview */}
                  {generatedImage && (
                    <ImagePreview imageDataUrl={generatedImage} />
                  )}

                  <TextInput
                    id="brand_voice_input"
                    label="1. Define Your Personal Voice"
                    placeholder="e.g., Casual but authoritative. I use short sentences. I hate jargon. I sound like a smart friend giving advice."
                    value={brandVoice}
                    onChange={(e) => setBrandVoice(e.target.value)}
                    rows={6}
                    disabled={isGenerating || isAnalyzing}
                  />

                  {/* ── Feature 1: Platform Selector ── */}
                  <PlatformSelector
                    selectedPlatforms={selectedPlatforms}
                    onChange={setSelectedPlatforms}
                    disabled={isGenerating}
                  />

                  <ContentTemplates onTemplateSelect={handleTemplateSelect} disabled={isGenerating} />

                  <TextInput
                    id="content_request_input"
                    label="3. What are we writing today?"
                    placeholder="e.g., A thread about why most startups fail..."
                    value={contentRequest}
                    onChange={(e) => setContentRequest(e.target.value)}
                    rows={6}
                    disabled={isGenerating}
                  />

                  <div className="pt-4">
                    <GenerateButton
                      onClick={handleGenerate}
                      isLoading={isGenerating}
                      disabled={!brandVoice || !contentRequest || isAnalyzing}
                    >
                      {selectedPlatforms.length > 1
                        ? `Generate for ${selectedPlatforms.length} Platforms`
                        : 'Generate Draft'}
                    </GenerateButton>
                  </div>
                </div>

                {/* ── Right column: output ── */}
                <div className="flex flex-col h-full min-h-[600px] lg:mt-0 mt-8">
                  <div className="flex border-b border-slate-700 mb-4">
                    <button
                      onClick={() => setActiveGeneratorView('output')}
                      className={`flex-1 px-4 py-3 text-lg font-semibold transition-colors duration-200 ${activeGeneratorView === 'output' ? 'text-teal-400 border-b-2 border-teal-400 bg-slate-800/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/10'}`}
                    >
                      Generated Drafts
                    </button>
                    <button
                      onClick={() => setActiveGeneratorView('history')}
                      className={`flex-1 px-4 py-3 text-lg font-semibold transition-colors duration-200 ${activeGeneratorView === 'history' ? 'text-teal-400 border-b-2 border-teal-400 bg-slate-800/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/10'}`}
                    >
                      History
                    </button>
                  </div>

                  <div className="flex-grow relative flex flex-col">
                    {activeGeneratorView === 'output' && (
                      <div className="flex flex-col h-full">
                        {/* ── Feature 1: Batch Output ── */}
                        <BatchOutputDisplay
                          isLoading={isGenerating}
                          error={generatorError}
                          results={batchResults}
                          selectedPlatforms={selectedPlatforms}
                          onRetry={handleGenerate}
                        />

                        {/* ── Feature 2: Edit Toolbar ── */}
                        {Object.keys(batchResults).length > 0 && (
                          <EditToolbar
                            isEditing={isEditing}
                            activeCommand={activeEditCommand}
                            onEdit={handleEdit}
                            onUndo={handleUndo}
                            canUndo={canUndo()}
                            disabled={isGenerating}
                          />
                        )}
                      </div>
                    )}
                    {activeGeneratorView === 'history' && (
                      <HistoryPanel
                        history={history}
                        onLoadItem={loadHistoryItem}
                        onClearHistory={clearHistory}
                      />
                    )}
                  </div>
                </div>
              </div>
            </main>
          )}

          {activeMainView === 'auditor' && (
            <main className="mt-8 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-12 gap-8">
                <div className="flex flex-col space-y-8">
                  <div className="p-6 bg-slate-800/30 border border-slate-700 rounded-lg">
                    <h3 className="text-xl font-bold text-slate-100 mb-2">Voice Auditor Mode</h3>
                    <p className="text-slate-400">Paste your draft below. We'll tell you if it sounds like you, or if it sounds like a robot.</p>
                  </div>

                  <TextInput
                    id="audit_brand_voice_input"
                    label="1. Define Your Voice"
                    placeholder="e.g., 'Direct, no fluff, contrarian. I use simple words and avoid emojis.'"
                    value={auditBrandVoice}
                    onChange={(e) => setAuditBrandVoice(e.target.value)}
                    rows={6}
                    disabled={isAuditing}
                  />

                  <TextInput
                    id="content_to_audit_input"
                    label="2. Paste Your Draft"
                    placeholder="Paste the LinkedIn post or Tweet you want to check..."
                    value={contentToAudit}
                    onChange={(e) => setContentToAudit(e.target.value)}
                    rows={10}
                    disabled={isAuditing}
                  />

                  <div className="pt-4">
                    <GenerateButton
                      onClick={handleAudit}
                      isLoading={isAuditing}
                      disabled={!auditBrandVoice || !contentToAudit}
                    >
                      Audit Content
                    </GenerateButton>
                  </div>
                </div>

                <div className="lg:mt-0 mt-8 h-full min-h-[600px]">
                  <OutputDisplay
                    isLoading={isAuditing}
                    error={auditError}
                    content={auditResult}
                    onRetry={handleAudit}
                    title="Audit Report"
                  />
                </div>
              </div>
            </main>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
