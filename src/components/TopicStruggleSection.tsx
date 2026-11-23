import React, { useMemo, useState } from 'react';
import { ArrowDownUp, ArrowRight, Download, Search } from 'lucide-react';
import type { TimeframeKey, TopicStats } from '../types/codeforces';
import { exportTopicStrugglesCsv, formatVerdictShort, getRankColor } from '../utils/analytics';
import { useContainerWidth } from '../utils/useContainerWidth';

interface TopicStruggleSectionProps {
  handle: string;
  topics: TopicStats[];
  selectedTopic: string | null;
  timeframe?: TimeframeKey;
  onChangeTimeframe?: (tf: TimeframeKey) => void;
  onSelectTopic: (tag: string | null) => void;
  onPracticeTopic?: (tag: string) => void;
  loading: boolean;
}

type ViewMode = 'visual' | 'table';
type VisualOrder = 'weakest' | 'strongest' | 'volume';
type SortKey =
  | 'struggleScore'
  | 'unsolvedProblems'
  | 'firstTryRate'
  | 'failureRate'
  | 'avgAttemptsToAc'
  | 'attemptedProblems'
  | 'avgSolvedRating';

export const TopicStruggleSection: React.FC<TopicStruggleSectionProps> = ({
  handle,
  topics,
  selectedTopic,
  timeframe,
  onChangeTimeframe,
  onSelectTopic,
  onPracticeTopic,
  loading,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [visualOrder, setVisualOrder] = useState<VisualOrder>('weakest');
  const [minAttempts, setMinAttempts] = useState<number>(0);
  const [showAllRows, setShowAllRows] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('struggleScore');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [hoveredTopic, setHoveredTopic] = useState<TopicStats | null>(null);

  const { ref: svgWrapRef, width: svgWidth } = useContainerWidth(900);

  const eligibleTopics = useMemo(() => {
    const filtered = topics.filter((t) => {
      if (minAttempts === 0) return true;
      return t.attemptedProblems >= minAttempts;
    });
    return filtered.length > 0 ? filtered : topics;
  }, [topics, minAttempts]);

  const orderedVisualTopics = useMemo(() => {
    const list = [...eligibleTopics];
    if (visualOrder === 'weakest') {
      list.sort(
        (a, b) =>
          b.struggleScore - a.struggleScore ||
          b.unsolvedProblems - a.unsolvedProblems ||
          a.attemptedProblems - b.attemptedProblems
      );
    } else if (visualOrder === 'strongest') {
      list.sort(
        (a, b) =>
          Number(Boolean(a.isUncovered)) - Number(Boolean(b.isUncovered)) ||
          a.struggleScore - b.struggleScore ||
          b.firstTryRate - a.firstTryRate ||
          b.solvedProblems - a.solvedProblems
      );
    } else {
      list.sort(
        (a, b) =>
          b.attemptedProblems - a.attemptedProblems ||
          b.struggleScore - a.struggleScore
      );
    }
    return list;
  }, [eligibleTopics, visualOrder]);

  const tableTopics = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const list = q
      ? eligibleTopics.filter((t) => t.tag.toLowerCase().includes(q))
      : eligibleTopics;
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      return sortDesc ? Number(bv) - Number(av) : Number(av) - Number(bv);
    });
  }, [eligibleTopics, tableSearch, sortKey, sortDesc]);

  const { weakestHighlight, strongestHighlight, uncoveredList } = useMemo(() => {
    const uncovered = topics.filter((t) => t.isUncovered || t.attemptedProblems === 0);
    const attemptedWeak = topics
      .filter((t) => t.attemptedProblems >= 2)
      .sort((a, b) => b.struggleScore - a.struggleScore || b.unsolvedProblems - a.unsolvedProblems);

    const combinedWeak: TopicStats[] = [];
    for (const t of attemptedWeak) {
      if (t.struggleScore >= 40 && combinedWeak.length < 3) {
        combinedWeak.push(t);
      }
    }
    for (const u of uncovered) {
      if (combinedWeak.length < 4 && !combinedWeak.some((x) => x.tag === u.tag)) {
        combinedWeak.push(u);
      }
    }
    if (combinedWeak.length < 4) {
      for (const t of attemptedWeak) {
        if (combinedWeak.length < 4 && !combinedWeak.some((x) => x.tag === t.tag)) {
          combinedWeak.push(t);
        }
      }
    }

    const weakTags = new Set(combinedWeak.map((w) => w.tag));
    const strong = topics
      .filter((t) => !weakTags.has(t.tag) && t.solvedProblems > 0 && !t.isUncovered)
      .sort((a, b) => a.struggleScore - b.struggleScore || b.solvedProblems - a.solvedProblems)
      .slice(0, 4);

    return {
      weakestHighlight: combinedWeak,
      strongestHighlight: strong,
      uncoveredList: uncovered,
    };
  }, [topics]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const getStatusMeta = (t: TopicStats) => {
    if (t.isUncovered || t.attemptedProblems === 0) {
      return { label: 'Uncovered (0 tried)', colorClass: 'text-red-600 dark:text-red-400' };
    }
    if (t.struggleScore >= 55) {
      return { label: 'Needs Practice', colorClass: 'text-red-600 dark:text-red-400' };
    }
    if (t.struggleScore >= 35) {
      return { label: 'Moderate Friction', colorClass: 'text-amber-600 dark:text-amber-400' };
    }
    return { label: 'Strong', colorClass: 'text-emerald-600 dark:text-emerald-400' };
  };

  const getPercentages = (t: TopicStats) => {
    if (t.isUncovered || t.attemptedProblems === 0) {
      return {
        firstTry: 0,
        retried: 0,
        stuck: 0,
        firstPct: 0,
        retriedPct: 0,
        stuckPct: 0,
        solvePct: 0,
      };
    }
    const total = Math.max(1, t.attemptedProblems);
    const firstTry = Math.min(t.solvedProblems, t.firstTrySolves);
    const retried = Math.max(0, t.solvedProblems - firstTry);
    const stuck = Math.max(0, t.unsolvedProblems);

    return {
      firstTry,
      retried,
      stuck,
      firstPct: (firstTry / total) * 100,
      retriedPct: (retried / total) * 100,
      stuckPct: (stuck / total) * 100,
      solvePct: Math.round((t.solvedProblems / total) * 100),
    };
  };

  const activeSummaryTopic =
    hoveredTopic ??
    (selectedTopic ? topics.find((t) => t.tag === selectedTopic) ?? null : null);

  const displayedVisual = showAllRows
    ? orderedVisualTopics
    : orderedVisualTopics.slice(0, 15);

  const rowH = 38;
  const chartTop = 26;
  const chartLeft = svgWidth < 460 ? 108 : svgWidth < 560 ? 130 : 185;
  const chartRight = svgWidth < 460 ? 48 : svgWidth < 560 ? 78 : 165;
  const barTrackW = Math.max(90, svgWidth - chartLeft - chartRight);
  const svgHeight = chartTop + displayedVisual.length * rowH + 14;

  return (
    <section
      id="topics"
      className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5"
    >
      {/* Header & Top Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Topic Mastery
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
          {timeframe && onChangeTimeframe && (
            <div
              role="group"
              aria-label="Topics timeframe"
              className="max-w-full overflow-x-auto no-scrollbar inline-flex items-center p-1 bg-slate-100 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-800 rounded-xl"
            >
              {(
                [
                  { key: '30d', label: '30D' },
                  { key: '90d', label: '90D' },
                  { key: '1y', label: '1Y' },
                  { key: 'all', label: 'All' },
                ] as { key: TimeframeKey; label: string }[]
              ).map((tf) => (
                <button
                  key={tf.key}
                  type="button"
                  onClick={() => onChangeTimeframe(tf.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    timeframe === tf.key
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          )}

          {/* Distinct View Switcher */}
          <div
            role="tablist"
            aria-label="Topic view mode"
            className="max-w-full overflow-x-auto no-scrollbar inline-flex items-center p-1 bg-slate-100 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-800 rounded-xl"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'visual'}
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'visual'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Visual
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'table'}
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Table
            </button>
          </div>

          {/* Min Attempts Filter */}
          <div
            role="group"
            aria-label="Topic scope filter"
            className="max-w-full overflow-x-auto no-scrollbar inline-flex items-center p-1 bg-slate-100 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-800 rounded-xl"
          >
            {[
              { val: 0, label: 'All' },
              { val: 1, label: 'Attempted' },
              { val: 5, label: '5+ tried' },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setMinAttempts(opt.val)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  minAttempts === opt.val
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => exportTopicStrugglesCsv(handle, eligibleTopics)}
            disabled={eligibleTopics.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[360px] rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse" />
      ) : eligibleTopics.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-500 dark:text-slate-400">
          No topic tag data available in this timeframe.
        </div>
      ) : viewMode === 'visual' ? (
        /* ==================== VISUAL BREAKDOWN VIEW ==================== */
        <div className="space-y-6">
          {/* Spotlight Cards: Weak & Uncovered vs Strongest */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Weak & Uncovered */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/70 dark:bg-[#0E131D]/70">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-semibold text-red-700 dark:text-red-400">
                  Weak Topics ({uncoveredList.length} uncovered)
                </h3>
              </div>

              <div className="space-y-2.5">
                {weakestHighlight.map((t) => {
                  const pct = getPercentages(t);
                  const dominant = formatVerdictShort(t.dominantFailureVerdict);
                  const isSelected = selectedTopic === t.tag;
                  const uncovered = Boolean(t.isUncovered || t.attemptedProblems === 0);

                  return (
                    <div
                      key={t.tag}
                      className={`p-3 rounded-xl border transition-colors bg-white dark:bg-[#121824] ${
                        isSelected
                          ? 'border-blue-500 dark:border-blue-500'
                          : 'border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectTopic(isSelected ? null : t.tag)}
                          className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize hover:text-[#0047CC] dark:hover:text-blue-400 text-left"
                        >
                          {t.tag}
                        </button>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {uncovered
                              ? '0 tried'
                              : `${t.solvedProblems}/${t.attemptedProblems}`}
                          </span>
                          {onPracticeTopic && (
                            <button
                              type="button"
                              onClick={() => onPracticeTopic(t.tag)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0047CC] dark:text-blue-400 hover:underline whitespace-nowrap"
                            >
                              Practice <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 h-2 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex">
                        {uncovered ? (
                          <div className="h-full w-full bg-red-200 dark:bg-red-950/70" />
                        ) : (
                          <>
                            {pct.firstPct > 0 && (
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${pct.firstPct}%` }}
                              />
                            )}
                            {pct.retriedPct > 0 && (
                              <div
                                className="h-full bg-blue-600"
                                style={{ width: `${pct.retriedPct}%` }}
                              />
                            )}
                            {pct.stuckPct > 0 && (
                              <div
                                className="h-full bg-red-500"
                                style={{ width: `${pct.stuckPct}%` }}
                              />
                            )}
                          </>
                        )}
                      </div>

                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {uncovered
                          ? '0 attempts'
                          : `${
                              t.unsolvedProblems > 0 ? `${t.unsolvedProblems} stuck` : 'Resolved'
                            } · ${t.avgAttemptsToAc.toFixed(1)} tries${
                              t.dominantFailureVerdict !== 'NONE' ? ` · ${dominant.label}` : ''
                            }`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strongest Topics */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/70 dark:bg-[#0E131D]/70">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Strongest Topics
                </h3>
              </div>

              {strongestHighlight.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                  Solve more topics to highlight your strongest categories.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {strongestHighlight.map((t) => {
                    const pct = getPercentages(t);
                    const isSelected = selectedTopic === t.tag;
                    return (
                      <div
                        key={t.tag}
                        className={`p-3 rounded-xl border transition-colors bg-white dark:bg-[#121824] ${
                          isSelected
                            ? 'border-blue-500 dark:border-blue-500'
                            : 'border-slate-200/80 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectTopic(isSelected ? null : t.tag)}
                            className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize hover:text-[#0047CC] dark:hover:text-blue-400 text-left"
                          >
                            {t.tag}
                          </button>
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {t.solvedProblems}/{t.attemptedProblems} solved
                          </span>
                        </div>

                        <div className="mt-2 h-2 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex">
                          {pct.firstPct > 0 && (
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${pct.firstPct}%` }}
                            />
                          )}
                          {pct.retriedPct > 0 && (
                            <div
                              className="h-full bg-blue-600"
                              style={{ width: `${pct.retriedPct}%` }}
                            />
                          )}
                          {pct.stuckPct > 0 && (
                            <div
                              className="h-full bg-red-500"
                              style={{ width: `${pct.stuckPct}%` }}
                            />
                          )}
                        </div>

                        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {Math.round(t.firstTryRate)}% 1st-try
                          {t.avgSolvedRating ? ` · Avg ${t.avgSolvedRating}` : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* SVG Horizontal Stacked Bar Chart */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                  1st-try
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
                  Retried
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-red-500 inline-block" />
                  Stuck
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-red-200 dark:bg-red-900/70 inline-block" />
                  Uncovered
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Sort:</span>
                <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-800 rounded-xl">
                  {[
                    { key: 'weakest', label: 'Weakest' },
                    { key: 'strongest', label: 'Strongest' },
                    { key: 'volume', label: 'Most Tried' },
                  ].map((ord) => (
                    <button
                      key={ord.key}
                      type="button"
                      onClick={() => setVisualOrder(ord.key as VisualOrder)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                        visualOrder === ord.key
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {ord.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Inspector Line */}
            {(activeSummaryTopic || selectedTopic) && (
              <div className="mb-2 min-h-[20px] flex items-center justify-between gap-2 text-xs">
                {activeSummaryTopic ? (
                  activeSummaryTopic.isUncovered || activeSummaryTopic.attemptedProblems === 0 ? (
                    <p className="text-slate-700 dark:text-slate-200">
                      <span className="font-semibold capitalize">{activeSummaryTopic.tag}</span> · 0 attempts
                    </p>
                  ) : (
                    (() => {
                      const p = getPercentages(activeSummaryTopic);
                      const dom = formatVerdictShort(activeSummaryTopic.dominantFailureVerdict);
                      return (
                        <p className="text-slate-700 dark:text-slate-200 tabular-nums">
                          <span className="font-semibold capitalize">{activeSummaryTopic.tag}</span> ·{' '}
                          {p.firstTry} 1st-try · {p.retried} retried · {p.stuck} stuck
                          {activeSummaryTopic.dominantFailureVerdict !== 'NONE'
                            ? ` (${dom.label})`
                            : ''}
                        </p>
                      );
                    })()
                  )
                ) : (
                  <span />
                )}

                {selectedTopic && (
                  <button
                    type="button"
                    onClick={() => onSelectTopic(null)}
                    className="text-[#0047CC] dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
                  >
                    Clear ({selectedTopic})
                  </button>
                )}
              </div>
            )}

            <div ref={svgWrapRef} className="w-full">
              <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="overflow-visible select-none"
                onMouseLeave={() => setHoveredTopic(null)}
              >
                {[0, 25, 50, 75, 100].map((pctTick) => {
                  const x = chartLeft + (pctTick / 100) * barTrackW;
                  return (
                    <g key={pctTick}>
                      <line
                        x1={x}
                        x2={x}
                        y1={chartTop - 4}
                        y2={svgHeight - 8}
                        className="stroke-slate-100 dark:stroke-slate-800"
                        strokeWidth={1}
                      />
                      <text
                        x={x}
                        y={14}
                        textAnchor="middle"
                        className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
                      >
                        {pctTick}%
                      </text>
                    </g>
                  );
                })}

                {displayedVisual.map((t, idx) => {
                  const y = chartTop + idx * rowH;
                  const barY = y + 9;
                  const barH = 18;
                  const pct = getPercentages(t);
                  const uncovered = Boolean(t.isUncovered || t.attemptedProblems === 0);
                  const isSelected = selectedTopic === t.tag;
                  const isHovered = hoveredTopic?.tag === t.tag;

                  const wFirst = (pct.firstPct / 100) * barTrackW;
                  const wRetry = (pct.retriedPct / 100) * barTrackW;
                  const wStuck = (pct.stuckPct / 100) * barTrackW;

                  return (
                    <g
                      key={t.tag}
                      onMouseEnter={() => setHoveredTopic(t)}
                      onClick={() => onSelectTopic(isSelected ? null : t.tag)}
                      className="cursor-pointer"
                    >
                      {/* Row highlight */}
                      <rect
                        x={0}
                        y={y + 2}
                        width={svgWidth}
                        height={rowH - 4}
                        rx={6}
                        fill={
                          isSelected
                            ? 'rgba(37, 99, 235, 0.09)'
                            : isHovered
                            ? 'rgba(148, 163, 184, 0.11)'
                            : 'transparent'
                        }
                      />

                      {/* Topic Label */}
                      <text
                        x={4}
                        y={y + 22}
                        className={`text-[11px] sm:text-xs font-medium capitalize ${
                          isSelected
                            ? 'fill-[#0047CC] dark:fill-blue-400 font-semibold'
                            : 'fill-slate-800 dark:fill-slate-200'
                        }`}
                      >
                        {t.tag.length > (svgWidth < 460 ? 13 : svgWidth < 560 ? 16 : 22)
                          ? `${t.tag.slice(0, svgWidth < 460 ? 12 : svgWidth < 560 ? 15 : 21)}…`
                          : t.tag}
                      </text>

                      {/* Track background */}
                      <rect
                        x={chartLeft}
                        y={barY}
                        width={barTrackW}
                        height={barH}
                        rx={4}
                        className="fill-slate-100 dark:fill-slate-800"
                      />

                      {uncovered ? (
                        <rect
                          x={chartLeft}
                          y={barY}
                          width={barTrackW}
                          height={barH}
                          rx={4}
                          className="fill-red-200/80 dark:fill-red-950/70"
                        />
                      ) : (
                        <>
                          {wFirst > 0 && (
                            <rect
                              x={chartLeft}
                              y={barY}
                              width={wFirst}
                              height={barH}
                              rx={2}
                              fill="#10B981"
                            />
                          )}
                          {wRetry > 0 && (
                            <rect
                              x={chartLeft + wFirst}
                              y={barY}
                              width={wRetry}
                              height={barH}
                              rx={2}
                              fill="#2563EB"
                            />
                          )}
                          {wStuck > 0 && (
                            <rect
                              x={chartLeft + wFirst + wRetry}
                              y={barY}
                              width={wStuck}
                              height={barH}
                              rx={2}
                              fill="#DC2626"
                            />
                          )}
                        </>
                      )}

                      {/* Right readout inside SVG */}
                      <text
                        x={chartLeft + barTrackW + 8}
                        y={y + 22}
                        className={`text-[11px] font-mono ${
                          uncovered
                            ? 'fill-red-600 dark:fill-red-400 font-medium'
                            : 'fill-slate-600 dark:fill-slate-300'
                        }`}
                      >
                        {uncovered
                          ? svgWidth < 460
                            ? '0%'
                            : 'Uncovered'
                          : svgWidth < 560
                          ? `${pct.solvePct}%`
                          : `${t.solvedProblems}/${t.attemptedProblems} (${pct.solvePct}%)`}
                      </text>

                      {onPracticeTopic && svgWidth >= 560 && (
                        <text
                          x={svgWidth - 8}
                          y={y + 22}
                          textAnchor="end"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPracticeTopic(t.tag);
                          }}
                          className="fill-[#0047CC] dark:fill-blue-400 text-[11px] font-medium hover:underline"
                        >
                          Practice →
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {orderedVisualTopics.length > 15 && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllRows((prev) => !prev)}
                  className="px-4 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {showAllRows
                    ? 'Show top 15 topics'
                    : `Show all ${orderedVisualTopics.length} topics`}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== DETAILED METRICS TABLE VIEW ==================== */
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="relative w-full sm:w-auto">
              <Search
                className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search topic tag..."
                aria-label="Search topic tag"
                className="w-full sm:w-60 pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {selectedTopic && (
              <button
                type="button"
                onClick={() => onSelectTopic(null)}
                className="text-xs text-[#0047CC] dark:text-blue-400 hover:underline self-start sm:self-auto"
              >
                Clear queue filter ({selectedTopic})
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3 font-medium">Topic Tag</th>
                  <th className="py-2.5 px-2 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('struggleScore')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Status <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-2 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('attemptedProblems')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Solved / Tried <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-2 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('unsolvedProblems')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Stuck <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-2 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('firstTryRate')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      1st-Try % <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-2 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('failureRate')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Non-AC % <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-2 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('avgAttemptsToAc')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Avg Tries <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-2 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('avgSolvedRating')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      Avg Rating <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  {onPracticeTopic && <th className="py-2.5 pl-2 text-right font-medium">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {tableTopics.map((t) => {
                  const status = getStatusMeta(t);
                  const uncovered = Boolean(t.isUncovered || t.attemptedProblems === 0);
                  const isSelected = selectedTopic === t.tag;
                  return (
                    <tr
                      key={t.tag}
                      onClick={() => onSelectTopic(isSelected ? null : t.tag)}
                      className={`cursor-pointer transition-colors h-10 ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100 capitalize whitespace-nowrap">
                        {t.tag}
                      </td>
                      <td className={`py-2 px-2 font-medium whitespace-nowrap ${status.colorClass}`}>
                        {status.label}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {t.solvedProblems}/{t.attemptedProblems}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {t.unsolvedProblems}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {uncovered ? '—' : `${t.firstTryRate.toFixed(0)}%`}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {uncovered ? '—' : `${t.failureRate.toFixed(0)}%`}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {uncovered ? '—' : t.avgAttemptsToAc.toFixed(1)}
                      </td>
                      <td
                        className="py-2 px-2 text-right font-mono font-semibold tabular-nums"
                        style={{
                          color: t.avgSolvedRating ? getRankColor(t.avgSolvedRating) : undefined,
                        }}
                      >
                        {t.avgSolvedRating ?? '—'}
                      </td>
                      {onPracticeTopic && (
                        <td className="py-2 pl-2 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPracticeTopic(t.tag);
                            }}
                            className="text-[#0047CC] dark:text-blue-400 font-medium hover:underline whitespace-nowrap"
                          >
                            Practice
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
