/**
 * AuthenticityScore.tsx — Visual voice authenticity score card.
 *
 * Shows 4 dimension bars + overall score + improvement hints.
 * Calls POST /v1/score on draft/voice change (debounced 800ms).
 */
import React, { useEffect, useRef, useState } from 'react';

interface ScoreData {
  tone_match: number;
  vocabulary_match: number;
  structure_match: number;
  authenticity: number;
  overall: number;
  confidence_band: number;
  hints: string[];
}

interface Props {
  draft: string;
  voicePersonality: string;
  apiUrl: string;
  authToken: string;
  platform?: string;
}

const DIMS = [
  { key: 'tone_match', label: 'Tone' },
  { key: 'vocabulary_match', label: 'Vocabulary' },
  { key: 'structure_match', label: 'Structure' },
  { key: 'authenticity', label: 'Authenticity' },
] as const;

function scoreColor(s: number): string {
  if (s >= 85) return '#EAFF00';
  if (s >= 65) return '#00F0FF';
  return '#FF4A4A';
}

const AuthenticityScore: React.FC<Props> = ({ draft, voicePersonality, apiUrl, authToken, platform }) => {
  const [score, setScore] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!draft || !voicePersonality || draft.length < 50) {
      setScore(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiUrl}/v1/score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ draft, voice_personality: voicePersonality, platform }),
        });
        if (res.ok) {
          setScore(await res.json());
        }
      } catch (err) {
        // Non-fatal: score is optional UX
      } finally {
        setLoading(false);
      }
    }, 800);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [draft, voicePersonality, platform]);

  if (!draft || draft.length < 50) return null;

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.12)',
      padding: '16px 18px',
      marginTop: 12,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
          Voice Match
        </p>
        {loading && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Scoring…</span>
        )}
        {score && !loading && (
          <span style={{ fontSize: 22, fontWeight: 900, color: scoreColor(score.overall) }}>
            {score.overall}
            <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>/ 100</span>
          </span>
        )}
      </div>

      {score && !loading && (
        <>
          {DIMS.map(({ key, label }) => {
            const val = score[key];
            return (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  <span style={{ fontSize: 11, color: scoreColor(val), fontWeight: 600 }}>{val}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', height: 3, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    width: `${val}%`, height: '100%',
                    background: scoreColor(val),
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            );
          })}

          {score.hints.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {score.hints.map((hint, i) => (
                <p key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px', lineHeight: 1.5 }}>
                  → {hint}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuthenticityScore;
