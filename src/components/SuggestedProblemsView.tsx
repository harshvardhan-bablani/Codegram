import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Dices,
  ExternalLink,
  RefreshCw,
  Shuffle,
  Sparkles,
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
  TopicStats,
} from '../types/codeforces';
import {
  fetchCodeforcesProblemset,
  getCachedProblemset,
} from '../services/codeforcesApi';
import {
  computeTopicPracticeProfile,
  CORE_CF_TOPICS,
  generateSuggestedProblems,
  getProblemKey,
  getProblemUrl,
  getRankColor,
} from '../utils/analytics';

interface SuggestedProblemsViewProps {
  bundle: CFBundle;
  timeframeTopicStats: TopicStats[];
  selectedTopic: string | null;
  bookmarks: ProblemBookmark[];
  initialFocusMode?: FocusModeKey;
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
  { key: 'consolidate', label: 'Consolidate', hint: 'Level -100 to Level' },
  { key: 'sweet_spot', label: 'Sweet Spot', hint: 'Level to +200' },
  { key: 'stretch', label: 'Stretch', hint: 'Level +200 to +400' },
];

const FOCUS_MODES: { key: FocusModeKey; label: string }[] = [
  { key: 'all', label: 'All Focus' },
  { key: 'weak', label: 'Weak Topics' },
  { key: 'underexplored', label: 'Underexplored' },
  { key: 'leftovers', label: 'Retry Leftovers' },
];

export const SuggestedProblemsView: React.FC<SuggestedProblemsViewProps> = ({
  bundle,
  timeframeTopicStats,
  selectedTopic,
  bookmarks,
  initialFocusMode = 'all',
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

  const topicOptions = useMemo(() => {
    const set = new Set<string>(CORE_CF_TOPICS);
    for (const w of profile.weakTopics) set.add(w.tag);
    for (const u of profile.underexploredTopics) set.add(u.tag);
    if (selectedTopic) set.add(selectedTopic);
    return Array.from(set).sort();
  }, [profile, selectedTopic]);

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

  return (
    <div className="space-y-6">
      {/* Practice Level & Focus Profile */}
      <section className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
          <div>
            <h1 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              Personalized Practice Questions
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Unsolved problems matched to your live rating, weaker topics, underexplored core areas, and unfinished leftovers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
            <button
              type="button"
              onClick={handlePickOne}
              disabled={loading || suggestions.length === 0 || showSavedOnly}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Pick One For Me</span>
            </button>

            <button
              type="button"
              onClick={() => setPageOffset((prev) => prev + 1)}
              disabled={loading || totalMatching <= 20 || showSavedOnly}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Next Set</span>
            </button>

            <button
              type="button"
              onClick={() => void loadProblemset(true)}
              disabled={loading}
              title="Refresh Codeforces problemset"
              aria-label="Refresh Codeforces problemset"
              className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Spotlight Pick */}
        {pickedProblem && !showSavedOnly && (
          <div className="mb-5 p-4 rounded-2xl border border-rose-300 dark:border-rose-800/80 bg-rose-50/70 dark:bg-rose-950/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next Challenge Pick</span>
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-stone-500 dark:text-stone-400">
                  {pickedProblem.contestId}
                  {pickedProblem.index}
                </span>
                <span className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                  {pickedProblem.name}
                </span>
                <span
                  className="font-mono text-sm font-bold tabular-nums"
                  style={{ color: getRankColor(pickedProblem.rating) }}
                >
                  {pickedProblem.rating}
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300">
                {pickedProblem.reasonText} · {pickedProblem.tags.slice(0, 4).join(' · ')}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={pickedProblem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 whitespace-nowrap"
              >
                <span>Solve on CF</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setPickedProblem(null)}
                aria-label="Dismiss picked problem"
                className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 3-Column Profile Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* Estimated Level */}
          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/70 dark:bg-[#141210]/60">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Current Target Level
            </p>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span
                className="font-mono text-2xl font-bold tabular-nums"
                style={{ color: getRankColor(profile.estimatedLevel) }}
              >
                {profile.estimatedLevel}
              </span>
              <span className="text-xs font-mono text-stone-500 dark:text-stone-400 tabular-nums">
                Range {ratingRange[0]}–{ratingRange[1]}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
              {profile.levelSource}
            </p>
          </div>

          {/* Weak Topics */}
          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/70 dark:bg-[#141210]/60">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Weaker &amp; Uncovered Topics
            </p>
            {profile.weakTopics.length === 0 ? (
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                No high-struggle topics flagged yet.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.weakTopics.slice(0, 6).map((item) => {
                  const isActive = selectedTopic === item.tag;
                  return (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => {
                        setShowSavedOnly(false);
                        onSelectTopic(isActive ? null : item.tag);
                      }}
                      className={`px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors capitalize ${
                        isActive
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'bg-white dark:bg-[#1B1917] border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-rose-400'
                      }`}
                    >
                      {item.tag} · {item.solvedCount === 0 ? 'Uncovered' : `${item.solvedCount} AC`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Underexplored Topics */}
          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/70 dark:bg-[#141210]/60">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Underexplored Core Topics
            </p>
            {profile.underexploredTopics.length === 0 ? (
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                Solid coverage across all core topics.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.underexploredTopics.slice(0, 5).map((item) => {
                  const isActive = selectedTopic === item.tag;
                  return (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => {
                        setShowSavedOnly(false);
                        onSelectTopic(isActive ? null : item.tag);
                      }}
                      className={`px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors capitalize ${
                        isActive
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'bg-white dark:bg-[#1B1917] border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-rose-400'
                      }`}
                    >
                      {item.tag} · {item.solvedCount} AC
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-100 dark:border-stone-800/80">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Focus Mode */}
            <div
              role="group"
              aria-label="Topic focus mode"
              className="inline-flex flex-wrap items-center p-1 bg-stone-100 dark:bg-[#141210] border border-stone-200 dark:border-stone-800 rounded-xl"
            >
              {FOCUS_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setShowSavedOnly(false);
                    setFocusMode(m.key);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    !showSavedOnly && focusMode === m.key
                      ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Difficulty Band */}
            {!showSavedOnly && focusMode !== 'leftovers' && (
              <div
                role="group"
                aria-label="Difficulty band"
                className="inline-flex items-center p-1 bg-stone-100 dark:bg-[#141210] border border-stone-200 dark:border-stone-800 rounded-xl"
              >
                {DIFFICULTY_BANDS.map((band) => (
                  <button
                    key={band.key}
                    type="button"
                    title={band.hint}
                    onClick={() => setDifficultyBand(band.key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      difficultyBand === band.key
                        ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {band.label}
                  </button>
                ))}
              </div>
            )}

            {/* Saved Bookmarks Toggle */}
            <button
              type="button"
              onClick={() => setShowSavedOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                showSavedOnly
                  ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                  : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-rose-400'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${showSavedOnly ? 'fill-current' : ''}`} />
              <span>Saved ({savedBookmarks.length})</span>
            </button>
          </div>

          {!showSavedOnly && (
            <div className="flex items-center gap-2">
              <label htmlFor="suggested-topic-select" className="text-xs text-stone-500 dark:text-stone-400">
                Topic:
              </label>
              <select
                id="suggested-topic-select"
                value={selectedTopic ?? ''}
                onChange={(e) => onSelectTopic(e.target.value || null)}
                className="px-2.5 py-1.5 text-xs bg-stone-50 dark:bg-[#141210] border border-stone-200 dark:border-stone-700 rounded-xl text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500 capitalize"
              >
                <option value="">All Focus Topics</option>
                {topicOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              {selectedTopic && (
                <button
                  type="button"
                  onClick={() => onSelectTopic(null)}
                  aria-label="Clear topic filter"
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Recommendations or Saved Queue Table */}
      <section className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
            {showSavedOnly ? 'Saved Practice Queue' : 'Recommended Queue'}
          </h2>
          <span className="text-xs font-mono tabular-nums text-stone-500 dark:text-stone-400">
            {showSavedOnly
              ? `${savedBookmarks.length} saved`
              : loading
              ? 'Loading official problemset...'
              : `${suggestions.length} shown of ${totalMatching.toLocaleString()} matches`}
          </span>
        </div>

        {showSavedOnly ? (
          savedBookmarks.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl text-sm text-stone-500 dark:text-stone-400">
              No saved problems yet. Click Save on any recommended or leftover problem to build your short list.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                    <th className="py-2.5 pr-4 font-medium">Problem</th>
                    <th className="py-2.5 px-3 text-right font-medium">Rating</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                    <th className="py-2.5 pl-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                  {savedBookmarks.map((b) => {
                    const isSolved = solvedKeys.has(b.problemKey);
                    const url = getProblemUrl({
                      contestId: b.contestId,
                      index: b.index,
                      name: b.name,
                      type: 'PROGRAMMING',
                      tags: [],
                    });
                    return (
                      <tr
                        key={b.problemKey}
                        className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors h-11"
                      >
                        <td className="py-2 pr-4 font-medium text-stone-900 dark:text-stone-100">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 hover:text-rose-600 dark:hover:text-rose-400"
                          >
                            <span className="font-mono text-stone-500 dark:text-stone-400">
                              {b.contestId}
                              {b.index}
                            </span>
                            <span>{b.name}</span>
                            <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                          </a>
                        </td>
                        <td
                          className="py-2 px-3 text-right font-mono font-semibold tabular-nums"
                          style={{ color: b.rating ? getRankColor(b.rating) : undefined }}
                        >
                          {b.rating ?? '—'}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {isSolved ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Solved
                            </span>
                          ) : (
                            <span className="text-stone-500 dark:text-stone-400">Queued</span>
                          )}
                        </td>
                        <td className="py-2 pl-3 text-right">
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
                            className="text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : error ? (
          <div className="py-10 text-center border border-dashed border-rose-200 dark:border-rose-900/60 rounded-xl">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadProblemset(true)}
              className="mt-3 px-4 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors"
            >
              Retry Problemset Fetch
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-11 rounded-lg bg-stone-100 dark:bg-stone-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              {focusMode === 'leftovers'
                ? 'No unsolved previously attempted problems matched these filters.'
                : `No unsolved problems matched these exact filters in ${ratingRange[0]}–${ratingRange[1]}.`}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              {selectedTopic && (
                <button
                  type="button"
                  onClick={() => onSelectTopic(null)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  Clear Topic Filter
                </button>
              )}
              {focusMode !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFocusMode('all')}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                >
                  Switch to All Focus
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <th className="py-2.5 pr-4 font-medium">Problem</th>
                  <th className="py-2.5 px-3 text-right font-medium">Rating</th>
                  <th className="py-2.5 px-3 font-medium">Why Suggested</th>
                  <th className="py-2.5 px-3 font-medium">Topics</th>
                  <th className="py-2.5 px-3 text-right font-medium">CF Solves</th>
                  <th className="py-2.5 pl-3 text-right font-medium">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {suggestions.map((p) => {
                  const isSaved = bookmarkStatusMap.get(p.key) === 'saved';
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
                            {p.contestId}
                            {p.index}
                          </span>
                          <span>{p.name}</span>
                          <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                        </a>
                      </td>
                      <td
                        className="py-2 px-3 text-right font-mono font-semibold tabular-nums"
                        style={{ color: getRankColor(p.rating) }}
                      >
                        {p.rating}
                      </td>
                      <td className="py-2 px-3 text-stone-600 dark:text-stone-300 max-w-[260px] truncate">
                        {p.reasonText}
                      </td>
                      <td className="py-2 px-3 text-stone-500 dark:text-stone-400 max-w-[220px] truncate">
                        {p.tags.slice(0, 4).join(' · ')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-stone-500 dark:text-stone-400">
                        {p.solvedCount.toLocaleString()}
                      </td>
                      <td className="py-2 pl-3 text-right">
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
                          aria-label={isSaved ? 'Remove bookmark' : 'Save problem to queue'}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                            isSaved
                              ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-rose-400'
                          }`}
                        >
                          <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
                          <span>{isSaved ? 'Saved' : 'Save'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
