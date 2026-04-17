/**
 * apiService — All HTTP calls to the BrandMeld FastAPI backend.
 *
 * v2 adds the /v1/campaign/* endpoints (launch, edit, onboard, watchdog)
 * while preserving backward-compatible legacy calls so existing hooks
 * continue to work without modification.
 */

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'http://localhost:8080';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function buildHeaders(authToken?: string): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return headers;
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // not JSON
  }
  return response.statusText || fallback;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'newsletter';

export const PLATFORM_META: Record<Platform, { label: string; icon: string; color: string }> = {
  twitter:    { label: 'X Thread',    icon: 'X',  color: 'text-slate-200' },
  linkedin:   { label: 'LinkedIn',    icon: 'in', color: 'text-blue-400'  },
  instagram:  { label: 'Instagram',   icon: 'IG', color: 'text-pink-400'  },
  newsletter: { label: 'Newsletter',  icon: 'NL', color: 'text-teal-400'  },
};

export interface BrandDNA {
  brand_name: string;
  primary_hex: string;
  typography: string[];
  voice_personality: string;
  banned_concepts: string[];
}

export interface CampaignBrief {
  what_changed: string;
  why_it_matters: string;
  target_audience: string;
  proof_points: string[];
  call_to_action: string;
}

export interface CampaignChannelPlan {
  platform: Platform;
  format: string;
  rationale: string;
}

export interface CampaignAngle {
  title: string;
  audience_focus: string;
  core_message: string;
  proof_to_use: string[];
  call_to_action: string;
  why_this_works: string;
}

export interface CampaignPlan {
  campaign_headline: string;
  summary: string;
  primary_angle: CampaignAngle;
  alternate_angles: string[];
  channels: CampaignChannelPlan[];
  recommended_prompt: string;
  approval_checklist: string[];
}

export interface CampaignPlanResult {
  plan: CampaignPlan;
  success: boolean;
  message: string;
}

/** Human-readable actions shown in EditToolbar */
export type EditCommand = 'shorter' | 'longer' | 'casual' | 'professional' | 'hook' | 'bold';

// ─── v2: Campaign Engine endpoints ───────────────────────────────────────────

export interface CampaignLaunchResult {
  results: Partial<Record<Platform, string>>;
  success: boolean;
  message: string;
}

export const planCampaign = async (
  brief: CampaignBrief,
  brandVoice: string,
  brandDna?: BrandDNA | null,
  platforms: Platform[] = ['twitter', 'linkedin', 'newsletter'],
  authToken?: string,
): Promise<CampaignPlanResult> => {
  const response = await fetch(`${API_BASE_URL}/v1/campaign/plan`, {
    method: 'POST',
    headers: buildHeaders(authToken),
    body: JSON.stringify({
      brief,
      brand_voice: brandVoice,
      brand_dna: brandDna ?? null,
      platforms,
    }),
  });
  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Campaign planning failed');
    throw new Error(msg);
  }
  return response.json() as Promise<CampaignPlanResult>;
};

/**
 * Zero-config batch launch — defaults to X, LinkedIn, Instagram.
 * Automatically runs internal brand-voice self-correction on every draft.
 * Returns generated copy only; image generation is disabled in v0.
 */
export const launchCampaign = async (
  contentRequest: string,
  brandVoice: string,
  brandDna?: BrandDNA | null,
  platforms: Platform[] = ['twitter', 'linkedin', 'newsletter'],
  authToken?: string,
): Promise<CampaignLaunchResult> => {
  const response = await fetch(`${API_BASE_URL}/v1/campaign/launch`, {
    method: 'POST',
    headers: buildHeaders(authToken),
    body: JSON.stringify({
      content_request: contentRequest,
      brand_voice: brandVoice,
      brand_dna: brandDna ?? null,
      platforms,
    }),
  });
  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Campaign launch failed');
    throw new Error(msg);
  }
  return response.json() as Promise<CampaignLaunchResult>;
};

/**
 * Applies a human-action editing command to a draft.
 */
export const editCampaignDraft = async (
  originalContent: string,
  brandVoice: string,
  editCommand: EditCommand,
  authToken?: string,
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/v1/campaign/edit`, {
    method: 'POST',
    headers: buildHeaders(authToken),
    body: JSON.stringify({
      original_content: originalContent,
      brand_voice: brandVoice,
      edit_command: editCommand,
    }),
  });
  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Edit failed');
    throw new Error(msg);
  }
  const data = await response.json();
  return data.edited_content as string;
};

/**
 * Zero-config onboarding — scrapes URL, extracts Brand DNA, stores in Supabase.
 */
export const onboardBrand = async (
  url: string,
  userId?: string,
  authToken?: string,
): Promise<BrandDNA> => {
  const response = await fetch(`${API_BASE_URL}/v1/campaign/onboard`, {
    method: 'POST',
    headers: buildHeaders(authToken),
    body: JSON.stringify({ url, user_id: userId }),
  });
  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Onboarding failed');
    throw new Error(msg);
  }
  const data = await response.json();
  return data.brand_dna as BrandDNA;
};

/**
 * Watchdog — checks a URL for new products and returns draft campaign hooks.
 */
export interface WatchdogResult {
  new_products_detected: boolean;
  draft_campaigns: { product_name: string; campaign_hook: string; platforms: string[] }[];
  message: string;
}

export const runWatchdog = async (
  url: string,
  lastKnownHash?: string,
  authToken?: string,
): Promise<WatchdogResult> => {
  const params = new URLSearchParams({ url });
  if (lastKnownHash) params.set('last_known_hash', lastKnownHash);
  const response = await fetch(`${API_BASE_URL}/v1/campaign/watchdog?${params}`, {
    method: 'GET',
    headers: buildHeaders(authToken),
  });
  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Watchdog check failed');
    throw new Error(msg);
  }
  return response.json() as Promise<WatchdogResult>;
};

// ─── Legacy (backward-compatible) ────────────────────────────────────────────

/** @deprecated Use launchCampaign instead */
export const fetchBrandDNA = async (
  companyIdentifier: string,
  authToken?: string,
): Promise<BrandDNA> => {
  const response = await fetch(
    `${API_BASE_URL}/v1/discovery?url=${encodeURIComponent(companyIdentifier)}`,
    { method: 'POST', headers: buildHeaders(authToken) },
  );
  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Failed to fetch brand DNA');
    throw new Error(msg);
  }
  const data = await response.json();
  return data.data as BrandDNA;
};

/** @deprecated Use launchCampaign instead */
export const batchGenerateContent = async (
  brandVoice: string,
  contentRequest: string,
  platforms: Platform[],
  authToken?: string,
): Promise<Partial<Record<Platform, string>>> => {
  const data = await launchCampaign(
    contentRequest,
    brandVoice,
    null,
    platforms,
    authToken,
  );
  return data.results;
};

/** @deprecated Use editCampaignDraft instead */
export const editContent = async (
  originalContent: string,
  brandVoice: string,
  editCommand: EditCommand,
  authToken?: string,
): Promise<string> => editCampaignDraft(originalContent, brandVoice, editCommand, authToken);

/** @deprecated */
export const auditContent = async (
  _brandVoice: string,
  _contentToAudit: string,
  _authToken?: string,
): Promise<string> => {
  throw new Error(
    'Manual audit is no longer exposed. Brand audit now runs automatically during launch and edit.',
  );
};

/** @deprecated */
export const generateImage = async (
  brandColors: string[],
  contentSummary: string,
  platform: string,
  authToken?: string,
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/imagen/generate`, {
    method: 'POST',
    headers: buildHeaders(authToken),
    body: JSON.stringify({ brand_colors: brandColors, content_summary: contentSummary, platform }),
  });
  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Failed to generate image');
    throw new Error(msg);
  }
  const data = await response.json();
  if (typeof data.image_base64 !== 'string' || !data.image_base64) {
    throw new Error('Image generation is not available in v0.');
  }
  return `data:image/png;base64,${data.image_base64}`;
};

export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};
