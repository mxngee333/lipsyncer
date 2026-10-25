import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User, Calendar, ShieldCheck, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { LipSyncerUser } from '../types';
import {
  getSessionUser,
  setSessionUser,
  registerUserAccount,
  signInUserAccount,
  signInWithGoogleAccount,
  sendPasswordReset
} from '../services/r2VaultService';

export interface AuthModalProps {
  isOpen?: boolean;
  initialTab?: 'signin' | 'signup';
  onClose: () => void;
  onAuthSuccess: (user: LipSyncerUser) => void;
}

const OfficialGoogleSvg: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
    />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen = true,
  initialTab = 'signin',
  onClose,
  onAuthSuccess
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialTab);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [dob, setDob] = useState<string>('');
  const [consentChecked, setConsentChecked] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const activeSession = getSessionUser();
  const todayIso = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setAuthMode(initialTab);
    setErrorMsg(null);
    setStatusMsg(null);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const switchTab = (nextMode: 'signin' | 'signup') => {
    setAuthMode(nextMode);
    setErrorMsg(null);
    setStatusMsg(null);
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setIsGoogleLoading(true);
    try {
      const user = await signInWithGoogleAccount();
      setSessionUser(user);
      onAuthSuccess(user);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google authentication failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Enter your email address above first, then click Reset password.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await sendPasswordReset(trimmedEmail);
      if (res.ok) {
        setStatusMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (authMode === 'signin') {
      if (!password) {
        setErrorMsg('Please enter your password.');
        return;
      }
      setIsSubmitting(true);
      try {
        const user = await signInUserAccount({ email: cleanEmail, password });
        setSessionUser(user);
        onAuthSuccess(user);
        onClose();
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Create Account validation
    if (!firstName.trim()) {
      setErrorMsg('Please enter your first name.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (!consentChecked) {
      setErrorMsg('Please accept the LipSyncer Cloud encrypted vault consent checkbox.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await registerUserAccount({
        email: cleanEmail,
        password,
        firstName: firstName.trim(),
        dob: dob || undefined
      });
      setSessionUser(user);
      onAuthSuccess(user);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-[#121218] border border-white/10 shadow-[0_32px_90px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Top Ambient Accent Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-sky-500 to-violet-500" />

        <div className="p-6 sm:p-7 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {authMode === 'signin' ? 'Welcome back to LipSyncer' : 'Create your Studio Account'}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                {authMode === 'signin'
                  ? 'Sign in to access your R2 Cloud Lip-Sync Vault & Storyboards'
                  : 'Sync 60fps lip-sync renders & 20-scene Omni projects across devices'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close authentication modal"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/12 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active Session Notice if switching accounts */}
          {activeSession && (
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 text-xs">
              <span className="text-emerald-200 truncate">
                Signed in as <strong>{activeSession.email}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSessionUser(null);
                  setStatusMsg('Signed out of previous session.');
                }}
                className="text-emerald-300 hover:text-white font-semibold underline shrink-0 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          )}

          {/* Segmented Auth Tabs (Sign in vs Create account) */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#191922] border border-white/8 gap-1">
            <button
              type="button"
              onClick={() => switchTab('signin')}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                authMode === 'signin'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchTab('signup')}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Create account
            </button>
          </div>

          {/* Official Google Button */}
          <button
            type="button"
            disabled={isGoogleLoading || isSubmitting}
            onClick={handleGoogleAuth}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 active:bg-zinc-200 text-[#1f1f1f] font-semibold text-sm flex items-center justify-center gap-3 shadow-sm transition disabled:opacity-60 cursor-pointer"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-700" />
            ) : (
              <OfficialGoogleSvg />
            )}
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500">
              or with email
            </span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          {/* Feedback Banners */}
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-500/12 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Streamlined Auth Form — ZERO registration clutter in Sign In mode */}
          <form onSubmit={handleFormSubmit} noValidate className="space-y-3.5">
            {authMode === 'signup' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    First name <span className="text-rose-400">*</span>
                  </span>
                  <input
                    type="text"
                    name="firstName"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Your first name"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#181822] border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400/60 transition"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    Date of birth <span className="text-zinc-500">(optional)</span>
                  </span>
                  <input
                    type="date"
                    name="dob"
                    max={todayIso}
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#181822] border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400/60 transition"
                  />
                </label>
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                Email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#181822] border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400/60 transition"
              />
            </label>

            <label className="block space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  Password
                </span>
                {authMode === 'signup' && (
                  <span className="text-[11px] text-zinc-500">Min 6 characters</span>
                )}
              </div>
              <input
                type="password"
                name="password"
                autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                minLength={authMode === 'signup' ? 6 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={authMode === 'signin' ? 'Enter your password' : 'Create a strong password'}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#181822] border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400/60 transition"
              />
            </label>

            {authMode === 'signup' && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#181822] border border-white/8 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black text-cyan-500 focus:ring-cyan-500"
                />
                <span className="text-xs text-zinc-300 leading-relaxed flex items-start gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    I understand cloud sync stores my encrypted profile &amp; lip-sync vault on
                    LipSyncer Cloud
                  </span>
                </span>
              </label>
            )}

            {/* Mode Actions */}
            {authMode === 'signin' ? (
              <div className="pt-1 space-y-2.5">
                <button
                  type="submit"
                  disabled={isSubmitting || isGoogleLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-sky-500/20 transition disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Sign in</span>
                </button>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => switchTab('signup')}
                    className="py-2 px-3.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/8 text-xs font-semibold text-zinc-200 transition cursor-pointer"
                  >
                    Create account
                  </button>

                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={isSubmitting}
                    className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    Reset password
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-1 space-y-2.5">
                <button
                  type="submit"
                  disabled={isSubmitting || isGoogleLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-sky-500/20 transition disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Create account</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchTab('signin')}
                  className="w-full py-2 px-3.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/8 text-xs font-semibold text-zinc-200 transition cursor-pointer"
                >
                  Already have an account? Sign in
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
