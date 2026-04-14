/**
 * AuthModal — Sign in / Sign up modal wired to real Supabase Auth.
 *
 * On success, the AuthContext's onAuthStateChange listener fires automatically
 * and updates the session — no manual callback needed, just close the modal.
 *
 * Error handling:
 *  - Supabase returns structured AuthError objects with a user-readable message
 *  - Network failures are caught and shown as a generic message
 *  - The modal stays open on error so the user can correct their credentials
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setError(null);
    setEmailSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        // AuthContext automatically picks up the new session
        onClose();
        navigate('/dashboard');
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || email.split('@')[0] },
          },
        });
        if (signUpError) throw signUpError;
        // Supabase sends a confirmation email by default
        setEmailSent(true);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin((prev) => !prev);
    resetForm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-8 relative shadow-2xl shadow-black/50">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
          aria-label="Close authentication dialog"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {emailSent ? (
          /* Confirmation email sent state */
          <div className="text-center py-4">
            <div className="inline-block p-3 rounded-full bg-teal-500/10 mb-4">
              <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 id="auth-modal-title" className="text-2xl font-bold text-white mb-2">
              Check your email
            </h2>
            <p className="text-slate-400 text-sm">
              We sent a confirmation link to <strong className="text-slate-200">{email}</strong>.
              Click it to activate your account, then come back to log in.
            </p>
            <button
              onClick={switchMode}
              className="mt-6 text-teal-400 text-sm hover:text-teal-300 transition-colors"
            >
              Back to log in
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="inline-block p-3 rounded-full bg-teal-500/10 mb-4">
                <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 id="auth-modal-title" className="text-2xl font-bold text-white mb-2">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-slate-400">
                {isLogin
                  ? 'Log in to access your brand voice.'
                  : 'Start building your personal brand today.'}
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-4 rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                    placeholder="Jane Doe"
                    autoComplete="name"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-lg transition-all active:scale-95 flex justify-center items-center shadow-lg shadow-teal-900/20"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : isLogin ? (
                  'Log In'
                ) : (
                  'Sign Up Free'
                )}
              </button>
            </form>

            <div className="mt-6 text-center border-t border-slate-800 pt-6">
              <button
                type="button"
                onClick={switchMode}
                className="text-slate-400 text-sm hover:text-teal-400 transition-colors"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Log in'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
