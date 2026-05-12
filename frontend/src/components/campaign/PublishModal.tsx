/**
 * PublishModal.tsx — Multi-platform publishing modal.
 *
 * Platform behaviour:
 *   LinkedIn → API post (requires connected account)
 *   Twitter  → Opens twitter.com/intent/tweet in new tab
 *   Email    → Phase 3 stub
 */
import React, { useState } from 'react';

interface Draft {
  platform: string;
  content: string;
}

interface ConnectedAccount {
  connected: boolean;
  handle?: string;
  note?: string;
}

interface Props {
  campaignId: string;
  drafts: Record<string, string>;   // { twitter: "...", linkedin: "..." }
  apiUrl: string;
  authToken: string;
  onClose: () => void;
  onPublished?: (result: Record<string, string>) => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  newsletter: 'Newsletter',
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  newsletter: '#F97316',
};

const PublishModal: React.FC<Props> = ({ campaignId, drafts, apiUrl, authToken, onClose, onPublished }) => {
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(drafts).map(p => [p, true]))
  );
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<Record<string, string> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [twitterIntentUrl, setTwitterIntentUrl] = useState<string | null>(null);

  const selectedPlatforms = Object.keys(selected).filter(p => selected[p]);

  const handlePublish = async () => {
    setPublishing(true);
    setErrors({});

    try {
      const res = await fetch(`${apiUrl}/v1/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          content: drafts,
          platforms: selectedPlatforms,
        }),
      });

      const data = await res.json();

      if (data.twitter_intent_url) {
        setTwitterIntentUrl(data.twitter_intent_url);
        window.open(data.twitter_intent_url, '_blank', 'noopener');
      }

      if (data.errors) setErrors(data.errors);
      if (data.published_post_ids) {
        setResults(data.published_post_ids);
        onPublished?.(data.published_post_ids);
      }
    } catch (err) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111', border: '1px solid rgba(255,255,255,0.15)',
          maxWidth: 520, width: '100%', padding: '28px 28px 24px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fff' }}>
            Publish Content
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Platform selection */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Select Platforms
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.keys(drafts).map(platform => (
              <label key={platform} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected[platform] ?? true}
                  onChange={e => setSelected(s => ({ ...s, [platform]: e.target.checked }))}
                  style={{ marginTop: 2, accentColor: PLATFORM_COLORS[platform] || '#EAFF00' }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{
                    margin: '0 0 4px',
                    fontSize: 13, fontWeight: 600,
                    color: PLATFORM_COLORS[platform] || '#EAFF00',
                  }}>
                    {PLATFORM_LABELS[platform] || platform}
                    {platform === 'twitter' && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>
                        Opens X Composer
                      </span>
                    )}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                    {drafts[platform]?.slice(0, 80)}…
                  </p>
                </div>
                {results?.[platform] && (
                  <span style={{ fontSize: 10, color: '#EAFF00', letterSpacing: '0.1em', textTransform: 'uppercase' }}>✓ Done</span>
                )}
                {errors[platform] && (
                  <span style={{ fontSize: 10, color: '#FF4A4A' }}>{errors[platform]}</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Twitter intent note */}
        {selectedPlatforms.includes('twitter') && !results?.twitter && (
          <div style={{ background: 'rgba(29,161,242,0.08)', border: '1px solid rgba(29,161,242,0.2)', padding: '10px 14px', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              X will open in a new tab with your draft pre-filled. Review and tweet from there.
            </p>
          </div>
        )}

        {errors.general && (
          <p style={{ color: '#FF4A4A', fontSize: 12, margin: '0 0 16px' }}>{errors.general}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {!results ? (
            <button
              onClick={handlePublish}
              disabled={publishing || selectedPlatforms.length === 0}
              style={{
                flex: 1, background: selectedPlatforms.length === 0 ? 'rgba(234,255,0,0.3)' : '#EAFF00',
                color: '#000', border: 'none', padding: '12px 0',
                fontWeight: 900, cursor: selectedPlatforms.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'inherit',
              }}
            >
              {publishing ? 'Publishing…' : `Publish (${selectedPlatforms.length})`}
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                flex: 1, background: '#EAFF00', color: '#000', border: 'none',
                padding: '12px 0', fontWeight: 900, cursor: 'pointer',
                fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'inherit',
              }}
            >
              Done ✓
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.15)',
              padding: '12px 18px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublishModal;
