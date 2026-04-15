/**
 * AuthModal — Sign in / Sign up modal wired to real Supabase Auth.
 * Refactored to Cyber-Industrial Cyberpunk Aesthetic
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
        setEmailSent(true);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'SYS_ERR: UNEXPECTED_FAILURE';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-black border-2 border-brand-cyan w-full max-w-md p-8 relative neo-shadow-cyan text-white selection:bg-brand-yellow selection:text-black">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-brand-cyan hover:text-black hover:bg-brand-cyan border-2 border-transparent hover:border-brand-cyan font-bold transition-colors w-8 h-8 flex items-center justify-center"
          aria-label="Close authentication dialog"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        {emailSent ? (
          <div className="text-left py-4 border-l-4 border-brand-cyan pl-6">
            <span className="material-symbols-outlined text-4xl text-brand-cyan mb-4 animate-pulse">mark_email_read</span>
            <h2 id="auth-modal-title" className="font-headline text-3xl font-black uppercase tracking-tighter mb-4 text-brand-cyan">
              AWAITING_VERIFICATION
            </h2>
            <p className="font-label text-sm uppercase text-slate-400 mb-6 leading-relaxed">
              TRANSMISSION SENT TO: <br/><strong className="text-white">{email}</strong><br/><br/>
              ACCESS LINK DISPATCHED. AWAITING SIGNAL RETURN.
            </p>
            <button
              onClick={switchMode}
              className="text-brand-yellow font-headline font-bold text-sm hover:underline uppercase transition-colors"
            >
              [ REBOOT_SIGN_IN ]
            </button>
          </div>
        ) : (
          <>
            <div className="text-left mb-8 border-b-2 border-white pb-6 relative">
              <span className="material-symbols-outlined text-4xl text-brand-cyan mb-4">admin_panel_settings</span>
              <h2 id="auth-modal-title" className="font-headline text-4xl font-black uppercase tracking-tighter mb-2">
                {isLogin ? 'SYS_LOGIN' : 'INIT_ACCOUNT'}
              </h2>
              <p className="font-label text-sm uppercase text-slate-400">
                {isLogin
                  ? 'AUTHENTICATE TO ACCESS BRAND_ENGINE.'
                  : 'REGISTER ENTITY IN DATABASE.'}
              </p>
              <div className="absolute right-0 bottom-[-2px] w-12 h-1 bg-brand-cyan"></div>
            </div>

            {error && (
              <div className="mb-6 border-2 border-rose-500 bg-black p-3 font-label text-xs uppercase text-rose-500 neo-shadow flex gap-3">
                <span className="material-symbols-outlined text-base">warning</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {!isLogin && (
                <div>
                  <label className="block text-[10px] font-bold font-label uppercase text-brand-cyan mb-2">
                    [ IDENTIFICATION_STRING ]
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black border-2 border-white px-4 py-3 text-white focus:border-brand-yellow focus:neo-shadow-yellow outline-none transition-all font-label text-sm"
                    placeholder="ENTER_NAME..."
                    autoComplete="name"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold font-label uppercase text-brand-cyan mb-2">
                  [ PRIMARY_COMMS_ADDRESS ]
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border-2 border-white px-4 py-3 text-white focus:border-brand-yellow focus:neo-shadow-yellow outline-none transition-all font-label text-sm"
                  placeholder="USER@DOMAIN.COM"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold font-label uppercase text-brand-cyan mb-2">
                  [ SECURITY_KEY ]
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border-2 border-white px-4 py-3 text-white focus:border-brand-yellow focus:neo-shadow-yellow outline-none transition-all font-label tracking-[0.2em]"
                  placeholder="********"
                  required
                  minLength={8}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full bg-brand-yellow text-black border-2 border-black font-headline font-black text-xl py-4 uppercase transition-all hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_white] neo-shadow disabled:opacity-50 disabled:pointer-events-none mt-4 flex justify-center items-center gap-3"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-2xl">sync</span>
                    <span>PROCESSING...</span>
                  </>
                ) : isLogin ? (
                  <>
                    <span className="material-symbols-outlined font-bold text-2xl">login</span>
                    <span>EXECUTE_LOGIN</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined font-bold text-2xl">how_to_reg</span>
                    <span>INITIALIZE_USER</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t-2 border-white/20 text-center flex justify-between items-center font-label text-xs uppercase">
              <span className="text-slate-500">
                {isLogin ? 'NEW_ENTITY?' : 'KNOWN_ENTITY?'}
              </span>
              <button
                type="button"
                onClick={switchMode}
                className="text-brand-cyan font-bold hover:text-white hover:bg-brand-cyan hover:border-brand-cyan border border-transparent px-2 py-1 transition-colors"
              >
                {isLogin ? '[ REGISTER ]' : '[ AUTHENTICATE ]'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
