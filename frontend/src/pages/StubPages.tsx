import React from 'react';
import { useNavigate } from 'react-router-dom';

interface StubProps { title: string; icon: string; description: string; cta?: string; ctaTo?: string; }

const Stub: React.FC<StubProps> = ({ title, icon, description, cta, ctaTo }) => {
  const navigate = useNavigate();
  return (
    <div className="page">
      <div className="label" style={{ marginBottom: 8 }}>Coming Soon</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, paddingTop: 40 }}>
        <div style={{ fontSize: 48, lineHeight: 1 }}>{icon}</div>
        <h1>{title}</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 440, lineHeight: 1.7 }}>{description}</p>
        {cta && ctaTo && (
          <button onClick={() => navigate(ctaTo)} className="btn btn-primary btn-lg" style={{ marginTop: 8 }}>{cta} →</button>
        )}
      </div>
    </div>
  );
};

export const SEOPage: React.FC = () => (
  <Stub title="SEO Intelligence" icon="◎" description="AI-powered keyword tracking, content gap analysis, and competitor rankings. Automatically surfaces opportunities to drive organic traffic." cta="Go to Analytics" ctaTo="/analytics" />
);
export const CompetitorsPage: React.FC = () => (
  <Stub title="Competitor Radar" icon="◇" description="Monitor what your competitors are publishing, which content is working for them, and where they're weak — all updated automatically." cta="View Analytics" ctaTo="/analytics" />
);
export const AIStudioPage: React.FC = () => (
  <Stub title="AI Studio" icon="∿" description="Advanced AI generation: custom ad creatives, landing page copy, email sequences, and A/B variants. Powered by your brand intelligence." cta="Create Content" ctaTo="/content" />
);
export const AutomationsPage: React.FC = () => (
  <Stub title="Automations" icon="⟳" description="Set up growth workflows that run autonomously: weekly content generation, SEO monitoring alerts, competitor tracking, and publishing schedules." cta="Create Content" ctaTo="/content" />
);
export const CampaignsPage: React.FC = () => (
  <Stub title="Campaign Manager" icon="◈" description="Manage all your content campaigns in one place. Track drafts, scheduled posts, and published content across every platform." cta="Create Content" ctaTo="/content" />
);
