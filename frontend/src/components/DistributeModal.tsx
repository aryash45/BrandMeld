/**
 * DistributeModal — "One click. All channels. Done."
 *
 * Shows after Autopilot generates a post.
 * User picks which connected channels to distribute to,
 * clicks Distribute, and sees per-channel live status.
 */
import React, { useState } from 'react';
import { useConnectedAccounts } from '../hooks/useConnectedAccounts';
import type { SocialPlatform } from '../services/apiService';

interface Props {
  postText: string;
  generationId: string;
  authToken: string;
  onClose: () => void;
}

type ChannelStatus = 'idle' | 'sending' | 'done' | 'error';

interface ChannelState {
  selected: boolean;
  status: ChannelStatus;
  message?: string;
}

const CHANNEL_META: { id: SocialPlatform | 'newsletter'; label: string; badge: string; color: string; available: boolean }[] = [
  { id: 'linkedin', label: 'LinkedIn', badge: 'in', color: '#0A66C2', available: true },
  { id: 'twitter', label: 'X / Twitter', badge: '𝕏', color: '#e2e8f0', available: true },
  { id: 'newsletter', label: 'Newsletter', badge: '✉', color: '#EAFF00', available: true },
  { id: 'instagram', label: 'Instagram', badge: 'IG', color: '#E1306C', available: false },
];

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8080';

const DistributeModal: React.FC<Props> = ({ postText, generationId, authToken, onClose }) => {
  const { accounts, connect } = useConnectedAccounts();

  const [channels, setChannels] = useState<Record<string, ChannelState>>(
    Object.fromEntries(CHANNEL_META.map(c => [c.id, { selected: c.available, status: 'idle' as ChannelStatus }]))
  );
  const [distributing, setDistributing] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const toggle = (id: string) => {
    if (distributing) return;
    setChannels(prev => ({ ...prev, [id]: { ...prev[id], selected: !prev[id].selected } }));
  };

  const setChannelStatus = (id: string, status: ChannelStatus, message?: string) => {
    setChannels(prev => ({ ...prev, [id]: { ...prev[id], status, message } }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const distribute = async () => {
    setDistributing(true);
    const selected = Object.entries(channels).filter(([, s]) => s.selected);

    await Promise.all(selected.map(async ([id]) => {
      setChannelStatus(id, 'sending');
      try {
        if (id === 'newsletter') {
          // Newsletter: copy to clipboard
          await navigator.clipboard.writeText(postText);
          setChannelStatus(id, 'done', 'Copied to clipboard');
          return;
        }
        if (id === 'twitter') {
          const first280 = postText.slice(0, 270);
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(first280)}`, '_blank');
          setChannelStatus(id, 'done', 'Opened X composer');
          return;
        }
        if (id === 'instagram') {
          setChannelStatus(id, 'error', 'Coming soon');
          return;
        }

        // LinkedIn: real API publish
        const acc = accounts[id as SocialPlatform];
        if (!acc?.connected) {
          setChannelStatus(id, 'error', 'Not connected');
          return;
        }
        const res = await fetch(`${API_URL}/v1/publish/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            platforms: [id],
            content: { [id]: postText },
            campaign_id: generationId,
          }),
        });
        if (res.ok) {
          setChannelStatus(id, 'done', 'Published ✓');
        } else {
          const err = await res.json().catch(() => ({}));
          setChannelStatus(id, 'error', err.detail || 'Publish failed');
        }
      } catch (e) {
        setChannelStatus(id, 'error', 'Network error');
      }
    }));

    setDistributing(false);
    setAllDone(true);
  };

  const anySelected = Object.values(channels).some(c => c.selected);
  const statusIcon = (status: ChannelStatus) => {
    if (status === 'sending') return <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⏳</span>;
    if (status === 'done') return <span style={{ color: '#10b981' }}>✓</span>;
    if (status === 'error') return <span style={{ color: '#ef4444' }}>✗</span>;
    return null;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)', zIndex: 100,
          animation: 'fade-in 0.2s ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 101,
        width: '100%', maxWidth: 480,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 28,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        animation: 'fade-up 0.25s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div className="label" style={{ marginBottom: 4, color: 'var(--accent-light)' }}>
              ✦ DISTRIBUTE NOW
            </div>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
              {allDone ? 'Distribution complete!' : 'Send to all channels'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
          >×</button>
        </div>

        {/* Draft preview */}
        <div style={{
          padding: '12px 14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          fontSize: 12.5,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: 20,
          maxHeight: 100,
          overflow: 'hidden',
          position: 'relative',
        }}>
          {postText.slice(0, 180)}{postText.length > 180 ? '…' : ''}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
            background: 'linear-gradient(transparent, var(--bg-elevated))',
          }} />
        </div>

        {/* Channel list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {CHANNEL_META.map(ch => {
            const state = channels[ch.id];
            const isConnected = ch.id === 'newsletter' || ch.id === 'twitter'
              ? true
              : accounts[ch.id as SocialPlatform]?.connected ?? false;

            return (
              <div
                key={ch.id}
                onClick={() => ch.available && toggle(ch.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  background: state.selected ? `${ch.color}10` : 'var(--bg-elevated)',
                  border: `1px solid ${state.selected ? `${ch.color}44` : 'var(--border)'}`,
                  borderRadius: 10,
                  cursor: ch.available ? 'pointer' : 'default',
                  opacity: ch.available ? 1 : 0.45,
                  transition: 'all 0.15s',
                  userSelect: 'none',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 18, height: 18, borderRadius: 5,
                  border: `2px solid ${state.selected ? ch.color : 'var(--border)'}`,
                  background: state.selected ? `${ch.color}22` : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s',
                }}>
                  {state.selected && <span style={{ fontSize: 10, color: ch.color }}>✓</span>}
                </div>

                {/* Icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${ch.color}18`, border: `1px solid ${ch.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, color: ch.color, fontSize: 12, flexShrink: 0,
                }}>{ch.badge}</div>

                {/* Label */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ch.label}</div>
                  {!isConnected && ch.available && ch.id !== 'newsletter' && ch.id !== 'twitter' && (
                    <button
                      onClick={e => { e.stopPropagation(); connect(ch.id as SocialPlatform); }}
                      style={{ fontSize: 11, color: ch.color, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                    >
                      Connect first →
                    </button>
                  )}
                  {state.message && (
                    <div style={{ fontSize: 11, color: state.status === 'done' ? '#10b981' : '#ef4444' }}>
                      {state.message}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div style={{ fontSize: 16, flexShrink: 0 }}>
                  {statusIcon(state.status)}
                  {state.status === 'idle' && ch.id === 'newsletter' && state.selected && (
                    <button
                      onClick={e => { e.stopPropagation(); handleCopy(postText, ch.id); }}
                      style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {copied === ch.id ? '✓ Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        {!allDone ? (
          <button
            onClick={distribute}
            disabled={distributing || !anySelected}
            style={{
              width: '100%',
              padding: '13px',
              background: distributing ? 'var(--accent-dim)' : 'var(--accent)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: distributing || !anySelected ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              transition: 'all 0.2s',
              opacity: !anySelected ? 0.5 : 1,
            }}
          >
            {distributing ? 'Distributing…' : '⚡ Distribute Now'}
          </button>
        ) : (
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '13px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10, color: '#10b981',
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ✓ Done — Close
          </button>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
};

export default DistributeModal;
