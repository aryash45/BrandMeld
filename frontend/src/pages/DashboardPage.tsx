import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCampaignLauncher } from '../hooks/useCampaignLauncher';
import EditToolbar from '../components/EditToolbar';
import {
  editCampaignDraft,
  onboardBrand,
  planCampaign,
  PLATFORM_META,
  type BrandDNA,
  type CampaignBrief,
  type CampaignPlan,
  type EditCommand,
  type Platform,
} from '../services/apiService';

const DEFAULT_PLATFORMS: Platform[] = ['twitter', 'linkedin', 'newsletter'];

const Spinner: React.FC = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const DashboardPage: React.FC = () => {
  const { user, session } = useAuth();
  const authToken = session?.access_token;
  const cam = useCampaignLauncher();
  const resultsRef = useRef<HTMLDivElement>(null);

  const [localBrandDna, setLocalBrandDna] = useState<BrandDNA | null>(null);
  const [onboardUrl, setOnboardUrl] = useState('');
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [isOnboarding, setIsOnboarding] = useState(false);

  const [whatChanged, setWhatChanged] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [proofDraft, setProofDraft] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(DEFAULT_PLATFORMS);

  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [plannedSignature, setPlannedSignature] = useState<string | null>(null);

  const [editingCmd, setEditingCmd] = useState<EditCommand | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [localResults, setLocalResults] = useState<Partial<Record<Platform, string>>>({});
  const [editHistory, setEditHistory] = useState<Partial<Record<Platform, string[]>>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const proofPoints = useMemo(
    () => proofDraft.split('\n').map((line) => line.trim()).filter(Boolean),
    [proofDraft],
  );

  const brief = useMemo<CampaignBrief>(() => ({
    what_changed: whatChanged.trim(),
    why_it_matters: whyItMatters.trim(),
    target_audience: targetAudience.trim(),
    proof_points: proofPoints,
    call_to_action: callToAction.trim(),
  }), [callToAction, proofPoints, targetAudience, whatChanged, whyItMatters]);

  const briefSignature = useMemo(
    () => JSON.stringify({ brief, voice: cam.brandVoice, platforms: selectedPlatforms }),
    [brief, cam.brandVoice, selectedPlatforms],
  );

  const activePlatform: Platform | null =
    cam.activeTab && localResults[cam.activeTab]
      ? cam.activeTab
      : (Object.keys(localResults)[0] as Platform | undefined) ?? null;

  useEffect(() => {
    if (cam.result?.results) {
      setLocalResults(cam.result.results);
      setEditHistory({});
    }
  }, [cam.result]);

  useEffect(() => {
    if (Object.keys(localResults).length > 0) {
      const timer = setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      return () => clearTimeout(timer);
    }
  }, [localResults]);

  const togglePlatform = useCallback((platform: Platform) => {
    setSelectedPlatforms((current) => (
      current.includes(platform)
        ? (current.length === 1 ? current : current.filter((item) => item !== platform))
        : [...current, platform]
    ));
  }, []);

  const handleBrandScan = useCallback(async () => {
    const url = onboardUrl.trim();
    if (!url) return;
    setIsOnboarding(true);
    setOnboardError(null);
    try {
      const dna = await onboardBrand(url, user?.id, authToken);
      setLocalBrandDna(dna);
      cam.setBrandVoice(dna.voice_personality);
    } catch (err) {
      setOnboardError(err instanceof Error ? err.message : 'SCAN_FAILURE');
    } finally {
      setIsOnboarding(false);
    }
  }, [authToken, cam, onboardUrl, user?.id]);

  const handlePlanCampaign = useCallback(async () => {
    if (!brief.what_changed || selectedPlatforms.length === 0) return;
    setIsPlanning(true);
    setPlanError(null);
    try {
      const planningVoice =
        cam.brandVoice.trim()
        || localBrandDna?.voice_personality
        || 'Confident, direct, and human. Explain why the product matters without sounding corporate.';
      const response = await planCampaign(brief, planningVoice, localBrandDna, selectedPlatforms, authToken);
      setPlan(response.plan);
      setPlannedSignature(briefSignature);
      if (!cam.brandVoice.trim()) {
        cam.setBrandVoice(planningVoice);
      }
      cam.setContentRequest(response.plan.recommended_prompt);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Campaign planning failed.');
    } finally {
      setIsPlanning(false);
    }
  }, [authToken, brief, briefSignature, cam, localBrandDna, selectedPlatforms]);

  const handleGenerateDrafts = useCallback(async () => {
    if (!plan || plannedSignature !== briefSignature) return;
    await cam.launch(localBrandDna, authToken, plan.recommended_prompt);
  }, [authToken, briefSignature, cam, localBrandDna, plan, plannedSignature]);

  const handleEdit = useCallback(async (cmd: EditCommand) => {
    if (!activePlatform || !localResults[activePlatform] || editLoading) return;
    const original = localResults[activePlatform]!;
    setEditingCmd(cmd);
    setEditLoading(true);
    setEditHistory((history) => ({ ...history, [activePlatform]: [...(history[activePlatform] ?? []), original] }));
    try {
      const edited = await editCampaignDraft(original, cam.brandVoice || localBrandDna?.voice_personality || '', cmd, authToken);
      setLocalResults((results) => ({ ...results, [activePlatform]: edited }));
    } catch {
      setEditHistory((history) => ({ ...history, [activePlatform]: (history[activePlatform] ?? []).slice(0, -1) }));
    } finally {
      setEditLoading(false);
      setEditingCmd(null);
    }
  }, [activePlatform, authToken, cam.brandVoice, editLoading, localBrandDna, localResults]);

  const handleUndo = useCallback(() => {
    if (!activePlatform) return;
    const snapshots = editHistory[activePlatform] ?? [];
    if (!snapshots.length) return;
    setLocalResults((results) => ({ ...results, [activePlatform]: snapshots[snapshots.length - 1] }));
    setEditHistory((history) => ({ ...history, [activePlatform]: snapshots.slice(0, -1) }));
  }, [activePlatform, editHistory]);

  const handleCopy = useCallback((platform: Platform) => {
    const content = localResults[platform];
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(platform);
    setTimeout(() => setCopied(null), 1800);
  }, [localResults]);

  const handleReset = useCallback(() => {
    cam.reset();
    setWhatChanged('');
    setWhyItMatters('');
    setTargetAudience('');
    setCallToAction('');
    setProofDraft('');
    setSelectedPlatforms(DEFAULT_PLATFORMS);
    setPlan(null);
    setPlanError(null);
    setPlannedSignature(null);
    setLocalResults({});
    setEditHistory({});
  }, [cam]);

  const isPlanStale = Boolean(plan && plannedSignature !== briefSignature);
  const canUndo = activePlatform ? (editHistory[activePlatform]?.length ?? 0) > 0 : false;

  return (
    <main className="min-h-full bg-black px-8 py-10 text-white lg:px-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="border-2 border-white p-8">
          <p className="font-label text-xs uppercase tracking-[0.28em] text-brand-cyan">Founder Marketing Autopilot</p>
          <h1 className="mt-4 max-w-4xl font-headline text-4xl font-black uppercase tracking-tight lg:text-6xl">
            Plan the angle before you generate the copy
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70">
            The product should start from what changed, why it matters, and what proof you have. That is how BrandMeld stops feeling like a wrapper.
          </p>
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_360px]">
          <section className="space-y-8">
            <div className="border-2 border-white p-8">
              <div className="mb-5">
                <p className="font-label text-xs uppercase tracking-[0.26em] text-brand-yellow">Step 1</p>
                <h2 className="mt-2 font-headline text-3xl font-black uppercase tracking-tight">Capture the signal</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Use product reality, not a vague prompt. Feed the planner a real update, its payoff, and proof.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <label className="lg:col-span-2">
                  <span className="mb-2 block font-label text-xs uppercase tracking-[0.22em] text-white/65">What changed?</span>
                  <textarea value={whatChanged} onChange={(event) => setWhatChanged(event.target.value)} rows={5} className="w-full border-2 border-white bg-black p-4 text-base outline-none focus:border-brand-yellow" placeholder="Shipped campaign planning before content generation." />
                </label>
                <label>
                  <span className="mb-2 block font-label text-xs uppercase tracking-[0.22em] text-white/65">Why it matters</span>
                  <textarea value={whyItMatters} onChange={(event) => setWhyItMatters(event.target.value)} rows={4} className="w-full border-2 border-white bg-black p-4 text-base outline-none focus:border-brand-yellow" placeholder="Users get a sharper story before the app writes anything." />
                </label>
                <label>
                  <span className="mb-2 block font-label text-xs uppercase tracking-[0.22em] text-white/65">Target audience</span>
                  <textarea value={targetAudience} onChange={(event) => setTargetAudience(event.target.value)} rows={4} className="w-full border-2 border-white bg-black p-4 text-base outline-none focus:border-brand-yellow" placeholder="Technical founders who hate marketing." />
                </label>
                <label>
                  <span className="mb-2 block font-label text-xs uppercase tracking-[0.22em] text-white/65">Proof points</span>
                  <textarea value={proofDraft} onChange={(event) => setProofDraft(event.target.value)} rows={5} className="w-full border-2 border-white bg-black p-4 text-base outline-none focus:border-brand-yellow" placeholder={"One per line\nUsers now see why a campaign angle works\nDraft generation follows an explicit plan"} />
                </label>
                <label>
                  <span className="mb-2 block font-label text-xs uppercase tracking-[0.22em] text-white/65">Call to action</span>
                  <textarea value={callToAction} onChange={(event) => setCallToAction(event.target.value)} rows={5} className="w-full border-2 border-white bg-black p-4 text-base outline-none focus:border-brand-yellow" placeholder="Invite them to try the new workflow." />
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-white/15 pt-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="mb-3 font-label text-xs uppercase tracking-[0.22em] text-white/65">Channels</div>
                  <div className="flex flex-wrap gap-3">
                    {DEFAULT_PLATFORMS.map((platform) => (
                      <button key={platform} type="button" onClick={() => togglePlatform(platform)} className={`border-2 px-4 py-2 font-label text-xs uppercase tracking-[0.18em] ${selectedPlatforms.includes(platform) ? 'border-brand-yellow bg-brand-yellow text-black' : 'border-white hover:text-brand-cyan'}`}>
                        {PLATFORM_META[platform].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={handleReset} className="border-2 border-white px-4 py-3 font-label text-xs uppercase tracking-[0.18em] hover:bg-white hover:text-black">Reset</button>
                  <button type="button" onClick={handlePlanCampaign} disabled={!brief.what_changed || selectedPlatforms.length === 0 || isPlanning} className="flex items-center gap-3 border-2 border-black bg-brand-yellow px-5 py-3 font-headline text-xl font-black uppercase text-black disabled:opacity-50">
                    {isPlanning ? <Spinner /> : null}
                    {isPlanning ? 'Planning...' : 'Plan Campaign'}
                  </button>
                </div>
              </div>
            </div>

            {(planError || cam.error) && (
              <div className="border-2 border-red-500 bg-red-950/50 px-5 py-4 font-label text-xs uppercase tracking-[0.16em] text-red-200">
                {planError ? `Planner error: ${planError}` : `Generation error: ${cam.error}`}
              </div>
            )}

            <div className="border-2 border-white p-8">
              <div className="mb-5">
                <p className="font-label text-xs uppercase tracking-[0.26em] text-brand-yellow">Step 2</p>
                <h2 className="mt-2 font-headline text-3xl font-black uppercase tracking-tight">Approve the angle</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  This is the aha moment. BrandMeld explains the story, why it works, and what proof it will use before it drafts anything.
                </p>
              </div>

              {!plan ? (
                <div className="border-2 border-dashed border-white/20 px-6 py-10 text-center text-white/45">
                  Plan a campaign first. This panel will become your approval surface.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="border-2 border-brand-yellow bg-black p-5">
                    <div className="font-label text-xs uppercase tracking-[0.22em] text-brand-yellow">Recommended angle</div>
                    <h3 className="mt-3 font-headline text-3xl font-black uppercase tracking-tight">{plan.primary_angle.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/75">{plan.summary}</p>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="border border-white/20 p-5">
                      <div className="font-label text-xs uppercase tracking-[0.22em] text-brand-cyan">Why this works</div>
                      <p className="mt-3 text-sm leading-relaxed text-white/80">{plan.primary_angle.why_this_works}</p>
                      <div className="mt-4 font-label text-xs uppercase tracking-[0.22em] text-brand-cyan">Audience focus</div>
                      <p className="mt-2 text-sm leading-relaxed text-white/80">{plan.primary_angle.audience_focus}</p>
                    </div>
                    <div className="border border-white/20 p-5">
                      <div className="font-label text-xs uppercase tracking-[0.22em] text-brand-cyan">Core message</div>
                      <p className="mt-3 text-sm leading-relaxed text-white/80">{plan.primary_angle.core_message}</p>
                      <div className="mt-4 font-label text-xs uppercase tracking-[0.22em] text-brand-cyan">CTA</div>
                      <p className="mt-2 text-sm leading-relaxed text-white/80">{plan.primary_angle.call_to_action}</p>
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="border border-white/20 p-5">
                      <div className="font-label text-xs uppercase tracking-[0.22em] text-brand-cyan">Proof to use</div>
                      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/80">
                        {plan.primary_angle.proof_to_use.map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                    <div className="border border-white/20 p-5">
                      <div className="font-label text-xs uppercase tracking-[0.22em] text-brand-cyan">Approval checklist</div>
                      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/80">
                        {plan.approval_checklist.map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div className="border border-white/20 p-5">
                    <div className="font-label text-xs uppercase tracking-[0.22em] text-brand-cyan">Channel strategy</div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      {plan.channels.map((channel) => (
                        <div key={channel.platform} className="border border-white/10 p-3">
                          <div className="font-label text-[11px] uppercase tracking-[0.18em] text-white/45">{PLATFORM_META[channel.platform as Platform]?.label ?? channel.platform}</div>
                          <div className="mt-1 text-sm font-semibold text-white/85">{channel.format}</div>
                          <p className="mt-1 text-sm leading-relaxed text-white/70">{channel.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-white/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-white/55">
                      {isPlanStale ? 'Inputs changed. Refresh the plan before drafting.' : 'The plan is current. Generate drafts when you are happy with it.'}
                    </div>
                    <button type="button" onClick={handleGenerateDrafts} disabled={!plan || isPlanStale || cam.isLaunching} className="flex items-center gap-3 border-2 border-black bg-brand-cyan px-5 py-3 font-headline text-xl font-black uppercase text-black disabled:opacity-50">
                      {cam.isLaunching ? <Spinner /> : null}
                      {cam.isLaunching ? 'Generating...' : 'Generate Drafts'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {Object.keys(localResults).length > 0 && (
              <div ref={resultsRef} className="border-2 border-white p-8">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-label text-xs uppercase tracking-[0.26em] text-brand-yellow">Step 3</p>
                    <h2 className="mt-2 font-headline text-3xl font-black uppercase tracking-tight">Refine the drafts</h2>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(Object.keys(localResults) as Platform[]).map((platform) => (
                      <button key={platform} type="button" onClick={() => cam.setActiveTab(platform)} className={`border-2 px-4 py-2 font-label text-xs uppercase tracking-[0.18em] ${activePlatform === platform ? 'border-brand-yellow bg-brand-yellow text-black' : 'border-white hover:text-brand-cyan'}`}>
                        {PLATFORM_META[platform].label}
                      </button>
                    ))}
                  </div>
                </div>

                <EditToolbar isEditing={editLoading} activeCommand={editingCmd} onEdit={handleEdit} onUndo={handleUndo} canUndo={canUndo} disabled={cam.isLaunching} />

                <div className="mt-6 border-2 border-white bg-black p-5">
                  {activePlatform && localResults[activePlatform] ? (
                    <>
                      <div className="mb-4 flex items-center justify-between border-b border-dashed border-white/25 pb-3">
                        <span className="font-label text-xs uppercase tracking-[0.22em] text-brand-cyan">{PLATFORM_META[activePlatform].label}</span>
                        <div className="flex gap-3">
                          <span className="font-label text-[11px] uppercase tracking-[0.18em] text-white/45">{localResults[activePlatform]!.length} chars</span>
                          <button type="button" onClick={() => handleCopy(activePlatform)} className="font-label text-[11px] uppercase tracking-[0.18em] text-brand-cyan">
                            {copied === activePlatform ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <textarea readOnly rows={18} value={localResults[activePlatform]!} className="custom-scrollbar w-full resize-none bg-transparent text-base leading-relaxed outline-none" />
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="border-2 border-white p-5">
              <div className="font-label text-xs uppercase tracking-[0.22em] text-brand-yellow">Brand memory</div>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                Website scan is a support feature. It gives the planner context, but the hero is still product-signal-to-campaign.
              </p>
              <div className="mt-4 flex gap-3">
                <input type="url" value={onboardUrl} onChange={(event) => setOnboardUrl(event.target.value)} className="min-w-0 flex-1 border-2 border-white bg-black px-4 py-3 text-sm outline-none focus:border-brand-cyan" placeholder="https://your-site.com" />
                <button type="button" onClick={handleBrandScan} disabled={isOnboarding || !onboardUrl.trim()} className="border-2 border-black bg-brand-yellow px-4 py-3 font-label text-xs uppercase tracking-[0.18em] text-black disabled:opacity-50">
                  {isOnboarding ? <Spinner /> : 'Scan'}
                </button>
              </div>
              {onboardError && <div className="mt-3 text-xs uppercase tracking-[0.16em] text-red-400">{onboardError}</div>}
              <div className="mt-5">
                <div className="mb-2 font-label text-xs uppercase tracking-[0.22em] text-white/65">Voice override</div>
                <textarea value={cam.brandVoice} onChange={(event) => cam.setBrandVoice(event.target.value)} rows={5} className="w-full border-2 border-white bg-black p-4 text-sm outline-none focus:border-brand-cyan" placeholder="Direct, specific, no corporate filler." />
              </div>
            </div>

            <div className="border-2 border-white p-5">
              <div className="font-label text-xs uppercase tracking-[0.22em] text-brand-yellow">Current context</div>
              <div className="mt-4 space-y-4 text-sm text-white/75">
                <div>
                  <div className="font-label text-[11px] uppercase tracking-[0.18em] text-white/45">Brand</div>
                  <div className="mt-1 font-semibold text-white">{localBrandDna?.brand_name || 'Manual mode'}</div>
                </div>
                <div>
                  <div className="font-label text-[11px] uppercase tracking-[0.18em] text-white/45">Voice</div>
                  <div className="mt-1">{cam.brandVoice || localBrandDna?.voice_personality || 'No voice loaded yet'}</div>
                </div>
                <div>
                  <div className="font-label text-[11px] uppercase tracking-[0.18em] text-white/45">Proof signals</div>
                  <div className="mt-1">{proofPoints.length > 0 ? `${proofPoints.length} proof point(s) ready` : 'Add proof so the plan stays specific.'}</div>
                </div>
                <div>
                  <div className="font-label text-[11px] uppercase tracking-[0.18em] text-white/45">Difference</div>
                  <div className="mt-1">The app now explains why a campaign angle works before it writes the drafts.</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default DashboardPage;
