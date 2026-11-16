import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  ListChecks,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import type {
  BookmarkStatus,
  CFBundle,
  CFProblemsetPayload,
  CFSubmission,
  ProblemBookmark,
  StuckProblem,
} from '../types/codeforces';
import {
  fetchCodeforcesProblemset,
  getCachedProblemset,
} from '../services/codeforcesApi';
import {
  computeContestUpsolves,
  formatVerdictShort,
  getProblemKey,
  getProblemUrl,
  getRankColor,
} from '../utils/analytics';

interface LeftoversViewProps {
  bundle: CFBundle;
  stuckProblems: StuckProblem[];
  submissions: CFSubmission[];
  bookmarks: ProblemBookmark[];
  selectedTopic: string | null;
  loading: boolean;
  onSelectTopic: (tag: string | null) => void;
  onToggleBookmark: (problem: {
    problemKey: string;
    contestId: number;
    index: string;
    name: string;
    rating?: number;
    status: BookmarkStatus;
  }) => Promise<void>;
  onPracticeLeftovers?: () => void;
}

type LeftoverTab = 'stuck' | 'upsolves' | 'log';
type StuckSortKey = 'attempts' | 'recent' | 'rating_asc' | 'rating_desc';

export const LeftoversView: React.FC<LeftoversViewProps> = ({
  bundle,
  stuckProblems,
  submissions,
  bookmarks,
  selectedTopic,
  loading,
  onSelectTopic,
  onToggleBookmark,
  onPracticeLeftovers,
}) => {
  const [activeTab, setActiveTab] = useState<LeftoverTab>('stuck');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<StuckSortKey>('attempts');
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState<
    'ALL' | 'OK' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'OTHER'
  >('ALL');
  const [pageSize, setPageSize] = useState(25);

  const [problemset, setProblemset] = useState<CFProblemsetPayload | null>(() =>
    getCachedProblemset()
  );
  const [problemsetLoading, setProblemsetLoading] = useState(false);
  const [problemsetError, setProblemsetError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadProblemset = async (forceRefresh = false) => {
    setProblemsetLoading(true);
    setProblemsetError(null);
    try {
      const payload = await fetchCodeforcesProblemset(forceRefresh);
      setProblemset(payload);
    } catch (err) {
      setProblemsetError(
        err instanceof Error ? err.message : 'Could not fetch Codeforces problemset.'
      );
    } finally {
      setProblemsetLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'upsolves' && !problemset && !problemsetLoading) {
      void loadProblemset(false);
    }
  }, [activeTab, problemset, problemsetLoading]);

  const bookmarkMap = useMemo(() => {
    const map = new Map<string, BookmarkStatus>();
    for (const b of bookmarks) {
      map.set(b.problemKey, b.status);
    }
    return map;
  }, [bookmarks]);

  const snoozedCount = useMemo(() => {
    return stuckProblems.filter((p) => bookmarkMap.get(p.key) === 'snoozed').length;
  }, [stuckProblems, bookmarkMap]);

  const filteredStuck = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = stuckProblems.filter((p) => {
      const status = bookmarkMap.get(p.key);
      if (!showSnoozed && status === 'snoozed') return false;
      if (showSnoozed && status !== 'snoozed') return false;
      if (selectedTopic && !p.tags.includes(selectedTopic)) return false;
      if (q) {
        const idStr = `${p.contestId ?? ''}${p.index}`.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !idStr.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return b.lastAttemptAt - a.lastAttemptAt;
        case 'rating_asc':
          return (a.rating ?? 9999) - (b.rating ?? 9999) || b.attempts - a.attempts;
        case 'rating_desc':
          return (b.rating ?? 0) - (a.rating ?? 0) || b.attempts - a.attempts;
        case 'attempts':
        default:
          return b.attempts - a.attempts || b.lastAttemptAt - a.lastAttemptAt;
      }
    });
  }, [stuckProblems, bookmarkMap, showSnoozed, selectedTopic, searchQuery, sortBy]);

  const contestUpsolves = useMemo(() => {
    if (!problemset) return [];
    const raw = computeContestUpsolves(bundle, problemset, 14);
    const q = searchQuery.trim().toLowerCase();
    return raw
      .map((group) => ({
        ...group,
        upsolveCandidates: group.upsolveCandidates.filter((c) => {
          if (selectedTopic && !c.tags.includes(selectedTopic)) return false;
          if (q) {
            const idStr = `${c.contestId}${c.index}`.toLowerCase();
            if (
              !c.name.toLowerCase().includes(q) &&
              !idStr.includes(q) &&
              !group.contestName.toLowerCase().includes(q)
            ) {
              return false;
            }
          }
          return true;
        }),
      }))
      .filter((g) => g.upsolveCandidates.length > 0);
  }, [bundle, problemset, searchQuery, selectedTopic]);

  const filteredLog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((s) => {
      if (selectedTopic && !(s.problem.tags ?? []).includes(selectedTopic)) return false;
      if (verdictFilter === 'OK' && s.verdict !== 'OK') return false;
      if (verdictFilter === 'WRONG_ANSWER' && s.verdict !== 'WRONG_ANSWER') return false;
      if (verdictFilter === 'TIME_LIMIT_EXCEEDED' && s.verdict !== 'TIME_LIMIT_EXCEEDED') return false;
      if (
        verdictFilter === 'OTHER' &&
        (s.verdict === 'OK' || s.verdict === 'WRONG_ANSWER' || s.verdict === 'TIME_LIMIT_EXCEEDED')
      ) {
        return false;
      }
      if (q) {
        const idStr = `${s.problem.contestId ?? ''}${s.problem.index}`.toLowerCase();
        if (!s.problem.name.toLowerCase().includes(q) && !idStr.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, selectedTopic, verdictFilter, searchQuery]);

  const getVerdictColor = (tone: 'success' | 'danger' | 'warning' | 'neutral') => {
    switch (tone) {
      case 'success':
        return 'text-emerald-700 dark:text-emerald-400';
      case 'danger':
        return 'text-rose-700 dark:text-rose-400';
      case 'warning':
        return 'text-amber-700 dark:text-amber-400';
      default:
        return 'text-stone-600 dark:text-stone-400';
    }
  };

  const handleAction = async (params: {
    problemKey: string;
    contestId: number;
    index: string;
    name: string;
    rating?: number;
    status: BookmarkStatus;
  }) => {
    setBusyKey(params.problemKey);
    try {
      await onToggleBookmark(params);
    } finally {
      setBusyKey(null);
    }
  };

  const activeStuckCount = stuckProblems.length - snoozedCount;

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <section className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
            <ListChecks className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              Leftover Things &amp; Upsolves
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
              {activeStuckCount} unfinished {activeStuckCount === 1 ? 'problem' : 'problems'} with failed attempts · {snoozedCount} snoozed · Recent contest upsolves &amp; submission ledger
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onPracticeLeftovers && activeStuckCount > 0 && (
            <button
              type="button"
              onClick={onPracticeLeftovers}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Retry in Practice Queue</span>
            </button>
          )}
        </div>
      </section>

      {/* Main Workspace */}
      <section className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              aria-label="Leftover views"
              className="inline-flex items-center p-1 bg-stone-100 dark:bg-[#141210] border border-stone-200 dark:border-stone-800 rounded-xl"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'stuck'}
                onClick={() => setActiveTab('stuck')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'stuck'
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Unfinished Attempts ({activeStuckCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'upsolves'}
                onClick={() => setActiveTab('upsolves')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'upsolves'
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Contest Upsolves
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'log'}
                onClick={() => setActiveTab('log')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'log'
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Submission Ledger ({filteredLog.length})
              </button>
            </div>

            {selectedTopic && (
              <button
                type="button"
                onClick={() => onSelectTopic(null)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0"
              >
                Topic: {selectedTopic}
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'stuck' && (
              <>
                <select
                  aria-label="Sort unfinished problems"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as StuckSortKey)}
                  className="px-2.5 py-1.5 text-xs bg-stone-50 dark:bg-[#141210] border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="attempts">Most Failed Tries</option>
                  <option value="recent">Most Recent</option>
                  <option value="rating_asc">Easiest First</option>
                  <option value="rating_desc">Hardest First</option>
                </select>

                {snoozedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSnoozed((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                      showSnoozed
                        ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    {showSnoozed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>Snoozed ({snoozedCount})</span>
                  </button>
                )}
              </>
            )}

            {activeTab === 'log' && (
              <div
                role="group"
                aria-label="Filter submissions by verdict"
                className="inline-flex items-center p-1 bg-stone-100 dark:bg-[#141210] border border-stone-200 dark:border-stone-800 rounded-xl"
              >
                {[
                  { key: 'ALL', label: 'All' },
                  { key: 'OK', label: 'AC' },
                  { key: 'WRONG_ANSWER', label: 'WA' },
                  { key: 'TIME_LIMIT_EXCEEDED', label: 'TLE' },
                  { key: 'OTHER', label: 'Other' },
                ].map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setVerdictFilter(v.key as typeof verdictFilter)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      verdictFilter === v.key
                        ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'upsolves' && (
              <button
                type="button"
                onClick={() => void loadProblemset(true)}
                disabled={problemsetLoading}
                aria-label="Refresh problemset for upsolves"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${problemsetLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            )}

            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter problem name or ID..."
                aria-label="Filter problems or submissions"
                className="w-52 sm:w-56 pl-8 pr-3 py-1.5 text-xs bg-stone-50 dark:bg-[#141210] border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>

        {/* ==================== TAB 1: UNFINISHED ATTEMPTS ==================== */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-10 rounded-lg bg-stone-100 dark:bg-stone-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : activeTab === 'stuck' ? (
          filteredStuck.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl text-sm text-stone-500 dark:text-stone-400 space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
              <p>
                {showSnoozed
                  ? 'No snoozed problems found.'
                  : selectedTopic
                  ? `No unresolved problems found for topic "${selectedTopic}" in this timeframe.`
                  : 'Zero unfinished attempted problems left in this timeframe!'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                    <th className="py-2.5 pr-4 font-medium">Problem</th>
                    <th className="py-2.5 px-3 font-medium">Topics</th>
                    <th className="py-2.5 px-3 text-right font-medium">Rating</th>
                    <th className="py-2.5 px-3 text-right font-medium">Failed Tries</th>
                    <th className="py-2.5 px-3 font-medium">Last Verdict</th>
                    <th className="py-2.5 px-3 text-right font-medium">Last Attempt</th>
                    <th className="py-2.5 pl-3 text-right font-medium">Queue Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                  {filteredStuck.slice(0, pageSize).map((p) => {
                    const vInfo = formatVerdictShort(p.lastVerdict);
                    const bStatus = bookmarkMap.get(p.key);
                    const isSaved = bStatus === 'saved';
                    const isSnoozed = bStatus === 'snoozed';
                    const hasCid = typeof p.contestId === 'number' && p.contestId > 0;

                    return (
                      <tr
                        key={p.key}
                        className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors h-11"
                      >
                        <td className="py-2 pr-4 font-medium text-stone-900 dark:text-stone-100">
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 hover:text-rose-600 dark:hover:text-rose-400"
                          >
                            <span className="font-mono text-stone-500 dark:text-stone-400">
                              {p.contestId ?? ''}
                              {p.index}
                            </span>
                            <span>{p.name}</span>
                            <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                          </a>
                        </td>
                        <td className="py-2 px-3 text-stone-500 dark:text-stone-400 max-w-[230px] truncate">
                          {p.tags.length > 0 ? p.tags.slice(0, 3).join(' · ') : 'untagged'}
                        </td>
                        <td
                          className="py-2 px-3 text-right font-mono font-semibold tabular-nums"
                          style={{ color: p.rating ? getRankColor(p.rating) : undefined }}
                        >
                          {p.rating ?? '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-stone-800 dark:text-stone-200">
                          {p.attempts}
                        </td>
                        <td className={`py-2 px-3 font-medium whitespace-nowrap ${getVerdictColor(vInfo.tone)}`}>
                          {vInfo.label}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-stone-500 dark:text-stone-400 whitespace-nowrap">
                          {new Date(p.lastAttemptAt * 1000).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-2 pl-3 text-right whitespace-nowrap">
                          {hasCid && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={busyKey === p.key}
                                onClick={() =>
                                  void handleAction({
                                    problemKey: p.key,
                                    contestId: p.contestId!,
                                    index: p.index,
                                    name: p.name,
                                    rating: p.rating,
                                    status: 'saved',
                                  })
                                }
                                title={isSaved ? 'Remove from Saved Queue' : 'Save to Practice Queue'}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                                  isSaved
                                    ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                    : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-rose-400'
                                }`}
                              >
                                <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
                                <span>{isSaved ? 'Saved' : 'Save'}</span>
                              </button>

                              <button
                                type="button"
                                disabled={busyKey === p.key}
                                onClick={() =>
                                  void handleAction({
                                    problemKey: p.key,
                                    contestId: p.contestId!,
                                    index: p.index,
                                    name: p.name,
                                    rating: p.rating,
                                    status: 'snoozed',
                                  })
                                }
                                title={isSnoozed ? 'Restore to active leftovers' : 'Snooze / hide from active leftovers'}
                                className="px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-[11px] font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                              >
                                {isSnoozed ? 'Restore' : 'Snooze'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'upsolves' ? (
          /* ==================== TAB 2: CONTEST UPSOLVES ==================== */
          problemsetError ? (
            <div className="py-10 text-center border border-dashed border-rose-200 dark:border-rose-900/60 rounded-xl">
              <p className="text-sm text-rose-700 dark:text-rose-300">{problemsetError}</p>
              <button
                type="button"
                onClick={() => void loadProblemset(true)}
                className="mt-3 px-4 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              >
                Retry Problemset Fetch
              </button>
            </div>
          ) : problemsetLoading && !problemset ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-stone-100 dark:bg-stone-800/60 animate-pulse"
                />
              ))}
            </div>
          ) : contestUpsolves.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl text-sm text-stone-500 dark:text-stone-400">
              {bundle.ratingHistory.length === 0
                ? 'Participate in rated Codeforces rounds to automatically track next-problem upsolves here.'
                : 'No pending contest upsolves matched your current filters.'}
            </div>
          ) : (
            <div className="space-y-3">
              {contestUpsolves.map((group) => {
                const delta = group.newRating - group.oldRating;
                return (
                  <div
                    key={group.contestId}
                    className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/60 dark:bg-[#141312]/70 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <a
                          href={`https://codeforces.com/contest/${group.contestId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-display text-sm font-bold text-stone-900 dark:text-stone-100 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5"
                        >
                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">{group.contestName}</span>
                        </a>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                          Rank #{group.rank} ·{' '}
                          <span
                            className={
                              delta >= 0
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-rose-600 dark:text-rose-400 font-semibold'
                            }
                          >
                            {delta >= 0 ? `+${delta}` : delta}
                          </span>{' '}
                          · Solved:{' '}
                          {group.solvedIndices.length > 0
                            ? group.solvedIndices.join(', ')
                            : 'None yet'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {group.upsolveCandidates.map((cand) => {
                        const isSaved = bookmarkMap.get(cand.key) === 'saved';
                        return (
                          <div
                            key={cand.key}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800"
                          >
                            <div className="min-w-0">
                              <a
                                href={cand.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-stone-900 dark:text-stone-100 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 max-w-full"
                              >
                                <span className="font-mono text-stone-500 dark:text-stone-400 shrink-0">
                                  {cand.contestId}
                                  {cand.index}
                                </span>
                                <span className="truncate">{cand.name}</span>
                                <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                              </a>
                              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate tabular-nums">
                                <span
                                  className="font-mono font-semibold"
                                  style={{ color: cand.rating ? getRankColor(cand.rating) : undefined }}
                                >
                                  {cand.rating ?? 'Unrated'}
                                </span>
                                {cand.attempted && (
                                  <span className="text-amber-600 dark:text-amber-400"> · Tried</span>
                                )}
                                {cand.tags.length > 0 && ` · ${cand.tags.slice(0, 3).join(' · ')}`}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={busyKey === cand.key}
                              onClick={() =>
                                void handleAction({
                                  problemKey: cand.key,
                                  contestId: cand.contestId,
                                  index: cand.index,
                                  name: cand.name,
                                  rating: cand.rating,
                                  status: 'saved',
                                })
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium shrink-0 transition-colors ${
                                isSaved
                                  ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                  : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-rose-400'
                              }`}
                            >
                              <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
                              <span>{isSaved ? 'Saved' : 'Save'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredLog.length === 0 ? (
          /* ==================== TAB 3: SUBMISSION LEDGER ==================== */
          <div className="py-12 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl text-sm text-stone-500 dark:text-stone-400">
            No matching submissions in this timeframe.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <th className="py-2.5 pr-4 font-medium">When</th>
                  <th className="py-2.5 px-3 font-medium">Problem</th>
                  <th className="py-2.5 px-3 font-medium">Topics</th>
                  <th className="py-2.5 px-3 text-right font-medium">Rating</th>
                  <th className="py-2.5 px-3 font-medium">Verdict</th>
                  <th className="py-2.5 px-3 font-medium">Language</th>
                  <th className="py-2.5 pl-3 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {filteredLog.slice(0, pageSize).map((s) => {
                  const vInfo = formatVerdictShort(s.verdict);
                  const key = getProblemKey(s.problem);
                  return (
                    <tr
                      key={`${s.id}-${key}`}
                      className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors h-10"
                    >
                      <td className="py-2 pr-4 font-mono tabular-nums text-stone-500 dark:text-stone-400 whitespace-nowrap">
                        {new Date(s.creationTimeSeconds * 1000).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 px-3 font-medium text-stone-900 dark:text-stone-100">
                        <a
                          href={getProblemUrl(s.problem)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 hover:text-rose-600 dark:hover:text-rose-400"
                        >
                          <span className="font-mono text-stone-500 dark:text-stone-400">
                            {s.problem.contestId ?? ''}
                            {s.problem.index}
                          </span>
                          <span>{s.problem.name}</span>
                          <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                        </a>
                      </td>
                      <td className="py-2 px-3 text-stone-500 dark:text-stone-400 max-w-[240px] truncate">
                        {s.problem.tags?.length ? s.problem.tags.slice(0, 3).join(' · ') : 'untagged'}
                      </td>
                      <td
                        className="py-2 px-3 text-right font-mono font-semibold tabular-nums"
                        style={{
                          color: s.problem.rating ? getRankColor(s.problem.rating) : undefined,
                        }}
                      >
                        {s.problem.rating ?? '—'}
                      </td>
                      <td className={`py-2 px-3 font-medium whitespace-nowrap ${getVerdictColor(vInfo.tone)}`}>
                        {vInfo.label}
                      </td>
                      <td className="py-2 px-3 text-stone-500 dark:text-stone-400 whitespace-nowrap">
                        {s.programmingLanguage}
                      </td>
                      <td className="py-2 pl-3 text-right font-mono tabular-nums text-stone-500 dark:text-stone-400 whitespace-nowrap">
                        {s.timeConsumedMillis} ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Show more pagination */}
        {!loading &&
          ((activeTab === 'stuck' && filteredStuck.length > pageSize) ||
            (activeTab === 'log' && filteredLog.length > pageSize)) && (
            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex justify-center">
              <button
                type="button"
                onClick={() => setPageSize((prev) => prev + 25)}
                className="px-4 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Show 25 more
              </button>
            </div>
          )}
      </section>
    </div>
  );
};
