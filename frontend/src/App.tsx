/**
 * App.tsx — BrandMeld AI Growth OS Router
 *
 * Route structure:
 *  /                  → LandingPage (public)
 *  /onboarding        → OnboardingWizard (protected, no AppLayout)
 *  /dashboard         → AI Command Center
 *  /content           → Content Studio
 *  /campaigns         → Campaign Manager
 *  /seo               → SEO Intelligence
 *  /analytics         → Analytics Dashboard
 *  /competitors       → Competitor Radar
 *  /ai-studio         → AI Studio
 *  /automations       → Automations
 *  /settings          → Settings
 */
import React, { Suspense, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './layout/AppLayout';
import ProtectedRoute from './layout/ProtectedRoute';
import AuthModal from './components/AuthModal';
import LandingPage from './pages/LandingPage';

// Lazy pages
const Dashboard        = React.lazy(() => import('./pages/Dashboard'));
const Content          = React.lazy(() => import('./pages/Content'));
const Analytics        = React.lazy(() => import('./pages/Analytics'));
const OnboardingWizard = React.lazy(() => import('./pages/onboarding/OnboardingWizard'));
const SEOPage          = React.lazy(() => import('./pages/StubPages').then(m => ({ default: m.SEOPage })));
const CompetitorsPage  = React.lazy(() => import('./pages/StubPages').then(m => ({ default: m.CompetitorsPage })));
const AIStudioPage     = React.lazy(() => import('./pages/StubPages').then(m => ({ default: m.AIStudioPage })));
const AutomationsPage  = React.lazy(() => import('./pages/StubPages').then(m => ({ default: m.AutomationsPage })));
const CampaignsPage    = React.lazy(() => import('./pages/StubPages').then(m => ({ default: m.CampaignsPage })));
const SettingsPage     = React.lazy(() => import('./pages/SettingsPage'));

const PageLoader: React.FC = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: 'var(--bg-base)', color: 'var(--accent)',
    fontFamily: "'Inter', sans-serif", fontSize: 13, letterSpacing: '0.05em',
    gap: 10,
  }}>
    <div style={{ width: 14, height: 14, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    Loading…
  </div>
);

const App: React.FC = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage onLoginClick={() => setShowAuthModal(true)} />} />

            {/* Onboarding — protected, no chrome */}
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<OnboardingWizard />} />
            </Route>

            {/* Protected app shell */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard"   element={<Dashboard />} />
                <Route path="/content"     element={<Content />} />
                <Route path="/campaigns"   element={<CampaignsPage />} />
                <Route path="/seo"         element={<SEOPage />} />
                <Route path="/analytics"   element={<Analytics />} />
                <Route path="/competitors" element={<CompetitorsPage />} />
                <Route path="/ai-studio"   element={<AIStudioPage />} />
                <Route path="/automations" element={<AutomationsPage />} />
                <Route path="/settings"    element={<SettingsPage />} />

                {/* Legacy redirects */}
                <Route path="/dashboard/home"   element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard/create" element={<Navigate to="/content" replace />} />
                <Route path="/dashboard/*"      element={<Navigate to="/dashboard" replace />} />
                <Route path="/history"          element={<Navigate to="/dashboard" replace />} />
                <Route path="/create"           element={<Navigate to="/content" replace />} />
                <Route path="/marketplace/*"    element={<Navigate to="/ai-studio" replace />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
