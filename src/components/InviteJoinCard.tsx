import React, { useState } from 'react';
import { ArrowRight, KeyRound, Lock, LogIn, ShieldCheck, Trophy, Users } from 'lucide-react';
import { normalizeInviteCode } from '../services/communityService';

interface InviteJoinCardProps {
  isSignedIn: boolean;
  isFounder: boolean;
  hasHandle: boolean;
  cfHandle?: string;
  authBusy?: boolean;
  compact?: boolean;
  onSignIn: () => void;
  onJoinWithInvite: (inviteCode: string) => Promise<void>;
}

export const InviteJoinCard: React.FC<InviteJoinCardProps> = ({
  isSignedIn,
  isFounder,
  hasHandle,
  cfHandle,
  authBusy = false,
  compact = false,
  onSignIn,
  onJoinWithInvite,
}) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = normalizeInviteCode(code);
    if (!isFounder && clean.length < 4) {
      setError('Enter a valid invite code (4+ characters).');
      return;
    }
    setBusy(true);
    try {
      await onJoinWithInvite(isFounder ? clean || 'FOUNDER' : clean);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify invite code.');
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <section className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-[#0047CC] dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              CodeGram Community · 300+ Members
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Leaderboard, member focus &amp; CodeGram contests
            </p>
          </div>
        </div>

        {!isSignedIn ? (
          <button
            type="button"
            disabled={authBusy}
            onClick={onSignIn}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] text-white whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{authBusy ? 'Signing in...' : 'Sign in to Join'}</span>
          </button>
        ) : isFounder ? (
          <button
            type="button"
            disabled={busy || !hasHandle}
            onClick={() => void handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] text-white disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{busy ? 'Activating...' : 'Activate Founder Hub'}</span>
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="INVITE CODE"
              maxLength={32}
              className="w-32 sm:w-36 px-3 py-1.5 text-xs font-mono uppercase bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={busy || !hasHandle}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] text-white disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <span>{busy ? 'Joining...' : 'Join'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
        {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
      </section>
    );
  }

  return (
    <section className="max-w-lg mx-auto bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-7 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 text-[#0047CC] dark:text-blue-400" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            CodeGram Community
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Invite-only hub · 300+ competitive programmers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center border-y border-slate-100 dark:border-slate-800/80 py-3.5">
        <div>
          <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Leaderboard</p>
        </div>
        <div>
          <Users className="w-4 h-4 text-[#0047CC] dark:text-blue-400 mx-auto mb-1" />
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Profiles</p>
        </div>
        <div>
          <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Contests</p>
        </div>
      </div>

      {!isSignedIn ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Sign in with Google first to join with a CodeGram invite code.
          </p>
          <button
            type="button"
            disabled={authBusy}
            onClick={onSignIn}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white"
          >
            <LogIn className="w-4 h-4" />
            <span>{authBusy ? 'Signing in...' : 'Continue with Google'}</span>
          </button>
        </div>
      ) : !hasHandle ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Link your Codeforces handle on Home first before joining the leaderboard.
        </p>
      ) : isFounder ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Signed in as Founder (<span className="font-mono font-semibold">@{cfHandle}</span>). Activate your community profile to manage invite codes, hosts, and CodeGram contests.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{busy ? 'Activating...' : 'Enter CodeGram Hub'}</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="community-invite-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Invite Code for <span className="font-mono text-[#0047CC] dark:text-blue-400">@{cfHandle}</span>
            </label>
            <input
              id="community-invite-input"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="e.g. CODEGRAM2026"
              maxLength={32}
              autoComplete="off"
              className="w-full px-3.5 py-2.5 text-sm font-mono uppercase bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy || normalizeInviteCode(code).length < 4}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50"
          >
            <span>{busy ? 'Verifying...' : 'Join Community'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </section>
  );
};
