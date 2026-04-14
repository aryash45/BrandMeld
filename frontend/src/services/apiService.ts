/**
 * apiService — All HTTP calls to the BrandMeld FastAPI backend.
 *
 * Design principles:
 *  - Single source of truth for API base URL (from VITE_API_URL env var)
 *  - Every fetch call is wrapped with structured error extraction so
 *    callers always get a meaningful Error, never a raw Response object
 *  - Auth token is accepted as an optional argument; the caller (page/hook)
 *    reads it from AuthContext and passes it in — this keeps apiService
 *    free of React/context dependencies and fully testable in isolation
 *  - Dead code removed: `generateContent` (single-platform) is removed;
 *    the app exclusively uses `batchGenerateContent`
 *  - `analyzeBrandVoice` (thin wrapper) is also removed — callers use
 *    `fetchBrandDNA` directly
 */

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'http://localhost:8080';

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Builds standard headers for JSON POST requests.
 * Attaches Authorization header when an auth token is provided.
 */
function buildHeaders(authToken?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * Extracts an error message from a failed Response.
 * Tries to parse a FastAPI `{ detail: string }` shape first, then falls back
 * to the HTTP status text, then a generic fallback.
 */
async function extractErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // body wasn't JSON — fall through to status text
  }
  return response.statusText || fallback;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'newsletter';

export const PLATFORM_META: Record<
  Platform,
  { label: string; icon: string; color: string }
> = {
  twitter: { label: 'X Thread', icon: 'X', color: 'text-slate-200' },
  linkedin: { label: 'LinkedIn', icon: 'in', color: 'text-blue-400' },
  instagram: { label: 'Instagram', icon: 'IG', color: 'text-pink-400' },
  newsletter: { label: 'Newsletter', icon: 'NL', color: 'text-teal-400' },
};

export interface BrandDNA {
  brand_name: string;
  primary_hex: string;
  typography: string[];
  voice_personality: string;
  banned_concepts: string[];
}

export type EditCommand =
  | 'shorter'
  | 'longer'
  | 'casual'
  | 'formal'
  | 'hook'
  | 'punchy';

// ─── Brand Discovery ──────────────────────────────────────────────────────────

/**
 * Fetches brand DNA from a website URL via server-side Playwright + Gemini.
 */
export const fetchBrandDNA = async (
  companyIdentifier: string,
  authToken?: string,
): Promise<BrandDNA> => {
  const response = await fetch(
    `${API_BASE_URL}/v1/discovery?url=${encodeURIComponent(companyIdentifier)}`,
    {
      method: 'POST',
      headers: buildHeaders(authToken),
    },
  );

  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Failed to fetch brand DNA');
    throw new Error(msg);
  }

  const data = await response.json();
  return data.data as BrandDNA;
};

// ─── Content Generation ───────────────────────────────────────────────────────

/**
 * Generates brand-aligned content for one or more platforms simultaneously.
 * Returns a partial record — only the platforms that succeeded are included.
 */
export const batchGenerateContent = async (
  brandVoice: string,
  contentRequest: string,
  platforms: Platform[],
  authToken?: string,
): Promise<Partial<Record<Platform, string>>> => {
  const response = await fetch(`${API_BASE_URL}/api/factory/batch-generate`, {
    method: 'POST',
    headers: buildHeaders(authToken),
    body: JSON.stringify({ brand_voice: brandVoice, content_request: contentRequest, platforms }),
  });

  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Batch generation failed');
    throw new Error(msg);
  }

  const data = await response.json();
  return (data.results ?? {}) as Partial<Record<Platform, string>>;
};

// ─── Inline Editing ───────────────────────────────────────────────────────────

/**
 * Applies a named editing command to existing content while respecting brand voice.
 */
export const editContent = async (
  originalContent: string,
  brandVoice: string,
  editCommand: EditCommand,
  authToken?: string,
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/factory/edit`, {
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

// ─── Voice Auditing ───────────────────────────────────────────────────────────

/**
 * Audits content against a brand voice profile, returning a Markdown report.
 */
export const auditContent = async (
  brandVoice: string,
  contentToAudit: string,
  authToken?: string,
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/auditor/audit`, {
    method: 'POST',
    headers: buildHeaders(authToken),
    body: JSON.stringify({ brand_voice: brandVoice, content_to_audit: contentToAudit }),
  });

  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Failed to audit content');
    throw new Error(msg);
  }

  const data = await response.json();
  return data.audit_report as string;
};

// ─── Image Generation ─────────────────────────────────────────────────────────

/**
 * Generates a brand-aligned social media image.
 * Returns a base64 data URI string ready for use in <img src=...>.
 */
export const generateImage = async (
  brandColors: string[],
  contentSummary: string,
  platform: string,
  authToken?: string,
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/imagen/generate`, {
    method: 'POST',
    headers: buildHeaders(authToken),
    body: JSON.stringify({
      brand_colors: brandColors,
      content_summary: contentSummary,
      platform,
    }),
  });

  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Failed to generate image');
    throw new Error(msg);
  }

  const data = await response.json();
  return `data:image/png;base64,${data.image_base64}`;
};

// ─── Health check ─────────────────────────────────────────────────────────────

export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};
