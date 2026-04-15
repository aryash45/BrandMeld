import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCampaignLauncher } from '../hooks/useCampaignLauncher';
import EditToolbar from '../components/EditToolbar';
import {
  type Platform,
  type EditCommand,
  type BrandDNA,
  PLATFORM_META,
  editCampaignDraft,
  onboardBrand,
} from '../services/apiService';

// ─── Micro-components ─────────────────────────────────────────────────────────

const PlatformTab: React.FC<{
  platform: Platform;
  active: boolean;
  onClick: () => void;
}> = ({ platform, active, onClick }) => {
  const meta = PLATFORM_META[platform];
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-2 border-2 border-white px-4 py-2 text-sm font-bold transition-all uppercase tracking-tight',
        active
          ? 'bg-brand-yellow text-black neo-shadow translate-x-[-2px] translate-y-[-2px]'
          : 'bg-black text-white hover:bg-white hover:text-black',
      ].join(' ')}
    >
      <span>{meta.label}</span>
    </button>
  );
};

// Raw minimal spinner
const Spinner: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => {
  const s = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <svg className={`${s} animate-spin inline-block`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const { user, session } = useAuth();
  const authToken = session?.access_token;
  const cam = useCampaignLauncher();

  // Brand DNA local state
  const [localBrandDna, setLocalBrandDna] = useState<BrandDNA | null>(null);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [onboardUrl, setOnboardUrl] = useState('');

  // UI Toggles
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Per-platform edit
  const [editingCmd, setEditingCmd] = useState<EditCommand | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [localResults, setLocalResults] = useState<Partial<Record<Platform, string>>>({});
  const [editHistory, setEditHistory] = useState<Partial<Record<Platform, string[]>>>({});

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cam.result?.results) {
      setLocalResults(cam.result.results);
      setEditHistory({});
    }
  }, [cam.result]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('brandmeld_load_item');
      if (!raw) return;
      sessionStorage.removeItem('brandmeld_load_item');
      const item = JSON.parse(raw) as import('../hooks/useHistory').HistoryItem;
      cam.setContentRequest(item.contentRequest);
      cam.setBrandVoice(item.brandVoice);
      setLocalResults(item.results);
      setEditHistory({});
      const firstPlatform = (item.platforms[0] ?? Object.keys(item.results)[0]) as Platform | undefined;
      if (firstPlatform) cam.setActiveTab(firstPlatform);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (Object.keys(localResults).length > 0) {
      const t = setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      return () => clearTimeout(t);
    }
  }, [localResults]);

  const activePlatform: Platform | null =
    cam.activeTab && localResults[cam.activeTab]
      ? cam.activeTab
      : (Object.keys(localResults)[0] as Platform | undefined) ?? null;

  const handleBrandScan = useCallback(async () => {
    const url = onboardUrl.trim();
    if (!url) return;
    setIsOnboarding(true);
    setOnboardError(null);
    try {
      const dna = await onboardBrand(url, user?.id, authToken);
      setLocalBrandDna(dna);
      cam.setBrandVoice(dna.voice_personality);
      setShowVoiceInput(true);
    } catch (err) {
      setOnboardError(err instanceof Error ? err.message : 'SCAN_FAILURE');
    } finally {
      setIsOnboarding(false);
    }
  }, [onboardUrl, user?.id, authToken, cam]);

  const handleCopy = useCallback((platform: Platform) => {
    const content = localResults[platform];
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(platform);
    setTimeout(() => setCopied(null), 1800);
  }, [localResults]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (cam.canLaunch && !cam.isLaunching) cam.launch(localBrandDna, authToken);
    }
  };

  const handleEdit = useCallback(async (cmd: EditCommand) => {
    if (!activePlatform || !localResults[activePlatform] || editLoading) return;
    setEditingCmd(cmd);
    setEditLoading(true);
    const original = localResults[activePlatform]!;
    setEditHistory((h) => ({ ...h, [activePlatform]: [...(h[activePlatform] ?? []), original] }));
    try {
      const edited = await editCampaignDraft(original, cam.brandVoice || localBrandDna?.voice_personality || '', cmd, authToken);
      setLocalResults((r) => ({ ...r, [activePlatform]: edited }));
    } catch {
      setEditHistory((h) => ({ ...h, [activePlatform]: (h[activePlatform] ?? []).slice(0, -1) }));
    } finally {
      setEditLoading(false);
      setEditingCmd(null);
    }
  }, [activePlatform, localResults, editLoading, cam.brandVoice, localBrandDna, authToken]);

  const handleUndo = useCallback(() => {
    if (!activePlatform) return;
    const snaps = editHistory[activePlatform] ?? [];
    if (!snaps.length) return;
    setLocalResults((r) => ({ ...r, [activePlatform]: snaps[snaps.length - 1] }));
    setEditHistory((h) => ({ ...h, [activePlatform]: snaps.slice(0, -1) }));
  }, [activePlatform, editHistory]);

  const handleReset = useCallback(() => {
    cam.reset();
    setLocalResults({});
    setEditHistory({});
  }, [cam]);

  const canUndo = activePlatform ? (editHistory[activePlatform]?.length ?? 0) > 0 : false;
  const hasResults = Object.keys(localResults).length > 0;

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-black min-h-full">
      {/* ── Engine Input ── */}
      <section className="w-full border-b-2 border-white p-8 lg:p-12">
        <div className="max-w-6xl mx-auto">
          <label className="block font-headline font-black text-3xl lg:text-5xl mb-6 tracking-tighter uppercase italic">
            WHAT ARE YOU PROMOTING?
          </label>
          <div className="relative group">
            <textarea
              className="w-full bg-black border-2 border-white p-6 font-headline text-2xl lg:text-4xl uppercase tracking-tighter focus:ring-0 focus:border-brand-yellow focus:shadow-[4px_4px_0px_0px_#EAFF00] outline-none min-h-[200px] resize-none transition-all placeholder:text-white/20"
              placeholder="INPUT_CAMPAIGN_CORE_IDENTITY_HERE..."
              value={cam.contentRequest}
              onChange={(e) => cam.setContentRequest(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={cam.isLaunching}
            />
            <div className="absolute bottom-4 right-4 font-label text-xs opacity-50 group-focus-within:text-brand-yellow group-focus-within:opacity-100 transition-colors">
              [BUFFER_READY: {cam.contentRequest.length}_B]
            </div>
          </div>
        </div>
      </section>

      {/* ── Controls & CTA ── */}
      <section className="px-8 py-6 lg:px-12 lg:py-8 border-b-2 border-white bg-surface-container-lowest">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 items-stretch">
          <div className="flex flex-col flex-1 gap-4">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowVoiceInput(!showVoiceInput)}
                className={`flex-1 border-2 border-white font-headline font-bold text-xl p-4 transition-all flex items-center justify-center gap-3 ${showVoiceInput ? 'bg-brand-cyan text-black neo-shadow' : 'bg-white text-black hover:bg-brand-cyan hover:border-brand-cyan'}`}
              >
                <span className="material-symbols-outlined shrink-0">settings_voice</span>
                <span className="truncate">VOICE_BLUEPRINT</span>
              </button>
              
              <button
                type="button"
                onClick={() => setShowOnboard(!showOnboard)}
                className={`flex-1 border-2 border-white font-headline font-bold text-xl p-4 transition-all flex items-center justify-center gap-3 ${showOnboard || localBrandDna ? 'bg-white text-black neo-shadow' : 'text-white hover:bg-white hover:text-black'}`}
              >
                <span className="material-symbols-outlined shrink-0">link</span>
                <span className="truncate">{localBrandDna ? localBrandDna.brand_name.toUpperCase() : 'SCAN_BRAND_URL'}</span>
              </button>
            </div>

            {/* Dynamic Panels */}
            {showVoiceInput && (
              <div className="border-2 border-white p-4 bg-black">
                <div className="font-label text-xs text-brand-yellow mb-2">[SET_VOICE_PARAMETERS]</div>
                <textarea
                  rows={2}
                  value={cam.brandVoice}
                  onChange={(e) => cam.setBrandVoice(e.target.value)}
                  className="w-full bg-transparent border border-white/30 p-2 font-label text-sm uppercase outline-none focus:border-brand-yellow resize-none"
                  placeholder="E.G. HARSH, DIRECT, TECHNICAL..."
                />
              </div>
            )}

            {showOnboard && !localBrandDna && (
              <div className="border-2 border-white p-4 bg-black flex gap-3">
                <div className="flex-1">
                  <div className="font-label text-xs text-brand-cyan mb-2">[TARGET_DOMAIN]</div>
                  <input
                    type="url"
                    value={onboardUrl}
                    onChange={(e) => setOnboardUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBrandScan(); }}
                    className="w-full bg-transparent border border-white/30 p-2 font-label text-sm uppercase outline-none focus:border-brand-cyan"
                    placeholder="HTTPS://..."
                  />
                  {onboardError && <div className="text-red-500 font-label text-xs mt-1">ERR: {onboardError}</div>}
                </div>
                <button
                  type="button"
                  onClick={handleBrandScan}
                  disabled={isOnboarding || !onboardUrl.trim()}
                  className="mt-6 border-2 border-white bg-brand-cyan text-black font-bold px-6 hover:bg-white transition-colors disabled:opacity-50 h-min py-2"
                >
                  {isOnboarding ? 'SCANNING...' : 'SCAN'}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => cam.launch(localBrandDna, authToken)}
            disabled={!cam.canLaunch || cam.isLaunching}
            className="md:w-1/3 bg-brand-yellow text-black font-headline font-black text-2xl p-6 border-2 border-black neo-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_white] transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {cam.isLaunching ? (
              <><Spinner /> EXECUTING...</>
            ) : (
              <>
                LAUNCH_CAMPAIGN
                <span className="material-symbols-outlined font-bold group-hover:-translate-y-1 transition-transform">rocket_launch</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ── Status Indicator ── */}
      {cam.isLaunching && (
        <div className="border-b-2 border-white bg-brand-yellow text-black p-2 font-label text-xs font-bold uppercase flex justify-between animate-pulse">
          <span>{'>'} ENGINE_ACTIVE: GENERATING_DISTRIBUTION_ARRAYS</span>
          <span>[PLEASE_WAIT]</span>
        </div>
      )}

      {cam.error && (
        <div className="border-b-2 border-red-500 bg-red-950 text-red-500 p-2 font-label text-xs font-bold uppercase flex justify-between">
          <span>{'>'} SYSTEM_ERROR: {cam.error}</span>
          <span>[TERMINATED]</span>
        </div>
      )}

      {/* ── Output Grid ── */}
      {hasResults && !cam.isLaunching && (
        <div ref={resultsRef} className="flex flex-col lg:flex-row border-b-2 border-white">
          <section className="flex-1 p-8 lg:p-12 border-b-2 lg:border-b-0 lg:border-r-2 border-white">
            
            {/* Toolbar mapping */}
            <div className="flex justify-between items-end mb-6">
               <div className="flex gap-3">
                 <button onClick={handleReset} className="font-label text-xs border border-white px-3 py-1 hover:bg-white hover:text-black">{'<'} RESET</button>
                 {activePlatform && <button onClick={() => handleCopy(activePlatform!)} className="font-label text-xs border border-brand-cyan text-brand-cyan px-3 py-1 hover:bg-brand-cyan hover:text-black">{copied === activePlatform ? 'COPIED' : 'COPY_CLIPBOARD'}</button>}
               </div>
               <div className="flex gap-2">
                 {(Object.keys(localResults) as Platform[]).map(p => (
                   <PlatformTab key={p} platform={p} active={activePlatform === p} onClick={() => cam.setActiveTab(p)} />
                 ))}
               </div>
            </div>

            <div className="mb-4">
              <EditToolbar
                isEditing={editLoading}
                activeCommand={editingCmd}
                onEdit={handleEdit}
                onUndo={handleUndo}
                canUndo={canUndo}
                disabled={cam.isLaunching}
              />
            </div>

            <div className="grid grid-cols-1 gap-6">
              {activePlatform && localResults[activePlatform] ? (
                <div className="border-2 border-white p-6 bg-surface-container-low min-h-[400px] flex flex-col relative group">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-cyan to-brand-cyan/0"></div>
                   <div className="flex justify-between items-center mb-6 border-b border-white border-dashed pb-2">
                     <span className="font-label font-bold text-brand-cyan text-lg">[{PLATFORM_META[activePlatform].label}]</span>
                     <span className="font-label text-xs opacity-50">CHAR_COUNT: {localResults[activePlatform]!.length}</span>
                   </div>
                   <textarea
                     className="font-body text-lg leading-relaxed flex-1 mb-4 bg-transparent resize-none outline-none custom-scrollbar"
                     value={localResults[activePlatform]!}
                     readOnly
                     rows={15}
                   />
                </div>
              ) : (
                <div className="border-2 border-white/20 border-dashed p-6 flex flex-col items-center justify-center min-h-[400px] text-white/30 font-label">
                  WAITING_FOR_SELECTION...
                </div>
              )}
            </div>
          </section>

          {/* ── Side Section ── */}
          <section className="w-full lg:w-96 p-8 lg:p-12 bg-surface-container-lowest">
            <div className="space-y-8">
              
              {/* BRAND_DNA */}
              <div>
                <div className="font-label text-xs mb-2 text-brand-yellow">[BRAND_DNA_READOUT]</div>
                <div className="border-2 border-white bg-black p-4 font-label text-[10px] text-brand-cyan leading-relaxed">
                  <div className="mb-1">{'>'} ENGINE_STATE: ONLINE</div>
                  <div className="mb-1 overflow-hidden truncate whitespace-nowrap">{'>'} TARGET_IDENTITY: {localBrandDna ? localBrandDna.brand_name.toUpperCase() : 'MANUAL_OVERRIDE'}</div>
                  <div className="mb-1">{'>'} COLOR_KEY: {localBrandDna ? localBrandDna.primary_hex.toUpperCase() : 'N/A'}</div>
                  <div className="mb-1 text-white/70 line-clamp-3">{'>'} VOICE: {cam.brandVoice || localBrandDna?.voice_personality?.toUpperCase() || 'DEFAULT'}</div>
                  <div className="mt-4 flex animate-pulse">
                    <span className="w-2 h-4 bg-brand-cyan"></span>
                  </div>
                </div>
              </div>

              {/* CAMPAIGN_VISUAL */}
              <div>
                <div className="font-label text-xs mb-2 text-brand-yellow">[CAMPAIGN_VISUAL]</div>
                <div className="border-2 border-white bg-white aspect-square relative group cursor-crosshair">
                  {cam.result?.image_base64 ? (
                    <img 
                      src={`data:image/png;base64,${cam.result.image_base64}`} 
                      alt="Campaign Preview"
                      className="w-full h-full object-cover grayscale brightness-75 contrast-125"
                    />
                  ) : (
                    <div className="w-full h-full bg-black/90 flex items-center justify-center font-label flex-col gap-2">
                       <span className="material-symbols-outlined text-white/20 text-4xl">inventory_2</span>
                       <span className="text-[10px] text-white/50">AWAITING_VISUAL_DATA</span>
                    </div>
                  )}
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-brand-yellow transition-colors pointer-events-none"></div>
                  <div className="absolute top-2 left-2 bg-black px-2 py-1 font-label text-[8px] text-white">IMG_ID_{Math.floor(Math.random()*9000)+1000}</div>
                </div>
              </div>

            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default DashboardPage;
