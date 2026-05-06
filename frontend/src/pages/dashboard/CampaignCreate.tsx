import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthenticityScore from '../../components/campaign/AuthenticityScore';
import PublishModal from '../../components/campaign/PublishModal';

interface LocationState {
  promptId?: string;
  promptText?: string;
}

const CampaignCreate: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const token = session?.access_token || '';

  const [tab, setTab] = useState<'brief' | 'drafts' | 'publish'>('brief');
  const [brief, setBrief] = useState(state.promptText || '');
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [campaignId, setCampaignId] = useState<string>('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [voicePersonality, setVoicePersonality] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter', 'linkedin']);

  // Fetch stored voice personality from brand_dna table
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/v1/onboarding/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.voice_personality) setVoicePersonality(data.voice_personality);
        }
      } catch {
        // best-effort, voice score just won't show
      }
    };
    if (token) load();
  }, [token]);

  const generate = async () => {
    if (!brief.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/campaign/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content_request: brief,
          platforms: selectedPlatforms,
          // brand_voice is optional — backend uses stored brand DNA if omitted
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // /v1/campaign/launch returns { results: { twitter: '...', linkedin: '...' }, success: bool }
        setDrafts(data.results || {});
        setCampaignId(data.campaign_id || '');
        setTab('drafts');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Generation failed: ${err.detail || res.status}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const TABS = ['brief', 'drafts', 'publish'] as const;
  const tabLabels: Record<string, string> = { brief: '1. Brief', drafts: '2. Drafts', publish: '3. Publish' };

  return (
    <div style={{ padding: '40px 32px', maxWidth: 860, margin: '0 auto' }}>
      <p style={{ color: '#EAFF00', fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 8px' }}>
        Campaign Planner
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: '0 0 32px', color: '#fff' }}>
        Create Content
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 32 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', padding: '10px 20px',
              color: tab === t ? '#EAFF00' : 'rgba(255,255,255,0.35)',
              fontWeight: tab === t ? 700 : 400,
              cursor: 'pointer', fontSize: 12, letterSpacing: '0.1em',
              textTransform: 'uppercase', fontFamily: 'inherit',
              borderBottom: tab === t ? '2px solid #EAFF00' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Brief tab */}
      {tab === 'brief' && (
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            What's happening? What do you want to share?
          </label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder="We just hit 1,000 users. Here's what I learned about founder-led growth…"
            rows={6}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
              padding: '14px 16px', fontSize: 14, lineHeight: 1.6,
              fontFamily: 'inherit', resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />

          {/* Platform toggles */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, marginBottom: 24 }}>
            {['twitter', 'linkedin', 'newsletter'].map(p => (
              <button
                key={p}
                onClick={() => setSelectedPlatforms(sp => sp.includes(p) ? sp.filter(x => x !== p) : [...sp, p])}
                style={{
                  border: `1px solid ${selectedPlatforms.includes(p) ? '#EAFF00' : 'rgba(255,255,255,0.15)'}`,
                  background: selectedPlatforms.includes(p) ? 'rgba(234,255,0,0.1)' : 'transparent',
                  color: selectedPlatforms.includes(p) ? '#EAFF00' : 'rgba(255,255,255,0.4)',
                  padding: '6px 14px', cursor: 'pointer',
                  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'inherit',
                }}
              >
                {p === 'twitter' ? 'X' : p === 'linkedin' ? 'LinkedIn' : 'Email'}
              </button>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={loading || !brief.trim()}
            style={{
              background: loading || !brief.trim() ? 'rgba(234,255,0,0.3)' : '#EAFF00',
              color: '#000', border: 'none', padding: '14px 28px',
              fontWeight: 900, cursor: loading || !brief.trim() ? 'not-allowed' : 'pointer',
              fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'inherit',
            }}
          >
            {loading ? 'Generating…' : 'Generate Drafts →'}
          </button>
        </div>
      )}

      {/* Drafts tab */}
      {tab === 'drafts' && (
        <div>
          {Object.keys(drafts).length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>No drafts yet. Complete the Brief tab first.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.entries(drafts).map(([platform, content]) => (
                <div key={platform}>
                  <p style={{ color: '#EAFF00', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                    {platform === 'twitter' ? 'X (Twitter)' : platform}
                  </p>
                  <textarea
                    value={typeof content === 'string' ? content : (content as any)?.content || ''}
                    onChange={e => setDrafts(d => ({ ...d, [platform]: e.target.value }))}
                    rows={platform === 'linkedin' ? 8 : 4}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
                      padding: '14px 16px', fontSize: 13, lineHeight: 1.6,
                      fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                  {voicePersonality && (
                    <AuthenticityScore
                      draft={typeof content === 'string' ? content : ''}
                      voicePersonality={voicePersonality}
                      apiUrl={API_URL}
                      authToken={token}
                      platform={platform}
                    />
                  )}
                </div>
              ))}

              <button
                onClick={() => setTab('publish')}
                style={{
                  background: '#EAFF00', color: '#000', border: 'none',
                  padding: '12px 24px', fontWeight: 900, cursor: 'pointer',
                  fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'inherit',
                  alignSelf: 'flex-start',
                }}
              >
                Review &amp; Publish →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Publish tab */}
      {tab === 'publish' && (
        <div>
          {Object.keys(drafts).length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>Generate drafts first.</p>
          ) : (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 24 }}>
                Ready to publish? Review your drafts, then click below.
              </p>
              <button
                onClick={() => setShowPublishModal(true)}
                style={{
                  background: '#EAFF00', color: '#000', border: 'none',
                  padding: '14px 28px', fontWeight: 900, cursor: 'pointer',
                  fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'inherit',
                }}
              >
                Publish Now →
              </button>
            </div>
          )}
        </div>
      )}

      {showPublishModal && (
        <PublishModal
          campaignId={campaignId}
          drafts={Object.fromEntries(
            Object.entries(drafts).map(([p, c]) => [p, typeof c === 'string' ? c : (c as any)?.content || ''])
          )}
          apiUrl={API_URL}
          authToken={token}
          onClose={() => setShowPublishModal(false)}
          onPublished={() => navigate('/dashboard/published')}
        />
      )}
    </div>
  );
};

export default CampaignCreate;
