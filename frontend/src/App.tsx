/**
 * App.tsx — BrandMeld Navigation
 *
 * 5-section outcome-first navigation (IA_REDESIGN.md):
 *
 *  /                  → LandingPage (public)
 *  /onboarding        → OnboardingWizard (protected, no AppLayout)
 *
 *  /discover          → DiscoverPage   — "What should I talk about?"
 *  /plan              → DashboardPage  — "Plan your angle, approve, generate"
 *  /create            → Content        — "Write and edit drafts"
 *  /publish           → PublishPage    — "Send it now or schedule"
 *  /learn             → LearnPage      — "What worked?"
 *  /settings          → SettingsPageNew — Brand / Connections / Marketplace / Account
 *
 * Legacy redirects kept for deep links that may still exist in the wild.
 * Dead stubs (/campaigns, /seo, /competitors, /ai-studio, /automations) removed.
 */
import React, { Suspense, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './layout/AppLayout';
import ProtectedRoute from './layout/ProtectedRoute';
import AuthModal from './components/AuthModal';
import LandingPage from './pages/LandingPage';

// Lazy pages — core 5 sections
const DiscoverPage     = React.lazy(() => import('./pages/DiscoverPage'));
const DashboardPage    = React.lazy(() => import('./pages/DashboardPage'));   // /plan
const Content          = React.lazy(() => import('./pages/Content'));         // /create
const PublishPage      = React.lazy(() => import('./pages/PublishPage'));
const LearnPage        = React.lazy(() => import('./pages/LearnPage'));
const SettingsPageNew  = React.lazy(() => import('./pages/SettingsPageNew'));
const OnboardingWizard = React.lazy(() => import('./pages/onboarding/OnboardingWizard'));

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

            {/* Protected app shell — 5 real sections */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/discover"  element={<DiscoverPage />} />
                <Route path="/plan"      element={<DashboardPage />} />
                <Route path="/create"    element={<Content />} />
                <Route path="/publish"   element={<PublishPage />} />
                <Route path="/learn"     element={<LearnPage />} />
                <Route path="/settings"  element={<SettingsPageNew />} />

                {/* ── Legacy redirects (keep old URLs working) ── */}
                {/* Old home → Discover */}
                <Route path="/dashboard"        element={<Navigate to="/discover" replace />} />
                <Route path="/dashboard/home"   element={<Navigate to="/discover" replace />} />
                <Route path="/dashboard/*"      element={<Navigate to="/discover" replace />} />

                {/* Old content → Create */}
                <Route path="/content"          element={<Navigate to="/create" replace />} />
                <Route path="/dashboard/create" element={<Navigate to="/plan"   replace />} />
                <Route path="/create/*"         element={<Navigate to="/create" replace />} />

                {/* Old analytics → Learn */}
                <Route path="/analytics"        element={<Navigate to="/learn"  replace />} />

                {/* Dead stubs → nearest live equivalent */}
                <Route path="/campaigns"        element={<Navigate to="/plan"    replace />} />
                <Route path="/seo"              element={<Navigate to="/learn?tab=keywords" replace />} />
                <Route path="/competitors"      element={<Navigate to="/learn?tab=audience" replace />} />
                <Route path="/ai-studio"        element={<Navigate to="/plan"    replace />} />
                <Route path="/automations"      element={<Navigate to="/publish" replace />} />
                <Route path="/marketplace/*"    element={<Navigate to="/settings?tab=marketplace" replace />} />
                <Route path="/history"          element={<Navigate to="/publish" replace />} />
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
