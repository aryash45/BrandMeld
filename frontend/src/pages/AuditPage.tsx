
import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auditContent } from '../services/apiService';
import GenerateButton from '../components/GenerateButton';
import OutputDisplay from '../components/OutputDisplay';
import TextInput from '../components/TextInput';

const AuditPage: React.FC = () => {
  const { session } = useAuth();
  const authToken = session?.access_token;

  const [brandVoice, setBrandVoice] = useState('');
  const [contentToAudit, setContentToAudit] = useState('');
  const [auditResult, setAuditResult] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const isAuditDisabled = !brandVoice.trim() || !contentToAudit.trim();

  const handleAudit = useCallback(async () => {
    if (isAuditDisabled) return;

    setIsAuditing(true);
    setAuditError(null);
    setAuditResult('');

    try {
      const result = await auditContent(brandVoice, contentToAudit, authToken);
      setAuditResult(result);
    } catch (err) {
      setAuditError(
        err instanceof Error ? err.message : 'An unknown error occurred.',
      );
    } finally {
      setIsAuditing(false);
    }
  }, [brandVoice, contentToAudit, authToken, isAuditDisabled]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 animate-fade-in">
        <p className="neon-kicker">Voice Auditor</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-white">
          Voice alignment check
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Paste the reference voice and the draft you want to inspect. BrandMeld will score the
          fit and call out where the copy drifts into generic AI tone.
        </p>
      </div>

      <div className="auditor-layout mt-6 animate-fade-in">
        {/* Input panel */}
        <section className="neon-panel px-5 py-5 sm:px-7 sm:py-6">
          <div className="rounded-[24px] border border-white/5 bg-slate-950/30 px-5 py-5">
            <p className="neon-kicker">Audit Intake</p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-white">
              Reference + draft
            </h2>
          </div>

          <div className="mt-6 space-y-6">
            <TextInput
              id="audit_brand_voice_input"
              label="Reference Voice"
              placeholder="e.g., Direct, no fluff, contrarian. I use simple words and avoid emojis."
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              rows={6}
              disabled={isAuditing}
            />

            <TextInput
              id="content_to_audit_input"
              label="Draft To Audit"
              placeholder="Paste the LinkedIn post or X thread you want to check..."
              value={contentToAudit}
              onChange={(e) => setContentToAudit(e.target.value)}
              rows={10}
              disabled={isAuditing}
            />

            <GenerateButton
              onClick={handleAudit}
              isLoading={isAuditing}
              disabled={isAuditDisabled}
            >
              Audit Content
            </GenerateButton>
          </div>
        </section>

        {/* Output panel */}
        <section className="output-stack">
          <div className="neon-panel px-5 py-5 sm:px-6">
            <p className="neon-kicker">Report Stream</p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-white">
              Alignment report
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Review fit, tone drift, and suggested rewrites without leaving the dashboard.
            </p>
          </div>

          <OutputDisplay
            isLoading={isAuditing}
            error={auditError}
            content={auditResult}
            onRetry={handleAudit}
            title="Audit Report"
          />
        </section>
      </div>
    </div>
  );
};

export default AuditPage;
