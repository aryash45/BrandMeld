/**
 * ProtectedRoute — Wraps private routes and redirects unauthenticated
 * users to the landing page ('/').
 *
 * Shows a loading spinner while the initial Supabase session check is
 * in flight (isLoading), preventing a flash of the login redirect.
 */
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute: React.FC = () => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
          <p className="text-sm text-slate-500">Loading session…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  // Renders whichever child route matched — keeps layout nesting intact
  return <Outlet />;
};

export default ProtectedRoute;
