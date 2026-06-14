/**
 * DiscoverPage — Three-door entry point.
 *
 * The founder picks which kind of week they had, types one raw thought,
 * and BrandMeld does everything else. No form fields. No platform picker.
 * No tone selector. The three cards are the only decision.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DistributionStats from '../components/DistributionStats';

// ── Card definitions ──────────────────────────────────────────────────────────

type CardType = 'happened' | 'clicked' | 'hard';

interface CardDef {
  id: CardType;
  label: string;
  subtitle: string;
  placeholder: string;
  accentColor: string;
  accentDim: string;
  icon: string;
}

const CARDS: CardDef[] = [
  {
    id: 'happened',
    label: 'Something happened.',
    subtitle: 'A launch, a milestone, a number, a ship.',
    placeholder: 'What shipped or changed this week.',
    accentColor: 'var(--accent)',
    accentDim: 'var(--accent-dim)',
    icon: '⚡',
  },
  {
    id: 'clicked',
    label: 'Something clicked.',
    subtitle: 'A lesson, a take, a realization, an opinion.',
    placeholder: 'What did you understand differently, or what do you believe that most people in your space would disagree with.',
    accentColor: 'var(--blue)',
    accentDim: 'var(--blue-dim)',
    icon: '💡',
  },
  {
    id: 'hard',
    label: 'Something was hard.',
    subtitle: 'A setback, a surprise, a pivot, an honest moment.',
    placeholder: 'What did not go the way you expected.',
    accentColor: 'var(--green)',
    accentDim: 'rgba(16,185,129,0.08)',
    icon: '🔥',
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────

const DiscoverPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [hasBrandDna, setHasBrandDna] = useState<boolean | null>(null);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const token = session?.access_token;
      if (!token) return;
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
        const res = await fetch(`${API_URL}/v1/onboarding/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const status = await res.json();
          setHasBrandDna(!!status.has_brand_dna);
        }
      } catch (e) {
        console.error('[DiscoverPage] Failed to load onboarding status:', e);
      }
    };
    checkStatus();
  }, [session]);
  const [inputs, setInputs] = useState<Record<CardType, string>>({
    happened: '',
    clicked: '',
    hard: '',
  });
  const inputRefs = useRef<Record<CardType, HTMLInputElement | null>>({
    happened: null,
    clicked: null,
    hard: null,
  });

  const activeInput = activeCard ? inputs[activeCard] : '';
  const canGenerate = activeCard !== null && activeInput.trim().length >= 15;

  const handleCardSelect = (id: CardType) => {
    setActiveCard(id);
    // Focus the input after the card expands (next tick)
    setTimeout(() => {
      inputRefs.current[id]?.focus();
    }, 50);
  };

  const handleInputChange = (id: CardType, value: string) => {
    setInputs((prev) => ({ ...prev, [id]: value }));
  };

  const handleGenerate = () => {
    if (!activeCard || !canGenerate) return;
    navigate('/plan', {
      state: {
        card_type: activeCard,
        raw_input: inputs[activeCard].trim(),
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canGenerate) {
      handleGenerate();
    }
  };

  return (
    <div className="page" style={{ maxWidth: 760, paddingTop: 48 }}>
      {/* Distribution Stats strip — visible after first distribution */}
      <DistributionStats />
      {hasBrandDna === false && (
        <div
          style={{
            background: 'var(--amber-dim, rgba(245,158,11,0.06))',
            border: '1.5px solid var(--amber, #F59E0B)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: 32,
            fontSize: 13.5,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            animation: 'fade-in 0.3s ease',
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>💡</span>
          <div>
            <strong style={{ color: 'var(--amber, #F59E0B)' }}>Autopilot is using a default voice.</strong>
            <div style={{ marginTop: 2, color: 'var(--text-secondary)' }}>
              Since BrandMeld is built to market your brand according to its authentic identity, please{' '}
              <a
                href="/onboarding"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/onboarding');
                }}
                style={{
                  color: 'var(--accent-light, #818CF8)',
                  textDecoration: 'underline',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                scan your website now
              </a>{' '}
              to build your custom Brand DNA voice profile.
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div
          className="label"
          style={{ marginBottom: 10, color: 'var(--accent-light)', letterSpacing: '0.12em' }}
        >
          ✦ YOUR WEEKLY DISTRIBUTION SIGNAL
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: 10, letterSpacing: '-0.04em' }}>
          What happened this week?
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
          Pick a signal. Type one raw thought. BrandMeld turns it into a multi-channel distribution event.
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          marginBottom: 28,
        }}
      >
        {CARDS.map((card) => {
          const isActive = activeCard === card.id;
          const hasInput = inputs[card.id].trim().length > 0;

          return (
            <div
              key={card.id}
              id={`discover-card-${card.id}`}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onClick={() => handleCardSelect(card.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardSelect(card.id);
                }
              }}
              style={{
                background: isActive ? card.accentDim : 'var(--bg-surface)',
                border: `1.5px solid ${isActive ? card.accentColor : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '22px 26px',
                cursor: 'pointer',
                transition: 'all var(--transition-slow)',
                outline: 'none',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLDivElement).style.borderColor = card.accentColor;
                  (e.currentTarget as HTMLDivElement).style.background = card.accentDim;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface)';
                }
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: isActive ? 18 : 6,
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    lineHeight: 1,
                    filter: isActive ? 'none' : 'grayscale(60%)',
                    transition: 'filter var(--transition)',
                  }}
                >
                  {card.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 15.5,
                      fontWeight: 700,
                      color: isActive ? card.accentColor : 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                      transition: 'color var(--transition)',
                      marginBottom: 2,
                    }}
                  >
                    {card.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {card.subtitle}
                  </div>
                </div>
                {!isActive && hasInput && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: card.accentColor,
                      flexShrink: 0,
                    }}
                  />
                )}
                {isActive && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: card.accentColor,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Selected
                  </span>
                )}
              </div>

              {/* Expandable input — only shown when this card is active */}
              {isActive && (
                <div
                  style={{ animation: 'fade-up 0.2s ease forwards' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={(el) => { inputRefs.current[card.id] = el; }}
                    id={`discover-input-${card.id}`}
                    type="text"
                    value={inputs[card.id]}
                    onChange={(e) => handleInputChange(card.id, e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={card.placeholder}
                    maxLength={1000}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      background: 'var(--bg-base)',
                      border: `1px solid ${card.accentColor}`,
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      fontSize: '0.9375rem',
                      outline: 'none',
                      transition: 'border-color var(--transition)',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = card.accentColor;
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${card.accentDim}`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color:
                        inputs[card.id].trim().length >= 15
                          ? card.accentColor
                          : 'var(--text-muted)',
                      transition: 'color var(--transition)',
                    }}
                  >
                    {inputs[card.id].trim().length >= 15
                      ? '✓ Ready to generate'
                      : `${Math.max(0, 15 - inputs[card.id].trim().length)} more character${
                          15 - inputs[card.id].trim().length === 1 ? '' : 's'
                        } to unlock`}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Generate button — appears only when ≥15 chars in active input */}
      {canGenerate && (
        <div
          style={{
            animation: 'fade-up 0.25s ease forwards',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            id="discover-generate-btn"
            onClick={handleGenerate}
            className="btn btn-primary btn-lg"
            style={{
              padding: '13px 36px',
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 0 24px rgba(99,102,241,0.35)',
              cursor: 'pointer',
              transition: 'all var(--transition)',
              width: '100%',
              maxWidth: 400,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 36px rgba(99,102,241,0.5)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px rgba(99,102,241,0.35)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            Generate Distribution →
          </button>
        </div>
      )}
    </div>
  );
};

export default DiscoverPage;
