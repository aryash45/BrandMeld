/**
 * API Service - Backend Communication Layer
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// ── Existing interfaces ──────────────────────────────────────────────────────

interface GenerateContentRequest {
  brand_voice: string;
  content_request: string;
}

interface AuditContentRequest {
  brand_voice: string;
  content_to_audit: string;
}

// ── Feature 1: Batch Generation ──────────────────────────────────────────────

export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'newsletter';

export const PLATFORM_META: Record<Platform, { label: string; icon: string; color: string }> = {
  twitter:     { label: 'X Thread',    icon: '𝕏',  color: 'text-slate-200' },
  linkedin:    { label: 'LinkedIn',    icon: 'in', color: 'text-blue-400' },
  instagram:   { label: 'Instagram',  icon: '◈',  color: 'text-pink-400' },
  newsletter:  { label: 'Newsletter', icon: '✉',  color: 'text-teal-400' },
};

interface BatchGenerationRequest {
  brand_voice: string;
  content_request: string;
  platforms: Platform[];
}

interface BatchGenerationResponse {
  results: Partial<Record<Platform, string>>;
  success: boolean;
  message: string;
}

/**
 * Generate content for multiple platforms simultaneously.
 */
export const batchGenerateContent = async (
  brandVoice: string,
  contentRequest: string,
  platforms: Platform[]
): Promise<Partial<Record<Platform, string>>> => {
  const response = await fetch(`${API_BASE_URL}/api/factory/batch-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brand_voice: brandVoice,
      content_request: contentRequest,
      platforms,
    } as BatchGenerationRequest),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Batch generation failed');
  }
  const data: BatchGenerationResponse = await response.json();
  return data.results;
};

// ── Feature 2: Inline Editing ────────────────────────────────────────────────

export type EditCommand = 'shorter' | 'longer' | 'casual' | 'formal' | 'hook' | 'punchy';

interface EditContentRequest {
  original_content: string;
  brand_voice: string;
  edit_command: EditCommand;
}

/**
 * Apply an editing command to existing content.
 */
export const editContent = async (
  originalContent: string,
  brandVoice: string,
  editCommand: EditCommand
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/factory/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      original_content: originalContent,
      brand_voice: brandVoice,
      edit_command: editCommand,
    } as EditContentRequest),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Edit failed');
  }
  const data = await response.json();
  return data.edited_content;
};

// ── Existing functions (unchanged) ───────────────────────────────────────────

/**
 * Generate content using backend API (single platform, legacy)
 */
export const generateContent = async (brandVoice: string, contentRequest: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/factory/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_voice: brandVoice, content_request: contentRequest } as GenerateContentRequest),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate content');
    }
    const data = await response.json();
    return data.generated_content;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to generate content from AI');
  }
};

/**
 * Analyze brand voice using backend API
 */
export interface BrandDNA {
  brand_name: string;
  primary_hex: string;
  typography: string[];
  voice_personality: string;
  banned_concepts: string[];
}

export const fetchBrandDNA = async (companyIdentifier: string): Promise<BrandDNA> => {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/discovery?url=${encodeURIComponent(companyIdentifier)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch brand DNA');
    }
    const data = await response.json();
    const dna = data.data as BrandDNA;
    return dna;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch brand DNA');
  }
};

  try {
    const response = await fetch(`${API_BASE_URL}/v1/discovery?url=${encodeURIComponent(companyIdentifier)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to analyze brand voice');
    }
    const data = await response.json();
    // Return voice_profile string from the saved DNA
    const dna = data.data;
    if (dna && dna.voice_profile) return dna.voice_profile;
    if (dna && dna.brand_voice) return dna.brand_voice;
    return JSON.stringify(dna, null, 2);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to analyze brand voice');
  }
};

/**
 * Audit content against brand voice using backend API
 */
export const auditContent = async (brandVoice: string, contentToAudit: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auditor/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_voice: brandVoice, content_to_audit: contentToAudit } as AuditContentRequest),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to audit content');
    }
    const data = await response.json();
    return data.audit_report;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to audit content');
  }
};

/**
 * Health check for backend API
 */
export const generateImage = async (brandColors: string[], contentSummary: string, platform: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/imagen/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_colors: brandColors, content_summary: contentSummary, platform } as any),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate image');
    }
    const data = await response.json();
    // Return a data URL for easy use in img src
    return `data:image/png;base64,${data.image_base64}`;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to generate image');
  }
};

  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
};
