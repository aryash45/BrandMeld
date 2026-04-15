/**
 * App.tsx — Router shell v2.
 *
 * Route structure:
 *  /           → LandingPage (public)
 *  /dashboard  → DashboardPage — the Magic Box (protected)  ← primary
 *  /create     → redirect to /dashboard
 *  /history    → HistoryPage (protected)
 *  /settings   → SettingsPage (protected)
 *
 * Removed: /audit, /brand-kit
 * (Audit logic is now internal self-correction inside engine.py.
 *  Brand onboarding lives inside the Magic Box URL input.)
 */
import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './layout/AppLayout';
import ProtectedRoute from './layout/ProtectedRoute';
import AuthModal from './components/AuthModal';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

const App: React.FC = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />

        <Routes>
          {/* Public */}
          <Route
            path="/"
            element={<LandingPage onLoginClick={() => setShowAuthModal(true)} />}
          />

          {/* Protected — authenticated app shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/history"   element={<HistoryPage />} />
              <Route path="/settings"  element={<SettingsPage />} />

              {/* Redirect legacy routes → Magic Box */}
              <Route path="/create"    element={<Navigate to="/dashboard" replace />} />
              <Route path="/audit"     element={<Navigate to="/dashboard" replace />} />
              <Route path="/brand-kit" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
