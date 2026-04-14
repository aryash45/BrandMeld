/**
 * App.tsx — Thin router shell. All business logic lives in pages and hooks.
 *
 * Route structure:
 *  /           → LandingPage (public)
 *  /dashboard  → DashboardPage (protected)
 *  /create     → CreatePage (protected)
 *  /audit      → AuditPage (protected)
 *  /brand-kit  → BrandKitPage (protected)
 *  /history    → HistoryPage (protected)
 *  /settings   → SettingsPage (protected)
 *
 * ProtectedRoute wraps authenticated routes and redirects to '/' if no session.
 * AppLayout wraps them all with the persistent sidebar shell.
 */
import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './layout/AppLayout';
import ProtectedRoute from './layout/ProtectedRoute';
import AuthModal from './components/AuthModal';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import CreatePage from './pages/CreatePage';
import AuditPage from './pages/AuditPage';
import BrandKitPage from './pages/BrandKitPage';
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
          {/* Public — landing page */}
          <Route
            path="/"
            element={<LandingPage onLoginClick={() => setShowAuthModal(true)} />}
          />

          {/* Protected — authenticated app shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/create" element={<CreatePage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/brand-kit" element={<BrandKitPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
