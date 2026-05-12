import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface VoiceCard {
  id: string;
  creator_name: string;
  creator_bio?: string;
  creator_avatar_url?: string;
  category: string;
  voice_snippet: string;
  fork_count: number;
  rating: number;
}

const CATEGORIES = ['All', 'founder', 'creator', 'executive', 'indie_hacker'];

const VoiceMarketplace: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const token = session?.access_token || '';

  const [voices, setVoices] = useState<VoiceCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<'trending' | 'top_rated' | 'newest'>('trending');
  const [forking, setForking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (category !== 'All') params.set('category', category);
      const res = await fetch(`${API_URL}/v1/marketplace/voices?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVoices(data.voices || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [category, sort]);

  const fork = async (voiceId: string) => {
    setForking(voiceId);
    try {
      const res = await fetch(`${API_URL}/v1/marketplace/voices/${voiceId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        navigate('/dashboard/create');
      }
    } finally {
      setForking(null);
    }
  };

  const ACCENT_COLORS = ['#EAFF00', '#00F0FF', '#9F7AEA', '#F97316', '#EC4899', '#14B8A6'];

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <p style={{ color: '#EAFF00', fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', margin: '0 0 8px' }}>
        Voice Marketplace
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: '0 0 8px', color: '#fff' }}>
        Fork a Founder's Voice
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 32px' }}>
        Select a voice that resonates. Fork it into your Brand DNA, then generate content that sounds like them—with your story.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                border: `1px solid ${category === cat ? '#EAFF00' : 'rgba(255,255,255,0.15)'}`,
                background: category === cat ? 'rgba(234,255,0,0.1)' : 'transparent',
                color: category === cat ? '#EAFF00' : 'rgba(255,255,255,0.4)',
                padding: '6px 14px', cursor: 'pointer',
                fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'inherit',
              }}
            >
              {cat === 'All' ? 'All' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as any)}
          style={{
            background: '#111', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', padding: '6px 12px', fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="trending">Trending</option>
          <option value="top_rated">Top Rated</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading voices…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {voices.map((voice, i) => {
            const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
            return (
              <div
                key={voice.id}
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: `${accent}22`,
                    border: `2px solid ${accent}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 900, color: accent, flexShrink: 0,
                  }}>
                    {voice.creator_avatar_url
                      ? <img src={voice.creator_avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : voice.creator_name.charAt(0)
                    }
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>{voice.creator_name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {voice.category.replace('_', ' ')}
                    </p>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      ★ {voice.rating.toFixed(1)}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                      {voice.fork_count} forks
                    </p>
                  </div>
                </div>

                {/* Bio */}
                {voice.creator_bio && (
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                    {voice.creator_bio}
                  </p>
                )}

                {/* Voice snippet */}
                <p style={{
                  margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.5, fontStyle: 'italic',
                  borderLeft: `2px solid ${accent}`,
                  paddingLeft: 10,
                }}>
                  "{voice.voice_snippet.slice(0, 120)}…"
                </p>

                {/* Fork button */}
                <button
                  onClick={() => fork(voice.id)}
                  disabled={forking === voice.id}
                  style={{
                    background: accent, color: '#000', border: 'none',
                    padding: '10px 0', fontWeight: 900, cursor: 'pointer',
                    fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
                    fontFamily: 'inherit', marginTop: 'auto',
                    opacity: forking === voice.id ? 0.6 : 1,
                  }}
                >
                  {forking === voice.id ? 'Forking…' : '⑂ Fork This Voice'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && voices.length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.3)' }}>No voices found. Check back soon.</p>
      )}
    </div>
  );
};

export default VoiceMarketplace;
