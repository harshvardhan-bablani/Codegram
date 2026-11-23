import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dices,
  ExternalLink,
  RefreshCw,
  Search,
  Shuffle,
  X,
} from 'lucide-react';
import type {
  BookmarkStatus,
  CFBundle,
  CFProblemsetPayload,
  DifficultyBandKey,
  FocusModeKey,
  ProblemBookmark,
  SuggestedProblem,
  TimeframeKey,
  TopicStats,
} from '../types/codeforces';
import {
  fetchCodeforcesProblemset,
  getCachedProblemset,
} from '../services/codeforcesApi';
import {
  computeTopicPracticeProfile,
  generateSuggestedProblems,
  getProblemKey,
  getProblemUrl,
  getRankColor,
} from '../utils/analytics';

export type PracticeSubTab = 'problems' | 'topics';

interface SuggestedProblemsViewProps {
  bundle: CFBundle;
  timeframeTopicStats: TopicStats[];
  timeframe: TimeframeKey;
  selectedTopic: string | null;
  bookmarks: ProblemBookmark[];
  initialFocusMode?: FocusModeKey;
  subTab: PracticeSubTab;
  loadingAnalytics?: boolean;
  onChangeSubTab: (tab: PracticeSubTab) => void;
  onChangeTimeframe: (tf: TimeframeKey) => void;
  onSelectTopic: (tag: string | null) => void;
  onToggleBookmark: (problem: {
    problemKey: string;
    contestId: number;
    index: string;
    name: string;
    rating?: number;
    status: BookmarkStatus;
  }) => Promise<void>;
}

const DIFFICULTY_BANDS: { key: DifficultyBandKey; label: string; hint: string }[] = [
  { key: 'consolidate', label: 'Warmup', hint: 'Comfort zone (-100 to current level)' },
  { key: 'sweet_spot', label: 'Sweet Spot', hint: 'Best growth zone (current level to +200)' },
  { key: 'stretch', label: 'Challenge', hint: 'Harder stretch (+200 to +400)' },
];

const FOCUS_MODES: { key: FocusModeKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'weak', label: 'Weak' },
  { key: 'underexplored', label: 'New' },
];

const TIMEFRAMES: { key: TimeframeKey; label: string }[] = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All' },
];

export const SuggestedProblemsView: React.FC<SuggestedProblemsViewProps> = ({
  bundle,
  timeframeTopicStats,
  timeframe,
  selectedTopic,
  bookmarks,
  initialFocusMode = 'all',
  loadingAnalytics = false,
  onChangeTimeframe,
  onSelectTopic,
  onToggleBookmark,
}) => {
  const [problemset, setProblemset] = useState<CFProblemsetPayload | null>(() =>
    getCachedProblemset()
  );
  const [loading, setLoading] = useState<boolean>(() => !getCachedProblemset());
  const [error, setError] = useState<string | null>(null);

  const [difficultyBand, setDifficultyBand] = useState<DifficultyBandKey>('sweet_spot');
  const [focusMode, setFocusMode] = useState<FocusModeKey>(initialFocusMode);
  const [showSavedOnly, setShowSavedOnly] = useState<boolean>(false);
  const [pageOffset, setPageOffset] = useState<number>(0);
  const [pickedProblem, setPickedProblem] = useState<SuggestedProblem | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [showAllTopics, setShowAllTopics] = useState<boolean>(false);
  const [topicSearch, setTopicSearch] = useState<string>('');

  useEffect(() => {
    setFocusMode(initialFocusMode);
  }, [initialFocusMode]);

  const loadProblemset = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchCodeforcesProblemset(forceRefresh);
      setProblemset(payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load official Codeforces problemset.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!problemset) {
      void loadProblemset(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPageOffset(0);
    setPickedProblem(null);
  }, [bundle.user.handle, difficultyBand, focusMode, selectedTopic, showSavedOnly]);

  const profile = useMemo(
    () => computeTopicPracticeProfile(bundle, timeframeTopicStats),
    [bundle, timeframeTopicStats]
  );

  const solvedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of bundle.submissions) {
      if (s.verdict === 'OK') set.add(getProblemKey(s.problem));
    }
    return set;
  }, [bundle.submissions]);

  const savedBookmarks = useMemo(
    () => bookmarks.filter((b) => b.status === 'saved'),
    [bookmarks]
  );

  const bookmarkStatusMap = useMemo(() => {
    const map = new Map<string, BookmarkStatus>();
    for (const b of bookmarks) map.set(b.problemKey, b.status);
    return map;
  }, [bookmarks]);

  const { suggestions, totalMatching, ratingRange } = useMemo(() => {
    if (!problemset) {
      return {
        suggestions: [],
        totalMatching: 0,
        ratingRange: [profile.estimatedLevel, profile.estimatedLevel + 200] as [number, number],
      };
    }
    const result = generateSuggestedProblems({
      bundle,
      problemset,
      profile,
      difficultyBand,
      focusMode,
      filterTopic: selectedTopic,
      pageOffset,
      limit: 20,
    });
    const snoozedFiltered = result.suggestions.filter(
      (s) => bookmarkStatusMap.get(s.key) !== 'snoozed'
    );
    return {
      ...result,
      suggestions: snoozedFiltered,
    };
  }, [
    bundle,
    problemset,
    profile,
    difficultyBand,
    focusMode,
    selectedTopic,
    pageOffset,
    bookmarkStatusMap,
  ]);

  const { orderedTopics } = useMemo(() => {
    const q = topicSearch.trim().toLowerCase();
    const sorted = [...timeframeTopicStats].sort(
      (a, b) =>
        b.struggleScore - a.struggleScore ||
        b.unsolvedProblems - a.unsolvedProblems ||
        a.attemptedProblems - b.attemptedProblems
    );
    const filtered = q ? sorted.filter((t) => t.tag.toLowerCase().includes(q)) : sorted;
    return { orderedTopics: filtered };
  }, [timeframeTopicStats, topicSearch]);

  const displayedTopics = showAllTopics ? orderedTopics : orderedTopics.slice(0, 7);

  const handlePickOne = () => {
    if (suggestions.length === 0) return;
    const pool = suggestions.slice(0, Math.min(8, suggestions.length));
    const idx = Math.floor(Math.random() * pool.length);
    setPickedProblem(pool[idx]);
  };

  const handleBookmarkClick = async (params: {
    problemKey: string;
    contestId: number;
    index: string;
    name: string;
    rating?: number;
  }) => {
    setBusyKey(params.problemKey);
    try {
      await onToggleBookmark({ ...params, status: 'saved' });
    } finally {
      setBusyKey(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalMatching / 20));
  const currentPage = (pageOffset % totalPages) + 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
      {/* PANEL 1: WEAK TOPICS RAIL */}
      <section
        id="weak-topics-panel"
        aria-label="Weak Topics"
        className="lg:col-span-4 bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              Weak Topics
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Select a topic to filter
            </p>
          </div>

          <select
            aria-label="Topics timeframe"
            value={timeframe}
            onChange={(e) => onChangeTimeframe(e.target.value as TimeframeKey)}
            className="px-2.5 py-1 text-xs font-medium bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf.key} value={tf.key}>
                {tf.label}
              </option>
            ))}
          </select>
        </div>

        {showAllTopics && (
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              placeholder="Filter topics..."
              aria-label="Filter topics"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {loadingAnalytics ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : displayedTopics.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No topic data in this timeframe.
          </p>
        ) : (
          <div className="space-y-1">
            {displayedTopics.map((t) => {
              const uncovered = Boolean(t.isUncovered || t.attemptedProblems === 0);
              const isSelected = selectedTopic === t.tag;
              const solvePct = uncovered
                ? 0
                : Math.round((t.solvedProblems / Math.max(1, t.attemptedProblems)) * 100);
              const barColor =
                t.unsolvedProblems === 0
                  ? 'bg-emerald-500'
                  : solvePct >= 50
                    ? 'bg-[#0047CC] dark:bg-blue-500'
                    : 'bg-amber-500';

              return (
                <button
                  key={t.tag}
                  type="button"
                  title={
                    uncovered
                      ? '0 attempts'
                      : `${t.solvedProblems} solved of ${t.attemptedProblems} attempted · ${t.avgAttemptsToAc.toFixed(1)} avg tries`
                  }
                  onClick={() => {
                    setShowSavedOnly(false);
                    onSelectTopic(isSelected ? null : t.tag);
                  }}
                  className={`w-full text-left py-2 px-2.5 -mx-2.5 rounded-xl transition-colors ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs sm:text-[13px] font-medium capitalize truncate ${
                        isSelected
                          ? 'font-semibold text-[#0047CC] dark:text-blue-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {t.tag}
                    </span>
                    <span
                      className={`font-mono text-[11px] tabular-nums shrink-0 ${
                        uncovered
                          ? 'text-rose-500 dark:text-rose-400'
                          : t.unsolvedProblems > 0
                            ? 'text-slate-600 dark:text-slate-300'
                            : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {uncovered ? 'Untried' : `${t.solvedProblems}/${t.attemptedProblems}`}
                    </span>
                  </div>

                  <div className="mt-1.5 h-1 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {uncovered ? (
                      <div className="h-full w-1/4 rounded-full bg-rose-300/80 dark:bg-rose-800/70" />
                    ) : (
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${Math.max(8, solvePct)}%` }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {orderedTopics.length > 7 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setShowAllTopics((prev) => !prev);
                setTopicSearch('');
              }}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-[#0047CC] dark:hover:text-blue-400 transition-colors"
            >
              {showAllTopics ? 'Show fewer' : `Show all ${orderedTopics.length} topics`}
            </button>
          </div>
        )}
      </section>

      {/* PANEL 2: RECOMMENDED PROBLEMS */}
      <section
        id="recommended-problems-panel"
        aria-label="Recommended Problems"
        className="lg:col-span-8 bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              {showSavedOnly ? 'Saved Problems' : 'Recommended Problems'}
            </h2>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {showSavedOnly
                ? `${savedBookmarks.length} saved`
                : `${ratingRange[0]}–${ratingRange[1]}${
                    !loading ? ` · ${totalMatching.toLocaleString()} matching` : ''
                  }`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePickOne}
              disabled={loading || suggestions.length === 0 || showSavedOnly}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Pick One</span>
            </button>

            <button
              type="button"
              onClick={() => void loadProblemset(true)}
              disabled={loading}
              title="Refresh Codeforces problemset"
              aria-label="Refresh Codeforces problemset"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Clean Single Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {!showSavedOnly ? (
            <div
              role="group"
              aria-label="Difficulty"
              className="max-w-full overflow-x-auto no-scrollbar inline-flex items-center p-0.5 bg-slate-100 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-800 rounded-xl"
            >
              {DIFFICULTY_BANDS.map((band) => {
                const dotColor =
                  band.key === 'consolidate'
                    ? 'bg-emerald-500'
                    : band.key === 'sweet_spot'
                      ? 'bg-[#0047CC] dark:bg-blue-400'
                      : 'bg-violet-500';
                return (
                  <button
                    key={band.key}
                    type="button"
                    title={band.hint}
                    onClick={() => setDifficultyBand(band.key)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      difficultyBand === band.key
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
                    <span>{band.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {selectedTopic && !showSavedOnly && (
              <button
                type="button"
                onClick={() => onSelectTopic(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#0047CC] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors capitalize whitespace-nowrap shrink-0"
              >
                <span>{selectedTopic}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {!showSavedOnly && (
              <select
                aria-label="Problem focus"
                value={focusMode}
                onChange={(e) => setFocusMode(e.target.value as FocusModeKey)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
              >
                {FOCUS_MODES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.key === 'all'
                      ? 'All topics'
                      : m.key === 'weak'
                        ? 'Weak topics'
                        : 'New topics'}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setShowSavedOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                showSavedOnly
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${showSavedOnly ? 'fill-current' : ''}`} />
              <span>Saved ({savedBookmarks.length})</span>
            </button>
          </div>
        </div>

        {/* Spotlight Pick */}
        {pickedProblem && !showSavedOnly && (
          <div className="p-3.5 sm:p-4 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/50 dark:from-blue-950/40 dark:via-[#121824] dark:to-indigo-950/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-100/90 dark:bg-blue-900/50 text-[#0047CC] dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                <Dices className="w-4 h-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {pickedProblem.contestId}
                    {pickedProblem.index}
                  </span>
                  <span className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    {pickedProblem.name}
                  </span>
                  <span
                    className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums"
                    style={{
                      color: getRankColor(pickedProblem.rating),
                      backgroundColor: `${getRankColor(pickedProblem.rating)}16`,
                    }}
                  >
                    {pickedProblem.rating}
                  </span>
                </div>
                {pickedProblem.tags.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {pickedProblem.tags.slice(0, 3).join(' · ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={pickedProblem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white whitespace-nowrap"
              >
                <span>Solve</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={handlePickOne}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-blue-200 dark:border-blue-800 text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800/70 whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Another</span>
              </button>
              <button
                type="button"
                onClick={() => setPickedProblem(null)}
                aria-label="Dismiss picked problem"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Problem List */}
        {showSavedOnly ? (
          savedBookmarks.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400">
              No saved problems yet. Bookmark any problem to keep it here.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {savedBookmarks.map((b) => {
                const isSolved = solvedKeys.has(b.problemKey);
                const url = getProblemUrl({
                  contestId: b.contestId,
                  index: b.index,
                  name: b.name,
                  type: 'PROGRAMMING',
                  tags: [],
                });
                const ratingColor = b.rating ? getRankColor(b.rating) : undefined;
                return (
                  <div
                    key={b.problemKey}
                    className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex items-baseline gap-2.5 flex-wrap">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500 w-12 shrink-0 tabular-nums">
                        {b.contestId}
                        {b.index}
                      </span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-[#0047CC] dark:hover:text-blue-400 truncate"
                      >
                        {b.name}
                      </a>
                      {isSolved && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          Solved
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {b.rating && ratingColor && (
                        <span
                          className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums"
                          style={{
                            color: ratingColor,
                            backgroundColor: `${ratingColor}16`,
                          }}
                        >
                          {b.rating}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={busyKey === b.problemKey}
                        onClick={() =>
                          void handleBookmarkClick({
                            problemKey: b.problemKey,
                            contestId: b.contestId,
                            index: b.index,
                            name: b.name,
                            rating: b.rating,
                          })
                        }
                        title="Remove saved problem"
                        aria-label="Remove saved problem"
                        className="text-xs font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-[#0047CC] text-[#0047CC] hover:text-white dark:bg-blue-950/45 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white transition-colors whitespace-nowrap"
                      >
                        <span>Solve</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : error ? (
          <div className="py-10 text-center border border-dashed border-red-200 dark:border-red-900/60 rounded-xl">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadProblemset(true)}
              className="mt-3 px-4 py-1.5 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {`No unsolved problems matched in ${ratingRange[0]}–${ratingRange[1]}.`}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2.5">
              {selectedTopic && (
                <button
                  type="button"
                  onClick={() => onSelectTopic(null)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Clear Topic
                </button>
              )}
              {focusMode !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFocusMode('all')}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-[#0047CC] text-white hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  Show All
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {suggestions.map((p) => {
                const isSaved = bookmarkStatusMap.get(p.key) === 'saved';
                const rankColor = getRankColor(p.rating);
                return (
                  <div
                    key={p.key}
                    className="py-2.5 sm:py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/25 sm:-mx-2 sm:px-2 rounded-xl transition-colors"
                  >
                    <div className="min-w-0 flex-1 flex items-baseline gap-2.5">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500 w-12 shrink-0 tabular-nums">
                        {p.contestId}
                        {p.index}
                      </span>
                      <div className="min-w-0 flex-1">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-[#0047CC] dark:hover:text-blue-400 truncate"
                        >
                          {p.name}
                        </a>
                        {p.tags.length > 0 && (
                          <div className="mt-1 hidden sm:flex items-center gap-1.5 flex-wrap">
                            {p.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded-md bg-slate-100/90 dark:bg-slate-800/80 text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums"
                        style={{
                          color: rankColor,
                          backgroundColor: `${rankColor}16`,
                        }}
                      >
                        {p.rating}
                      </span>

                      <button
                        type="button"
                        disabled={busyKey === p.key}
                        onClick={() =>
                          void handleBookmarkClick({
                            problemKey: p.key,
                            contestId: p.contestId,
                            index: p.index,
                            name: p.name,
                            rating: p.rating,
                          })
                        }
                        title={isSaved ? 'Remove bookmark' : 'Save problem'}
                        aria-label={isSaved ? 'Remove bookmark' : 'Save problem'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isSaved
                            ? 'text-[#0047CC] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                      </button>

                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-[#0047CC] text-[#0047CC] hover:text-white dark:bg-blue-950/45 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white transition-colors whitespace-nowrap"
                      >
                        <span>Solve</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalMatching > 20 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pageOffset === 0}
                    onClick={() => setPageOffset((prev) => Math.max(0, prev - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageOffset((prev) => prev + 1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span>Next 20</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
