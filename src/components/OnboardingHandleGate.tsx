import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { AlertCircle, ArrowRight, Check, Copy, ExternalLink, LogOut } from 'lucide-react';
import type { CFBundle } from '../types/codeforces';
import { WHATSAPP_COMMUNITY_URL } from '../services/communityService';
import {
  SAMPLE_PROFILE_AVATAR,
  getRankColor,
  getRankLabel,
  resolveAvatarUrl,
} from '../utils/analytics';
import { CodegramLogo } from './CodegramLogo';

interface OnboardingHandleGateProps {
  step: 'login' | 'details' | 'whatsapp';
  authUser: User | null;
  authBusy: boolean;
  authError: string | null;
  loading: boolean;
  error: string | null;
  initialName: string;
  initialHandle: string;
  linkedHandle: string;
  linkedBundle: CFBundle | null;
  memberName: string;
  onSignIn: () => void;
  onSignOut: () => void;
  onSubmitDetails: (name: string, handle: string) => void;
  onEnterPlatform: () => void;
}

export const OnboardingHandleGate: React.FC<OnboardingHandleGateProps> = ({
  step,
  authUser,
  authBusy,
  authError,
  loading,
  error,
  initialName,
  initialHandle,
  linkedHandle,
  linkedBundle,
  memberName,
  onSignIn,
  onSignOut,
  onSubmitDetails,
  onEnterPlatform,
}) => {
  const [name, setName] = useState(initialName);
  const [handle, setHandle] = useState(initialHandle);
  const [localError, setLocalError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setName((prev) => (prev.trim() ? prev : initialName));
  }, [initialName]);

  useEffect(() => {
    setHandle((prev) => (prev.trim() ? prev : initialHandle));
  }, [initialHandle]);

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanHandle = handle.trim();

    if (!cleanName) {
      setLocalError('Please enter your name.');
      return;
    }
    if (!cleanHandle) {
      setLocalError('Please enter your Codeforces ID.');
      return;
    }
    if (loading) return;

    setLocalError(null);
    onSubmitDetails(cleanName, cleanHandle);
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(WHATSAPP_COMMUNITY_URL);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  /* ---------------------------------------------------------
   * STEP 1: WELCOME / GOOGLE-ONLY LOGIN & SIGNUP
   * --------------------------------------------------------- */
  if (step === 'login') {
    return (
      <div className="min-h-[68vh] flex flex-col items-center justify-center py-4 sm:py-6 gap-6">
        <CodegramLogo variant="stacked" showTagline />

        <section
          aria-label="Sign in to CodeGram"
          className="w-full max-w-md bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <div className="space-y-1.5 text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Welcome to CodeGram
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in with Google to enter the community, track your progress, and compete in CodeGram rounds.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 px-3 py-2.5 text-xs text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onSignIn}
            disabled={authBusy}
            className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 shrink-0">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>{authBusy ? 'Signing in...' : 'Continue with Google'}</span>
          </button>

          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Google sign-in is required to set up your profile and unlock the WhatsApp community invite.
          </p>
        </section>
      </div>
    );
  }

  /* ---------------------------------------------------------
   * STEP 3: GREETING + WHATSAPP COMMUNITY INVITE -> ENTER APP
   * --------------------------------------------------------- */
  if (step === 'whatsapp') {
    const cfUser = linkedBundle?.user;
    const rankColor = getRankColor(cfUser?.rating, cfUser?.rank);
    const avatarSrc = avatarFailed
      ? SAMPLE_PROFILE_AVATAR
      : resolveAvatarUrl(cfUser?.titlePhoto || cfUser?.avatar || authUser?.photoURL || undefined);
    const displayMemberName = memberName.trim() || authUser?.displayName || cfUser?.handle || 'Coder';
    const firstName = displayMemberName.split(/\s+/)[0] || displayMemberName;

    return (
      <div className="min-h-[68vh] flex flex-col items-center justify-center py-4 sm:py-6 gap-5 sm:gap-6">
        <CodegramLogo variant="stacked" showTagline />

        <section
          aria-label="WhatsApp Community Invite"
          className="w-full max-w-md bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-8 space-y-5"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>Step 2 of 2</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              Profile linked
            </span>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E131D] border border-slate-200/80 dark:border-slate-800">
            <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0">
              <img
                src={avatarSrc}
                alt={cfUser?.handle || linkedHandle}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {displayMemberName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                <span className="font-mono font-bold" style={{ color: rankColor }}>
                  @{cfUser?.handle || linkedHandle}
                </span>
                {cfUser && (
                  <>
                    <span> · </span>
                    <span className="font-semibold" style={{ color: rankColor }}>
                      {getRankLabel(cfUser.rank)}
                    </span>
                    <span> · Rating {cfUser.rating ?? 'Unrated'}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Welcome to CodeGram, {firstName}!
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You are now part of the CodeGram community. Join our WhatsApp group for contest alerts, upsolving, and community updates.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                CodeGram WhatsApp Community
              </span>
              <button
                type="button"
                onClick={() => void handleCopyInvite()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline whitespace-nowrap shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy link</span>
                  </>
                )}
              </button>
            </div>

            <p className="font-mono text-[11px] text-emerald-800/80 dark:text-emerald-300/80 truncate select-all">
              {WHATSAPP_COMMUNITY_URL}
            </p>

            <a
              href={WHATSAPP_COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white transition-colors whitespace-nowrap"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="w-4 h-4 shrink-0"
              >
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.78 14.08c-.24.68-1.42 1.3-1.95 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.18-4.93-4.37-.14-.19-1.18-1.57-1.18-3s.75-2.12 1.01-2.41c.26-.29.58-.36.77-.36h.55c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.3-.13.58.17.29.75 1.23 1.6 1.99 1.1.98 2.02 1.29 2.31 1.43.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.39-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.69-.17 1.37Z" />
              </svg>
              <span>Join WhatsApp Community</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <button
            type="button"
            onClick={onEnterPlatform}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <span>Enter CodeGram</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </div>
    );
  }

  /* ---------------------------------------------------------
   * STEP 2: REQUIRED NAME & CODEFORCES ID
   * --------------------------------------------------------- */
  const displayError = localError || error;

  return (
    <div className="min-h-[68vh] flex flex-col items-center justify-center py-4 sm:py-6 gap-5 sm:gap-6">
      <CodegramLogo variant="stacked" showTagline />

      <section
        aria-label="Enter your name and Codeforces ID"
        className="w-full max-w-md bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-8 space-y-5"
      >
        <div className="flex items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
          <span>Step 1 of 2</span>
          {authUser && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch account</span>
            </button>
          )}
        </div>

        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Complete your profile
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter your name and Codeforces ID to join CodeGram.
          </p>
        </div>

        <form onSubmit={handleDetailsSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="onboarding-full-name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Your Name
            </label>
            <input
              id="onboarding-full-name"
              type="text"
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (localError) setLocalError(null);
              }}
              placeholder="Enter your full name..."
              disabled={loading}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="onboarding-cf-handle"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Codeforces ID
            </label>
            <input
              id="onboarding-cf-handle"
              type="text"
              required
              maxLength={64}
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                if (localError) setLocalError(null);
              }}
              placeholder="e.g. tourist"
              disabled={loading}
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>

          {displayError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 px-3 py-2.5 text-xs text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <span>{displayError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim() || !handle.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <span>{loading ? 'Verifying handle...' : 'Continue'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {authUser?.email && (
          <p className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-400 dark:text-slate-500 truncate text-center">
            Signed in as {authUser.email}
          </p>
        )}
      </section>
    </div>
  );
};
