import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowRight,
  Award,
  Bookmark,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  LogIn,
  LogOut,
  RefreshCw,
  Shuffle,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import type {
  AnalyticsSummary,
  BookmarkStatus,
  CFBundle,
  CFContest,
  CFProblemsetPayload,
  CodeGramTab,
  CommunityContest,
  CommunityContestRsvp,
  ContestRsvp,
  ProblemBookmark,
} from '../types/codeforces';
import {
  fetchCodeforcesProblemset,
  getCachedProblemset,
} from '../services/codeforcesApi';
import {
  SAMPLE_PROFILE_AVATAR,
  computeTopicPracticeProfile,
  generateSuggestedProblems,
  getRankColor,
  getRankLabel,
  resolveAvatarUrl,
} from '../utils/analytics';
import { InviteJoinCard } from './InviteJoinCard';

interface HomeViewProps {
  authUser: User | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  activeHandle: string;
  primaryBundle: CFBundle | null;
  analytics: AnalyticsSummary;
  bookmarks: ProblemBookmark[];
  loadingHandle: boolean;
  handleError: string | null;
  contests: CFContest[];
  contestsLoading: boolean;
  rsvpsByContest: Record<string, ContestRsvp[]>;
  isEnrolled: boolean;
  isFounder: boolean;
  communityRank: number | null;
  communityMemberCount: number;
  nextCommunityContest: CommunityContest | null;
  nextCommunityRsvps: CommunityContestRsvp[];
  onSignIn: () => void;
  onSignOut: () => void;
  onRefreshHandle: () => void;
  onJoinWithInvite: (inviteCode: string) => Promise<void>;
  onToggleCommunityRsvp: (contestId: string) => Promise<void>;
  onToggleRsvp: (contestId: number) => Promise<void>;
  onToggleBookmark: (problem: {
    problemKey: string;
    contestId: number;
    index: string;
    name: string;
    rating?: number;
    status: BookmarkStatus;
  }) => Promise<void>;
  onNavigateTab: (tab: CodeGramTab) => void;
  onPracticeTopic: (tag: string) => void;
  onOpenWeakTopics: () => void;
  onOpenContests: () => void;
}

function formatCountdown(targetEpochSec: number, nowSec: number): string {
  const diff = Math.max(0, targetEpochSec - nowSec);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function formatRoundStartDate(epochSec?: number): string {
  if (!epochSec) return 'TBD';
  return new Date(epochSec * 1000).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRoundDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h 00m`;
}

export const HomeView: React.FC<HomeViewProps> = ({
  authUser,
  authReady,
  authBusy,
  authError,
  activeHandle,
  primaryBundle,
  analytics,
  bookmarks,
  loadingHandle,
  handleError,
  isEnrolled,
  isFounder,
  communityRank,
  communityMemberCount,
  nextCommunityContest,
  onSignIn,
  onSignOut,
  onRefreshHandle,
  onJoinWithInvite,
  onToggleBookmark,
  onNavigateTab,
  onPracticeTopic,
  onOpenWeakTopics,
}) => {
  const [busyBookmarkKey, setBusyBookmarkKey] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [avatarFailed, setAvatarFailed] = useState(false);

  const [problemset, setProblemset] = useState<CFProblemsetPayload | null>(() =>
    getCachedProblemset()
  );
  const [problemsetLoading, setProblemsetLoading] = useState<boolean>(() => !getCachedProblemset());
  const [batchOffset, setBatchOffset] = useState(0);

  useEffect(() => {
    setAvatarFailed(false);
    setBatchOffset(0);
  }, [activeHandle]);

  useEffect(() => {
    if (!problemset) {
      setProblemsetLoading(true);
      void fetchCodeforcesProblemset(false)
        .then((payload) => setProblemset(payload))
        .catch(() => {})
        .finally(() => setProblemsetLoading(false));
    }
  }, [problemset]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const cfUser = primaryBundle?.user ?? null;
  const rankColor = getRankColor(cfUser?.rating, cfUser?.rank);
  const avatarUrl = avatarFailed
    ? SAMPLE_PROFILE_AVATAR
    : resolveAvatarUrl(cfUser?.titlePhoto || cfUser?.avatar || authUser?.photoURL || undefined);

  const practiceProfile = useMemo(() => {
    if (!primaryBundle) return null;
    return computeTopicPracticeProfile(primaryBundle, analytics.topicStats);
  }, [primaryBundle, analytics.topicStats]);

  const snoozedSet = useMemo(() => {
    return new Set(bookmarks.filter((b) => b.status === 'snoozed').map((b) => b.problemKey));
  }, [bookmarks]);

  const savedSet = useMemo(() => {
    return new Set(bookmarks.filter((b) => b.status === 'saved').map((b) => b.problemKey));
  }, [bookmarks]);

  const topWeakTopics = useMemo(() => {
    return (practiceProfile?.weakTopics ?? []).slice(0, 4);
  }, [practiceProfile]);

  const { recommendedBatch, totalBatches, ratingRange } = useMemo(() => {
    if (!primaryBundle || !problemset || !practiceProfile) {
      return {
        recommendedBatch: [],
        totalBatches: 0,
        ratingRange: [1200, 1400] as [number, number],
      };
    }
    const result = generateSuggestedProblems({
      bundle: primaryBundle,
      problemset,
      profile: practiceProfile,
      difficultyBand: 'sweet_spot',
      focusMode: 'all',
      filterTopic: null,
      pageOffset: 0,
      limit: 16,
    });
    const pool = result.suggestions.filter((s) => !snoozedSet.has(s.key));
    const batches = Math.max(1, Math.ceil(pool.length / 4));
    const activeBatchIndex = batchOffset % batches;
    const start = activeBatchIndex * 4;
    return {
      recommendedBatch: pool.slice(start, start + 4),
      totalBatches: batches,
      ratingRange: result.ratingRange,
    };
  }, [primaryBundle, problemset, practiceProfile, snoozedSet, batchOffset]);

  const solveConversion =
    analytics.uniqueAttempted > 0
      ? Math.round((analytics.uniqueSolved / analytics.uniqueAttempted) * 100)
      : 0;

  const handleSaveProblem = async (problem: {
    key: string;
    contestId: number;
    index: string;
    name: string;
    rating?: number;
  }) => {
    setBusyBookmarkKey(problem.key);
    try {
      await onToggleBookmark({
        problemKey: problem.key,
        contestId: problem.contestId,
        index: problem.index,
        name: problem.name,
        rating: problem.rating,
        status: 'saved',
      });
    } finally {
      setBusyBookmarkKey(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. TOP-MOST SECTION: USER STATS & PROFILE */}
      <section aria-label="User Stats" className="space-y-3.5 sm:space-y-4">
        {/* Compact Identity & Account Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
              <img
                src={avatarUrl}
                alt={cfUser?.handle || authUser?.displayName || 'Profile'}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0">
              {cfUser ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('stats')}
                    className="font-display text-xl font-bold truncate hover:underline text-left"
                    style={{ color: rankColor }}
                  >
                    @{cfUser.handle}
                  </button>
                  <button
                    type="button"
                    onClick={onRefreshHandle}
                    disabled={loadingHandle}
                    title="Refresh Codeforces data"
                    aria-label="Refresh handle"
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingHandle ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              ) : (
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                  {authUser?.displayName
                    ? `Welcome back, ${authUser.displayName.split(' ')[0]}`
                    : 'Your Codeforces Overview'}
                </h1>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                {cfUser ? (
                  <>
                    <span className="font-semibold" style={{ color: rankColor }}>
                      {getRankLabel(cfUser.rank)}
                    </span>
                    {isEnrolled && communityRank && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('community')}
                        className="ml-1.5 font-mono font-semibold text-[#0047CC] dark:text-blue-400 hover:underline"
                      >
                        · #{communityRank} CodeGram
                      </button>
                    )}
                  </>
                ) : (
                  'Link your handle to start'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('stats')}
              className="text-xs font-semibold text-[#0047CC] dark:text-blue-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>You</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {!authReady ? null : authUser ? (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                disabled={authBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121824] text-slate-800 dark:text-slate-200 hover:border-blue-500 transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 text-[#0047CC] dark:text-blue-400" />
                <span>{authBusy ? 'Signing in...' : 'Google Sign in'}</span>
              </button>
            )}
          </div>
        </div>

        {authError && <p className="text-xs text-red-600 dark:text-red-400">{authError}</p>}

        {/* 4-Card User Stats Row */}
        {loadingHandle && !cfUser ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 animate-pulse"
              >
                <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="mt-2.5 h-7 sm:h-8 w-16 sm:w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="mt-2 h-3.5 w-24 bg-slate-100 dark:bg-slate-800/70 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Stat 1: Rating */}
            <button
              type="button"
              onClick={() => onNavigateTab('stats')}
              className="text-left bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 rounded-2xl p-3.5 sm:p-5 transition-colors min-w-0"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Rating</span>
                <Award className="w-4 h-4 text-[#0047CC] dark:text-blue-400 shrink-0" />
              </div>
              <p
                className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight tabular-nums truncate"
                style={{ color: cfUser?.rating ? rankColor : undefined }}
              >
                {cfUser?.rating ?? 'Unrated'}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                {cfUser?.maxRating ? `Peak ${cfUser.maxRating}` : 'Unrated'}
              </p>
            </button>

            {/* Stat 2: Solved */}
            <button
              type="button"
              onClick={() => onNavigateTab('stats')}
              className="text-left bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 rounded-2xl p-3.5 sm:p-5 transition-colors min-w-0"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Solved</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums truncate">
                {analytics.uniqueSolved.toLocaleString()}
              </p>
              <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                {solveConversion}% AC · Avg {analytics.avgSolvedRating ?? '—'}
              </p>
            </button>

            {/* Stat 3: Streak */}
            <button
              type="button"
              onClick={() => onNavigateTab('stats')}
              className="text-left bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 rounded-2xl p-3.5 sm:p-5 transition-colors min-w-0"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Streak</span>
                <Flame className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums truncate">
                {analytics.currentStreak}d
              </p>
              <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                Best {analytics.longestStreak}d · {analytics.activeDays}d
              </p>
            </button>

            {/* Stat 4: First-Try AC */}
            <button
              type="button"
              onClick={() => onNavigateTab('stats')}
              className="text-left bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 rounded-2xl p-3.5 sm:p-5 transition-colors min-w-0"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>1st-Try AC</span>
                <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
              </div>
              <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums truncate">
                {analytics.firstTryRate.toFixed(1)}%
              </p>
              <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                {analytics.firstTrySolves.toLocaleString()} clean
              </p>
            </button>
          </div>
        )}
      </section>

      {/* 1.5 CODEGRAM ROUND SPOTLIGHT */}
      {nextCommunityContest && (
        <section
          aria-label="Upcoming CodeGram Round"
          className="bg-gradient-to-br from-blue-50/85 via-white to-white dark:from-blue-950/30 dark:via-[#121824] dark:to-[#121824] border-2 border-[#0047CC]/35 dark:border-blue-500/45 shadow-[0_8px_24px_-12px_rgba(0,71,204,0.28)] dark:shadow-[0_8px_24px_-12px_rgba(59,130,246,0.28)] rounded-2xl p-5 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#0047CC] dark:text-blue-400">
                <span>
                  {nextCommunityContest.status === 'live' ? 'Live Now' : 'Upcoming CodeGram Round'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{nextCommunityContest.platform}</span>
                <span aria-hidden="true">·</span>
                <span>{nextCommunityContest.divisionTag}</span>
              </div>

              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                {nextCommunityContest.title}
              </h2>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                  <Calendar className="w-4 h-4 text-[#0047CC] dark:text-blue-400 shrink-0" />
                  {formatRoundStartDate(nextCommunityContest.startsAtEpoch)}
                </span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  {formatRoundDuration(nextCommunityContest.durationMinutes)}
                </span>
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-blue-200/60 dark:border-slate-800 shrink-0">
              <div className="sm:text-right">
                <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                  {nextCommunityContest.status === 'live' ? 'Time remaining' : 'Starts in'}
                </p>
                <p className="font-mono text-xl sm:text-2xl font-bold text-[#0047CC] dark:text-blue-400 tabular-nums tracking-tight">
                  {nextCommunityContest.status === 'live'
                    ? `${formatCountdown(
                        nextCommunityContest.startsAtEpoch + nextCommunityContest.durationMinutes * 60,
                        nowSec
                      )} left`
                    : formatCountdown(nextCommunityContest.startsAtEpoch, nowSec)}
                </p>
              </div>

              <a
                href={nextCommunityContest.contestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121824]"
              >
                <span>Open on Codeforces</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>
      )}

      {!isEnrolled ? (
        <InviteJoinCard
          compact
          isSignedIn={Boolean(authUser)}
          isFounder={isFounder}
          hasHandle={Boolean(cfUser)}
          cfHandle={cfUser?.handle}
          authBusy={authBusy}
          onSignIn={onSignIn}
          onJoinWithInvite={onJoinWithInvite}
        />
      ) : !nextCommunityContest ? (
        <section className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-[#0047CC] dark:text-blue-400" />
            </div>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate tabular-nums">
              CodeGram Community · {communityMemberCount} members
              {communityRank ? ` · Your Rank #${communityRank}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('community')}
            className="text-xs font-semibold text-[#0047CC] dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
          >
            Leaderboard →
          </button>
        </section>
      ) : null}

      {/* 2. SECOND SECTION: RECOMMENDED PROBLEMS */}
      <section
        aria-label="Recommended Problems"
        className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5 sm:mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-[#0047CC] dark:text-blue-400 shrink-0" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              Recommended Problems
            </h2>
            {practiceProfile && (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                · {ratingRange[0]}–{ratingRange[1]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {totalBatches > 1 && (
              <button
                type="button"
                onClick={() => setBatchOffset((prev) => prev + 1)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors whitespace-nowrap shrink-0"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigateTab('questions')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0047CC] dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
            >
              <span>All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!cfUser ? (
          <div className="py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {handleError
                ? handleError
                : loadingHandle
                ? 'Syncing your Codeforces submissions...'
                : 'Refresh your profile to load personalized problem recommendations.'}
            </p>
            <button
              type="button"
              onClick={onRefreshHandle}
              disabled={loadingHandle}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50 self-start sm:self-auto"
            >
              {loadingHandle ? 'Loading...' : 'Retry'}
            </button>
          </div>
        ) : problemsetLoading && recommendedBatch.length === 0 ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : recommendedBatch.length === 0 ? (
          <div className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Open the Practice tab to explore problems tailored to your current level and topics.
            </p>
            <button
              type="button"
              onClick={() => onNavigateTab('questions')}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white self-start sm:self-auto"
            >
              Open Practice Queue
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {recommendedBatch.map((problem) => {
              const isSaved = savedSet.has(problem.key);
              return (
                <div
                  key={problem.key}
                  className="py-3 first:pt-0.5 last:pb-0.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/25 sm:-mx-2 sm:px-2 rounded-xl transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        {problem.contestId}
                        {problem.index}
                      </span>
                      <a
                        href={problem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-[#0047CC] dark:hover:text-blue-400 break-words"
                      >
                        {problem.name}
                      </a>
                      <span
                        className="font-mono text-xs font-bold tabular-nums shrink-0"
                        style={{ color: getRankColor(problem.rating) }}
                      >
                        {problem.rating}
                      </span>
                    </div>

                    {problem.tags.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {problem.tags.slice(0, 3).join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end sm:justify-start gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyBookmarkKey === problem.key}
                      onClick={() => void handleSaveProblem(problem)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                        isSaved
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                      <span>{isSaved ? 'Saved' : 'Save'}</span>
                    </button>

                    <a
                      href={problem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Solve</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. WEAK TOPICS */}
      <section className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Weak Topics
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenWeakTopics}
            className="text-xs font-semibold text-[#0047CC] dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 shrink-0"
          >
            All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!cfUser ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
            Link a handle to view weak topics.
          </p>
        ) : topWeakTopics.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
            No weak topics flagged.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {topWeakTopics.map((t) => (
              <div
                key={t.tag}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0E131D]/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize truncate">
                    {t.tag}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                    {t.solvedCount === 0 ? '0 solved' : `${t.solvedCount} solved`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onPracticeTopic(t.tag)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#0047CC] dark:text-blue-400 hover:bg-[#0047CC] hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  Practice →
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
