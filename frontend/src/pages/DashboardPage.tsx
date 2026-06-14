/**
 * DashboardPage — "Generate your distribution."
 *
 * Upgraded to use SSE streaming (/v1/engine/autopilot/stream):
 *   - Post content types out word-by-word (no blank waiting screen)
 *   - Signal metadata (hook, audience, tone) appears as soon as extraction completes
 *   - DistributeModal fires when post is ready for one-click multi-channel blast
 *
 * States:
 *   loading      — minimal spinner while signal extracts
 *   streaming    — post types out live, signal metadata visible
 *   signal       — needs more detail (followup question)
 *   result       — editable post + Distribute button
 *   error        — retry / start over
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DistributeModal from '../components/DistributeModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouterState {
  card_type: 'happened' | 'clicked' | 'hard';
  raw_input: string;
}

interface SignalMeta {
  hook: string;
  audience: string;
  register: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8080';

const CARD_LABELS: Record<string, string> = {
  happened: 'What changed',
  clicked: 'Core belief',
  hard: 'What went wrong',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fallback: non-streaming call for environments that block SSE */
async function callAutopilotFallback(
  raw_input: string,
  card_type: string,
  authToken: string,
) {
  const response = await fetch(`${API_BASE_URL}/v1/engine/autopilot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ raw_input, card_type }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.detail || 'Generation failed. Try again.');
  }
  return body;
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const authToken = session?.access_token ?? '';

  const state = location.state as RouterState | null;

  const [phase, setPhase] = useState<'loading' | 'streaming' | 'signal' | 'result' | 'error'>('loading');
  const [signalMeta, setSignalMeta] = useState<SignalMeta | null>(null);
  const [postText, setPostText] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [generationId, setGenerationId] = useState('');
  const [authenticityScore, setAuthenticityScore] = useState(80);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [followupQuestion, setFollowupQuestion] = useState('');
  const [followupAnswer, setFollowupAnswer] = useState('');
  const [isFollowupLoading, setIsFollowupLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDistributeModal, setShowDistributeModal] = useState(false);

  const rawInputRef = useRef<string>(state?.raw_input ?? '');
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (rawInput: string) => {
    if (!state?.card_type || !authToken) return;
    setPhase('loading');
    setErrorMsg(null);
    setStreamingText('');
    setPostText('');
    setSignalMeta(null);

    // Abort any previous stream
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/v1/engine/autopilot/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ raw_input: rawInput, card_type: state.card_type }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('Stream failed — falling back to standard generation.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullPost = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          try {
            const event = JSON.parse(raw);

            if (event.type === 'signal') {
              setSignalMeta({ hook: event.hook, audience: event.audience, register: event.register });
              setPhase('streaming');
            } else if (event.type === 'token') {
              fullPost += event.token;
              setStreamingText(fullPost);
            } else if (event.type === 'done') {
              setGenerationId(event.generation_id || '');
              setAuthenticityScore(event.authenticity_score || 80);
              setPostText(fullPost);
              setPhase('result');
            } else if (event.type === 'needs_signal') {
              setFollowupQuestion(event.question);
              setPhase('signal');
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            // non-JSON SSE comment, skip
          }
        }
      }
    } catch (streamErr: unknown) {
      if ((streamErr as Error).name === 'AbortError') return;

      // Graceful fallback: try the non-streaming endpoint
      try {
        const res = await callAutopilotFallback(rawInput, state.card_type, authToken);
        if (res.needs_more_signal) {
          setFollowupQuestion(res.single_followup_question || 'Can you add one more specific detail?');
          setPhase('signal');
        } else {
          setSignalMeta({ hook: res.hook_used, audience: res.inferred_audience, register: res.emotional_register });
          setPostText(res.generated_post);
          setGenerationId(res.generation_id || '');
          setAuthenticityScore(res.authenticity_score || 80);
          setPhase('result');
        }
      } catch (fallbackErr) {
        setErrorMsg(fallbackErr instanceof Error ? fallbackErr.message : 'Something went wrong.');
        setPhase('error');
      }
    }
  }, [authToken, state?.card_type]);

  useEffect(() => {
    if (!state?.raw_input || !state?.card_type) return;
    rawInputRef.current = state.raw_input;
    generate(state.raw_input);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFollowup = async () => {
    if (!followupAnswer.trim() || isFollowupLoading) return;
    const augmented = `${rawInputRef.current}\n${followupAnswer.trim()}`;
    rawInputRef.current = augmented;
    setIsFollowupLoading(true);
    try {
      await generate(augmented);
    } finally {
      setIsFollowupLoading(false);
      setFollowupAnswer('');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(postText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── No state — redirect prompt ─────────────────────────────────────────────

  if (!state?.raw_input || !state?.card_type) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 4 }}>⚡</div>
        <h2 style={{ marginBottom: 8 }}>Start from Signal</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 360, marginBottom: 20 }}>
          Pick a signal that matches your week, type one raw thought, and BrandMeld distributes it everywhere.
        </p>
        <button id="plan-go-to-discover" className="btn btn-primary" onClick={() => navigate('/discover')}>
          Go to Signal →
        </button>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 24 }}>
        <div style={{ maxWidth: 520, width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
          <div className="label" style={{ marginBottom: 6 }}>Your signal</div>
          <div style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>"{state.raw_input}"</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 18, height: 18, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Extracting signal…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <p style={{ color: 'var(--red)', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '14px 20px', fontSize: 14, maxWidth: 480 }}>
          {errorMsg}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button id="plan-retry-btn" className="btn btn-primary" onClick={() => generate(rawInputRef.current)}>Try Again</button>
          <button id="plan-start-over-error" className="btn btn-ghost" onClick={() => navigate('/discover', { replace: true, state: null })}>Start Over</button>
        </div>
      </div>
    );
  }

  // ── Needs more signal ──────────────────────────────────────────────────────

  if (phase === 'signal') {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 24, maxWidth: 560, animation: 'fade-up 0.3s ease' }}>
        <div className="label" style={{ color: 'var(--amber)', letterSpacing: '0.1em' }}>✦ ONE MORE SIGNAL</div>
        <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.4, textAlign: 'center' }}>
          {followupQuestion}
        </p>
        <div style={{ width: '100%' }}>
          <input
            id="plan-followup-input"
            type="text"
            value={followupAnswer}
            onChange={e => setFollowupAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFollowup()}
            placeholder="Type your answer…"
            autoFocus
            style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-elevated)', border: '1.5px solid var(--border-hover)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '1rem', outline: 'none', marginBottom: 12, transition: 'border-color var(--transition)' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
          />
          <button
            id="plan-followup-submit"
            className="btn btn-primary"
            disabled={!followupAnswer.trim() || isFollowupLoading}
            onClick={handleFollowup}
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          >
            {isFollowupLoading ? 'Generating…' : 'Add signal and generate →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Streaming / Result ─────────────────────────────────────────────────────

  const displayText = phase === 'streaming' ? streamingText : postText;
  const isStreaming = phase === 'streaming';
  const coreContentLabel = CARD_LABELS[state.card_type] ?? 'Core content';

  return (
    <div className="page" style={{ animation: 'fade-up 0.3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 6, color: 'var(--accent-light)' }}>
          {isStreaming ? '✦ GENERATING YOUR DISTRIBUTION' : '✦ READY TO DISTRIBUTE'}
        </div>
        <h1 style={{ fontSize: '1.6rem' }}>
          {isStreaming ? 'Writing your post…' : 'Review and distribute.'}
        </h1>
      </div>

      {/* Two-column grid */}
      <div id="plan-result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>

        {/* ── Left: Signal metadata ── */}
        <div className="card" style={{ padding: 24 }}>
          <div className="label" style={{ marginBottom: 18, color: 'var(--accent-light)', fontSize: '0.7rem' }}>
            ✦ SIGNAL METADATA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>{coreContentLabel}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {CARD_LABELS[state.card_type]}
              </div>
            </div>
            {signalMeta && (
              <>
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>Audience</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>{signalMeta.audience}</div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>Opening hook</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: 'italic', borderLeft: '2px solid var(--accent)', paddingLeft: 12 }}>
                    "{signalMeta.hook}"
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Voice match</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${authenticityScore}%`, background: authenticityScore >= 80 ? 'var(--green)' : authenticityScore >= 60 ? 'var(--amber)' : 'var(--red)', borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: authenticityScore >= 80 ? 'var(--green)' : authenticityScore >= 60 ? 'var(--amber)' : 'var(--red)', minWidth: 44 }}>
                      {authenticityScore}/100
                    </span>
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Tone</div>
                  <span className="badge badge-indigo" style={{ textTransform: 'capitalize', fontSize: 12 }}>{signalMeta.register}</span>
                </div>
              </>
            )}
            {!signalMeta && isStreaming && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Extracting signal…</div>
            )}
          </div>
        </div>

        {/* ── Right: Streaming / editable post ── */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="label" style={{ color: 'var(--blue)', fontSize: '0.7rem' }}>
            ✦ YOUR LINKEDIN POST {isStreaming && <span style={{ color: 'var(--accent)', animation: 'pulse 1s infinite' }}>●</span>}
          </div>

          <textarea
            id="plan-post-textarea"
            value={displayText}
            onChange={e => !isStreaming && setPostText(e.target.value)}
            readOnly={isStreaming}
            rows={16}
            style={{
              width: '100%',
              background: 'var(--bg-elevated)',
              border: `1px solid ${isStreaming ? 'var(--accent-dim)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              lineHeight: 1.7,
              padding: '14px 16px',
              outline: 'none',
              resize: isStreaming ? 'none' : 'vertical',
              transition: 'border-color var(--transition)',
              cursor: isStreaming ? 'default' : 'text',
            }}
            onFocus={e => !isStreaming && (e.currentTarget.style.borderColor = 'var(--blue)')}
            onBlur={e => (e.currentTarget.style.borderColor = isStreaming ? 'var(--accent-dim)' : 'var(--border)')}
          />

          {/* Streaming cursor */}
          {isStreaming && (
            <div style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite' }} />
              Generating…
            </div>
          )}

          {/* Action buttons — only show when done */}
          {phase === 'result' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                id="plan-distribute-btn"
                className="btn btn-primary"
                onClick={() => setShowDistributeModal(true)}
                style={{ flex: 1, justifyContent: 'center', background: 'var(--accent)', border: 'none' }}
              >
                ⚡ Distribute Now
              </button>
              <button
                id="plan-copy-btn"
                className="btn btn-ghost"
                onClick={handleCopy}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button
                id="plan-start-over-btn"
                className="btn btn-ghost"
                onClick={() => navigate('/discover', { replace: true, state: null })}
              >
                ↩ Start over
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Responsive two-column CSS */}
      <style>{`
        @media (min-width: 800px) {
          #plan-result-grid { grid-template-columns: 320px 1fr !important; }
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin   { to { transform: rotate(360deg); } }
      `}</style>

      {/* Distribute Modal */}
      {showDistributeModal && (
        <DistributeModal
          postText={postText}
          generationId={generationId}
          authToken={authToken}
          onClose={() => setShowDistributeModal(false)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
