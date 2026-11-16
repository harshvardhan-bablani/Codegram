import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { AlertCircle, ArrowLeft, ArrowRight, LogIn, LogOut } from 'lucide-react';
import type { CFBundle } from '../types/codeforces';
import {
  SAMPLE_PROFILE_AVATAR,
  getRankColor,
  getRankLabel,
  resolveAvatarUrl,
} from '../utils/analytics';

interface OnboardingHandleGateProps {
  step: 'handle' | 'google';
  authUser: User | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  loading: boolean;
  error: string | null;
  linkedHandle: string;
  linkedBundle: CFBundle | null;
  onLinkHandle: (handle: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSkipGoogle: () => void;
  onBackToHandle: () => void;
}

export const OnboardingHandleGate: React.FC<OnboardingHandleGateProps> = ({
  step,
  authUser,
  authReady,
  authBusy,
  authError,
  loading,
  error,
  linkedHandle,
  linkedBundle,
  onLinkHandle,
  onSignIn,
  onSignOut,
  onSkipGoogle,
  onBackToHandle,
}) => {
  const [draft, setDraft] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean || loading) return;
    onLinkHandle(clean);
  };

  if (step === 'google') {
    const cfUser = linkedBundle?.user;
    const rankColor = getRankColor(cfUser?.rating, cfUser?.rank);
    const avatarSrc = avatarFailed
      ? SAMPLE_PROFILE_AVATAR
      : resolveAvatarUrl(cfUser?.titlePhoto || cfUser?.avatar);

    return (
      <div className="min-h-[65vh] flex items-center justify-center py-8">
        <section
          aria-label="Sign up with Google"
          className="w-full max-w-md bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
            <span>Step 2 of 2</span>
            <button
              type="button"
              onClick={onBackToHandle}
              className="inline-flex items-center gap-1 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change handle</span>
            </button>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-stone-50 dark:bg-[#141312] border border-stone-200/70 dark:border-stone-800">
            <div className="w-11 h-11 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 shrink-0">
              <img
                src={avatarSrc}
                alt={cfUser?.handle || linkedHandle}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p
                className="font-mono text-sm font-bold truncate"
                style={{ color: rankColor }}
              >
                @{cfUser?.handle || linkedHandle}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums truncate">
                {cfUser ? (
                  <>
                    <span className="font-semibold" style={{ color: rankColor }}>
                      {getRankLabel(cfUser.rank)}
                    </span>
                    <span> · Rating {cfUser.rating ?? 'Unrated'}</span>
                  </>
                ) : (
                  'Handle linked'
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Sign up with Google
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
              Save your Codeforces handle, bookmarked practice problems, snoozed leftovers, and contest plans across devices.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={onSignIn}
              disabled={authBusy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>{authBusy ? 'Signing up...' : 'Sign up with Google'}</span>
            </button>

            <button
              type="button"
              onClick={onSkipGoogle}
              className="w-full py-2 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors"
            >
              Continue without signing up
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-[65vh] flex items-center justify-center py-8">
      <section
        aria-label="Link your Codeforces handle"
        className="w-full max-w-md bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-6 sm:p-8 space-y-6"
      >
        <div className="space-y-2">
          <p className="text-xs text-stone-400 dark:text-stone-500">Step 1 of 2</p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Link your Codeforces handle to proceed
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
            Enter your Codeforces handle to diagnose weak topics, surface leftover problems, and build your personalized practice queue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="onboarding-cf-handle"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5"
            >
              Codeforces Handle
            </label>
            <input
              id="onboarding-cf-handle"
              type="text"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Enter your Codeforces handle..."
              disabled={loading}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-[#141312] border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-60"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !draft.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <span>{loading ? 'Linking handle...' : 'Link & Continue'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {authReady && (
          <div className="pt-4 border-t border-stone-100 dark:border-stone-800/80 space-y-2.5">
            {authUser ? (
              <div className="flex items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
                <span className="truncate">
                  Signed in as {authUser.displayName || authUser.email || 'Google account'}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1 font-medium text-stone-700 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  Returning user?
                </span>
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={authBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-rose-400 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>{authBusy ? 'Signing in...' : 'Sign in with Google'}</span>
                </button>
              </div>
            )}

            {authError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{authError}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
