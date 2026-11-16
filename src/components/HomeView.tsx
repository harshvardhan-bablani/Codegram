import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  BarChart2,
  Bookmark,
  Calendar,
  Check,
  ChevronRight,
  Edit3,
  ExternalLink,
  Flame,
  ListChecks,
  LogIn,
  LogOut,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react';
import type {
  AnalyticsSummary,
  CFBundle,
  CFContest,
  CodeGramTab,
  ContestRsvp,
  ProblemBookmark,
} from '../types/codeforces';
import {
  SAMPLE_PROFILE_AVATAR,
  computeTopicPracticeProfile,
  getRankColor,
  getRankLabel,
  resolveAvatarUrl,
} from '../utils/analytics';

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
  onSignIn: () => void;
  onSignOut: () => void;
  onSelectHandle: (handle: string) => void;
  onRefreshHandle: () => void;
  onToggleRsvp: (contestId: number) => Promise<void>;
  onNavigateTab: (tab: CodeGramTab) => void;
  onPracticeTopic: (tag: string) => void;
}

function formatCountdown(targetEpochSec: number, nowSec: number): string {
  const diff = Math.max(0, targetEpochSec - nowSec);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
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
  contests,
  contestsLoading,
  rsvpsByContest,
  onSignIn,
  onSignOut,
  onSelectHandle,
  onRefreshHandle,
  onToggleRsvp,
  onNavigateTab,
  onPracticeTopic,
}) => {
  const [editingHandle, setEditingHandle] = useState(!activeHandle);
  const [draftHandle, setDraftHandle] = useState(activeHandle);
  const [busyContestId, setBusyContestId] = useState<number | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setDraftHandle(activeHandle);
    setAvatarFailed(false);
    if (activeHandle) setEditingHandle(false);
  }, [activeHandle]);

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

  const upcomingRounds = useMemo(() => {
    return contests
      .filter((c) => c.phase === 'BEFORE' || c.phase === 'CODING')
      .sort((a, b) => (a.startTimeSeconds ?? 0) - (b.startTimeSeconds ?? 0))
      .slice(0, 3);
  }, [contests]);

  const practiceProfile = useMemo(() => {
    if (!primaryBundle) return null;
    return computeTopicPracticeProfile(primaryBundle, analytics.topicStats);
  }, [primaryBundle, analytics.topicStats]);

  const topWeakTopics = useMemo(() => {
    return (practiceProfile?.weakTopics ?? []).slice(0, 4);
  }, [practiceProfile]);

  const snoozedSet = useMemo(() => {
    return new Set(bookmarks.filter((b) => b.status === 'snoozed').map((b) => b.problemKey));
  }, [bookmarks]);

  const savedCount = useMemo(
    () => bookmarks.filter((b) => b.status === 'saved').length,
    [bookmarks]
  );

  const activeLeftovers = useMemo(
    () => analytics.stuckProblems.filter((p) => !snoozedSet.has(p.key)),
    [analytics.stuckProblems, snoozedSet]
  );

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draftHandle.trim();
    if (clean) onSelectHandle(clean);
  };

  const handleRsvpClick = async (contestId: number) => {
    setBusyContestId(contestId);
    try {
      await onToggleRsvp(contestId);
    } finally {
      setBusyContestId(null);
    }
  };

  const primaryMenuItems: {
    key: CodeGramTab;
    title: string;
    subtitle: string;
    stat: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      key: 'questions',
      title: 'Personalized Questions',
      subtitle: 'Targeted problems matched to your level & weak spots',
      stat: `${practiceProfile ? `Target ~${practiceProfile.estimatedLevel}` : 'Ready'} · ${savedCount} saved`,
      Icon: Sparkles,
    },
    {
      key: 'topics',
      title: 'Weak Topics',
      subtitle: 'Struggle breakdown, uncovered tags & metrics',
      stat: `${practiceProfile?.weakTopics.length ?? 0} focus areas flagged`,
      Icon: Target,
    },
    {
      key: 'leftovers',
      title: 'Leftover Things',
      subtitle: 'Unfinished attempts, contest upsolves & submission log',
      stat: `${activeLeftovers.length} unresolved · ${analytics.totalSubmissions} subs`,
      Icon: ListChecks,
    },
  ];

  const secondaryMenuItems: {
    key: CodeGramTab;
    title: string;
    subtitle: string;
    stat: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      key: 'stats',
      title: 'My Stats',
      subtitle: 'Consistency heatmap, rating progression & difficulty curve',
      stat: cfUser ? `${analytics.uniqueSolved} solved · ${analytics.currentStreak}d streak` : 'Link handle',
      Icon: BarChart2,
    },
    {
      key: 'rounds',
      title: 'Upcoming Rounds',
      subtitle: 'Live countdowns, contest reminders & past results',
      stat: `${upcomingRounds.length} upcoming`,
      Icon: Calendar,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Minimal Identity & Session Bar */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-full overflow-hidden bg-stone-200 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center shrink-0">
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
                  className="font-display text-lg font-bold truncate hover:underline text-left"
                  style={{ color: rankColor }}
                >
                  @{cfUser.handle}
                </button>
                <button
                  type="button"
                  onClick={onRefreshHandle}
                  disabled={loadingHandle}
                  aria-label="Refresh handle"
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHandle ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingHandle((v) => !v)}
                  aria-label="Switch handle"
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <h1 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
                {authUser?.displayName ? `Hi, ${authUser.displayName.split(' ')[0]}` : 'CodeGram Personal Coach'}
              </h1>
            )}
            <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums truncate">
              {cfUser ? (
                <>
                  <span className="font-semibold" style={{ color: rankColor }}>
                    {getRankLabel(cfUser.rank)}
                  </span>
                  <span> · Rating {cfUser.rating ?? 'Unrated'}</span>
                </>
              ) : (
                'Link your Codeforces handle to load personalized practice & analytics'
              )}
            </p>
          </div>
        </div>

        {/* Account Control */}
        <div className="flex items-center gap-3 shrink-0">
          {!authReady ? null : authUser ? (
            <div className="flex items-center gap-3 text-xs">
              <span
                className="font-semibold hidden sm:inline"
                style={cfUser ? { color: rankColor } : undefined}
              >
                {authUser.displayName || 'Signed in'}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-800 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              disabled={authBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1B1917] text-stone-800 dark:text-stone-200 hover:border-rose-400 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>{authBusy ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>
      </section>

      {authError && <p className="text-xs text-rose-600 dark:text-rose-400">{authError}</p>}

      {/* Inline Handle Switcher */}
      {editingHandle && cfUser && (
        <form onSubmit={handleLinkSubmit} className="flex items-center gap-2 max-w-sm">
          <input
            type="text"
            value={draftHandle}
            onChange={(e) => setDraftHandle(e.target.value)}
            placeholder="Codeforces handle..."
            className="flex-1 px-3.5 py-2 text-xs bg-white dark:bg-[#1B1917] border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button
            type="submit"
            disabled={loadingHandle || !draftHandle.trim()}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 disabled:opacity-50"
          >
            Switch
          </button>
        </form>
      )}

      {/* ==================== MINI DASHBOARD (2x2 PERSONAL PULSE) ==================== */}
      <section aria-label="Personal Overview" className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* 1. Weak Topics Pulse */}
        <div className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h2 className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                Top Weak Topics
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('topics')}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-0.5"
            >
              Diagnose <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {!cfUser ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center my-auto">
              Link your handle to detect weak &amp; uncovered topics.
            </p>
          ) : topWeakTopics.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center my-auto">
              No high-friction topics detected in this timeframe.
            </p>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800/80 my-auto">
              {topWeakTopics.map((t) => (
                <div
                  key={t.tag}
                  className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 capitalize truncate">
                      {t.tag}
                    </p>
                    <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 tabular-nums">
                      {t.solvedCount === 0 ? 'Uncovered core topic' : `${t.solvedCount} AC · ${t.struggleScore}% friction`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPracticeTopic(t.tag)}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0"
                  >
                    Train →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Leftover Things Pulse */}
        <div className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h2 className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                Leftover Problems ({activeLeftovers.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('leftovers')}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-0.5"
            >
              Open Queue <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {!cfUser ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center my-auto">
              Unfinished attempted problems and contest upsolves appear here.
            </p>
          ) : activeLeftovers.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center my-auto">
              Clean slate — zero unresolved attempted problems right now.
            </p>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800/80 my-auto">
              {activeLeftovers.slice(0, 3).map((p) => (
                <div
                  key={p.key}
                  className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-stone-900 dark:text-stone-100 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1 max-w-full"
                    >
                      <span className="font-mono text-stone-500 dark:text-stone-400 shrink-0">
                        {p.contestId ?? ''}
                        {p.index}
                      </span>
                      <span className="truncate">{p.name}</span>
                      <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                    </a>
                    <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 tabular-nums mt-0.5">
                      {p.attempts} failed {p.attempts === 1 ? 'try' : 'tries'} · {p.rating ?? 'Unrated'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('leftovers')}
                    className="text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 whitespace-nowrap shrink-0"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. My Stats Mini Card */}
        <div className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h2 className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                My Stats
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('stats')}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-0.5"
            >
              Details <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {!cfUser ? (
            <form onSubmit={handleLinkSubmit} className="space-y-2.5 my-auto">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Enter your Codeforces handle to load your rating and streak.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftHandle}
                  onChange={(e) => setDraftHandle(e.target.value)}
                  placeholder="Your handle..."
                  aria-label="Your Codeforces handle"
                  className="flex-1 min-w-0 px-3 py-2 text-xs bg-stone-50 dark:bg-[#141312] border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="submit"
                  disabled={loadingHandle || !draftHandle.trim()}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 shrink-0"
                >
                  {loadingHandle ? '...' : 'Link'}
                </button>
              </div>
              {handleError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{handleError}</p>
              )}
            </form>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-auto">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#141312]">
                <p className="text-[11px] text-stone-500 dark:text-stone-400">Rating</p>
                <p
                  className="font-mono text-xl font-bold tabular-nums mt-0.5"
                  style={{ color: rankColor }}
                >
                  {cfUser.rating ?? '—'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#141312]">
                <p className="text-[11px] text-stone-500 dark:text-stone-400">Solved</p>
                <p className="font-mono text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                  {analytics.uniqueSolved}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#141312]">
                <p className="text-[11px] text-stone-500 dark:text-stone-400">Streak</p>
                <p className="font-mono text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5 inline-flex items-center gap-1">
                  <Flame className="w-4 h-4 text-amber-500" />
                  {analytics.currentStreak}d
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#141312]">
                <p className="text-[11px] text-stone-500 dark:text-stone-400">Avg Diff</p>
                <p className="font-mono text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                  {analytics.avgSolvedRating ?? '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 4. Upcoming Contests Mini Card */}
        <div className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h2 className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                Upcoming Contests
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('rounds')}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-0.5"
            >
              All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {contestsLoading && upcomingRounds.length === 0 ? (
            <div className="space-y-2.5 my-auto">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-stone-100 dark:bg-stone-800/60 animate-pulse"
                />
              ))}
            </div>
          ) : upcomingRounds.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center my-auto">
              No upcoming Codeforces contests scheduled right now.
            </p>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800/80 my-auto">
              {upcomingRounds.map((c) => {
                const rsvps = rsvpsByContest[String(c.id)] ?? [];
                const isPlanned = authUser
                  ? rsvps.some((r) => r.userId === authUser.uid)
                  : false;
                const isLive = c.phase === 'CODING';
                const targetSec = isLive
                  ? (c.startTimeSeconds ?? nowSec) + c.durationSeconds
                  : c.startTimeSeconds ?? nowSec;

                return (
                  <div key={c.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <a
                        href={`https://codeforces.com/contests/${c.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-stone-900 dark:text-stone-100 hover:text-rose-600 dark:hover:text-rose-400 truncate block"
                      >
                        {c.name}
                      </a>
                      <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 tabular-nums mt-0.5">
                        {isLive ? `Live · ${formatCountdown(targetSec, nowSec)}` : `Starts in ${formatCountdown(targetSec, nowSec)}`}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={busyContestId === c.id}
                      onClick={() => void handleRsvpClick(c.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors shrink-0 ${
                        isPlanned
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      {isPlanned && <Check className="w-3 h-3" />}
                      {isPlanned ? 'Planned' : 'Plan'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ==================== DETAILED TRAINING MENU BELOW ==================== */}
      <section aria-label="Training Menu" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-stone-500 dark:text-stone-400">
            Focus Workspaces
          </h2>
          {savedCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('questions')}
              className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
            >
              <Bookmark className="w-3.5 h-3.5 fill-current" />
              <span>{savedCount} bookmarked to solve</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {primaryMenuItems.map(({ key, title, subtitle, stat, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onNavigateTab(key)}
              className="group text-left bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 hover:border-rose-400 dark:hover:border-rose-600 rounded-2xl p-5 transition-colors flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-colors shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-rose-500 transition-colors shrink-0 mt-1" />
              </div>

              <div>
                <h3 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                  {title}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                  {subtitle}
                </p>
                <p className="text-[11px] font-mono text-stone-400 dark:text-stone-500 mt-2.5 tabular-nums">
                  {stat}
                </p>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {secondaryMenuItems.map(({ key, title, subtitle, stat, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onNavigateTab(key)}
              className="group text-left bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 hover:border-rose-300 dark:hover:border-rose-700 rounded-2xl p-5 transition-colors flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 group-hover:bg-rose-50 dark:group-hover:bg-rose-950/40 text-stone-700 dark:text-stone-200 group-hover:text-rose-600 dark:group-hover:text-rose-400 flex items-center justify-center transition-colors shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                    {title}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                    {subtitle}
                  </p>
                  <p className="text-[11px] font-mono text-stone-400 dark:text-stone-500 mt-1 tabular-nums">
                    {stat}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-rose-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
