import React, { useMemo, useState } from 'react';
import type { CFRatingChange, RatingBucket, TimeframeKey, TimelineBucket } from '../types/codeforces';
import { getRankColor, getTimeframeCutoff } from '../utils/analytics';
import { useContainerWidth } from '../utils/useContainerWidth';

interface DifficultyProgressionChartProps {
  ratingHistory: CFRatingChange[];
  weeklyTimeline: TimelineBucket[];
  monthlyTimeline: TimelineBucket[];
  ratingBuckets: RatingBucket[];
  timeframe: TimeframeKey;
  loading: boolean;
}

const CF_BANDS = [
  { min: 0, max: 1200, label: 'Newbie', color: 'rgba(148, 163, 184, 0.08)' },
  { min: 1200, max: 1400, label: 'Pupil', color: 'rgba(34, 197, 94, 0.07)' },
  { min: 1400, max: 1600, label: 'Specialist', color: 'rgba(20, 184, 166, 0.08)' },
  { min: 1600, max: 1900, label: 'Expert', color: 'rgba(59, 130, 246, 0.08)' },
  { min: 1900, max: 2100, label: 'CM', color: 'rgba(168, 85, 247, 0.08)' },
  { min: 2100, max: 2400, label: 'Master', color: 'rgba(245, 158, 11, 0.08)' },
  { min: 2400, max: 4200, label: 'GM', color: 'rgba(239, 68, 68, 0.08)' },
];

export const DifficultyProgressionChart: React.FC<DifficultyProgressionChartProps> = ({
  ratingHistory,
  weeklyTimeline,
  monthlyTimeline,
  ratingBuckets,
  timeframe,
  loading,
}) => {
  const [mode, setMode] = useState<'practice' | 'contest'>('practice');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverBucketIdx, setHoverBucketIdx] = useState<number | null>(null);

  const { ref: leftRef, width: leftWidth } = useContainerWidth(640);
  const { ref: rightRef, width: rightWidth } = useContainerWidth(420);

  // Practice Difficulty Series (choose monthly for 'all'/'1y', weekly for shorter)
  const practicePoints = useMemo(() => {
    const source = timeframe === '30d' || timeframe === '90d' || timeframe === '6m'
      ? weeklyTimeline
      : monthlyTimeline;
    return source.filter((b) => b.avgSolvedRating !== null);
  }, [timeframe, weeklyTimeline, monthlyTimeline]);

  const contestPoints = useMemo(() => {
    const cutoff = getTimeframeCutoff(timeframe);
    if (cutoff === 0) return ratingHistory;
    const filtered = ratingHistory.filter((c) => c.ratingUpdateTimeSeconds >= cutoff);
    return filtered.length >= 2 ? filtered : ratingHistory;
  }, [ratingHistory, timeframe]);

  const chartHeight = 270;
  const pad = { top: 20, right: 18, bottom: 32, left: 48 };
  const plotW = Math.max(120, leftWidth - pad.left - pad.right);
  const plotH = chartHeight - pad.top - pad.bottom;

  // Y scale computation for left chart
  const { yMin, yMax } = useMemo(() => {
    if (mode === 'practice') {
      if (practicePoints.length === 0) return { yMin: 800, yMax: 2000 };
      let lo = Infinity;
      let hi = -Infinity;
      for (const p of practicePoints) {
        if (p.avgSolvedRating !== null) {
          lo = Math.min(lo, p.avgSolvedRating);
          hi = Math.max(hi, p.avgSolvedRating);
        }
        if (p.p90SolvedRating !== null) {
          hi = Math.max(hi, p.p90SolvedRating);
        }
      }
      return {
        yMin: Math.max(700, Math.floor((lo - 150) / 100) * 100),
        yMax: Math.min(3600, Math.ceil((hi + 150) / 100) * 100),
      };
    } else {
      if (contestPoints.length === 0) return { yMin: 800, yMax: 2000 };
      let lo = Infinity;
      let hi = -Infinity;
      for (const c of contestPoints) {
        lo = Math.min(lo, c.newRating);
        hi = Math.max(hi, c.newRating);
      }
      return {
        yMin: Math.max(0, Math.floor((lo - 150) / 100) * 100),
        yMax: Math.ceil((hi + 180) / 100) * 100,
      };
    }
  }, [mode, practicePoints, contestPoints]);

  const yToPx = (val: number) => {
    const ratio = (val - yMin) / Math.max(100, yMax - yMin);
    return pad.top + plotH - ratio * plotH;
  };

  const yTicks = useMemo(() => {
    const span = yMax - yMin;
    const step = span > 1600 ? 400 : span > 800 ? 200 : 100;
    const ticks: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
      ticks.push(v);
    }
    return ticks;
  }, [yMin, yMax]);

  // Right chart: Rating Bucket bar chart dimensions
  const rightPlotW = Math.max(120, rightWidth - 40 - 12);
  const rightPlotH = chartHeight - 20 - 34;
  const maxBucketProblems = useMemo(() => {
    const peak = ratingBuckets.reduce(
      (m, rb) => Math.max(m, rb.solved + rb.unsolvedAttempted),
      0
    );
    return Math.max(5, Math.ceil(peak / 5) * 5);
  }, [ratingBuckets]);

  const activePractice =
    mode === 'practice' && hoverIdx !== null && practicePoints[hoverIdx]
      ? practicePoints[hoverIdx]
      : null;

  const activeContest =
    mode === 'contest' && hoverIdx !== null && contestPoints[hoverIdx]
      ? contestPoints[hoverIdx]
      : null;

  const activeBucket =
    hoverBucketIdx !== null && ratingBuckets[hoverBucketIdx]
      ? ratingBuckets[hoverBucketIdx]
      : null;

  return (
    <section id="progression" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left 7 cols: Difficulty Rating Progression */}
      <div className="lg:col-span-7 bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
              Difficulty Rating Progression
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {mode === 'practice'
                ? 'Mean & 90th-percentile rating of problems solved over time'
                : 'Official rated contest progression across Codeforces tier bands'}
            </p>
          </div>

          <div
            role="group"
            aria-label="Difficulty progression mode"
            className="inline-flex items-center p-1 bg-stone-100 dark:bg-[#141210] border border-stone-200 dark:border-stone-800 rounded-xl self-start sm:self-auto"
          >
            <button
              type="button"
              onClick={() => {
                setMode('practice');
                setHoverIdx(null);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                mode === 'practice'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Practice Problems
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('contest');
                setHoverIdx(null);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                mode === 'contest'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Contest Rating ({contestPoints.length})
            </button>
          </div>
        </div>

        {/* Readout / legend strip */}
        <div className="mb-3 min-h-[22px] flex flex-wrap items-center justify-between gap-2 text-xs">
          {mode === 'practice' ? (
            <div className="flex items-center gap-4 text-stone-600 dark:text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-rose-600 dark:bg-rose-400 inline-block" />
                Rolling Avg Rating
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-500 inline-block" />
                90th Pct Ceiling
              </span>
            </div>
          ) : (
            <div className="text-stone-500 dark:text-stone-400">
              Official Codeforces contest rating updates
            </div>
          )}

          <div className="font-mono tabular-nums text-stone-800 dark:text-stone-200">
            {activePractice ? (
              <span>
                {activePractice.label}: Avg {activePractice.avgSolvedRating} · Rolling{' '}
                {activePractice.rollingAvgRating ?? '—'} · P90{' '}
                {activePractice.p90SolvedRating ?? '—'} ({activePractice.ratedProblemsSolved} solved)
              </span>
            ) : activeContest ? (
              <span>
                {activeContest.newRating} ({activeContest.newRating - activeContest.oldRating >= 0 ? '+' : ''}
                {activeContest.newRating - activeContest.oldRating}) · Rank #{activeContest.rank} ·{' '}
                <span className="font-sans">{activeContest.contestName}</span>
              </span>
            ) : (
              <span className="font-sans text-stone-400 dark:text-stone-500">
                Hover curve points to inspect values
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="h-[270px] rounded-xl bg-stone-100 dark:bg-stone-800/50 animate-pulse" />
        ) : mode === 'practice' && practicePoints.length < 2 ? (
          <div className="h-[270px] flex items-center justify-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl text-sm text-stone-500 dark:text-stone-400 px-4 text-center">
            Need at least 2 active periods with rated solved problems to plot practice difficulty progression.
          </div>
        ) : mode === 'contest' && contestPoints.length === 0 ? (
          <div className="h-[270px] flex items-center justify-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl text-sm text-stone-500 dark:text-stone-400 px-4 text-center">
            No rated contests recorded for this handle. Switch to Practice Problems to track daily problem difficulty.
          </div>
        ) : (
          <div ref={leftRef} className="w-full">
            <svg
              width={leftWidth}
              height={chartHeight}
              viewBox={`0 0 ${leftWidth} ${chartHeight}`}
              className="overflow-visible select-none"
              onMouseLeave={() => setHoverIdx(null)}
            >
              {/* Subtle Codeforces tier background bands */}
              {CF_BANDS.map((band) => {
                const clampedMin = Math.max(yMin, band.min);
                const clampedMax = Math.min(yMax, band.max);
                if (clampedMax <= clampedMin) return null;
                const yTop = yToPx(clampedMax);
                const yBot = yToPx(clampedMin);
                return (
                  <rect
                    key={band.label}
                    x={pad.left}
                    y={yTop}
                    width={plotW}
                    height={Math.max(0, yBot - yTop)}
                    fill={band.color}
                  />
                );
              })}

              {/* Y Grid */}
              {yTicks.map((tick) => {
                const y = yToPx(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={pad.left}
                      x2={leftWidth - pad.right}
                      y1={y}
                      y2={y}
                      className="stroke-stone-200/70 dark:stroke-stone-800"
                      strokeWidth={1}
                    />
                    <text
                      x={pad.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-stone-400 dark:fill-stone-500 text-[10px] font-mono"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Practice Mode Series */}
              {mode === 'practice' && practicePoints.length > 0 && (() => {
                const step = practicePoints.length > 1 ? plotW / (practicePoints.length - 1) : plotW;
                const rollingPath = practicePoints
                  .map((p, i) => {
                    const x = pad.left + i * step;
                    const y = yToPx(p.rollingAvgRating ?? p.avgSolvedRating ?? yMin);
                    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(' ');
                const ceilingPath = practicePoints
                  .map((p, i) => {
                    const x = pad.left + i * step;
                    const y = yToPx(p.p90SolvedRating ?? p.avgSolvedRating ?? yMin);
                    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(' ');
                const areaPath = `${rollingPath} L ${(pad.left + (practicePoints.length - 1) * step).toFixed(1)} ${pad.top + plotH} L ${pad.left} ${pad.top + plotH} Z`;
                const xLabelEvery = Math.max(1, Math.ceil(practicePoints.length / 7));

                return (
                  <>
                    <path d={areaPath} fill="rgba(225, 29, 72, 0.08)" />
                    <path
                      d={ceilingPath}
                      fill="none"
                      stroke="#D97706"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                    <path
                      d={rollingPath}
                      fill="none"
                      className="stroke-rose-600 dark:stroke-rose-400"
                      strokeWidth={2.25}
                      strokeLinejoin="round"
                    />
                    {practicePoints.map((p, i) => {
                      const x = pad.left + i * step;
                      const yAvg = yToPx(p.avgSolvedRating ?? yMin);
                      const yRoll = yToPx(p.rollingAvgRating ?? p.avgSolvedRating ?? yMin);
                      const isHover = hoverIdx === i;
                      return (
                        <g key={p.key} onMouseEnter={() => setHoverIdx(i)} className="cursor-pointer">
                          <rect
                            x={x - step / 2}
                            y={pad.top}
                            width={Math.max(10, step)}
                            height={plotH}
                            fill="transparent"
                          />
                          {isHover && (
                            <line
                              x1={x}
                              x2={x}
                              y1={pad.top}
                              y2={pad.top + plotH}
                              className="stroke-stone-300 dark:stroke-stone-700"
                              strokeDasharray="3 3"
                            />
                          )}
                          <circle
                            cx={x}
                            cy={yAvg}
                            r={isHover ? 4.5 : 2.5}
                            className="fill-rose-500/70 dark:fill-rose-400/70"
                          />
                          {isHover && (
                            <circle
                              cx={x}
                              cy={yRoll}
                              r={5}
                              className="fill-rose-600 dark:fill-rose-400 stroke-white dark:stroke-[#1B1917]"
                              strokeWidth={2}
                            />
                          )}
                          {i % xLabelEvery === 0 && (
                            <text
                              x={x}
                              y={chartHeight - 10}
                              textAnchor="middle"
                              className="fill-stone-400 dark:fill-stone-500 text-[10px] font-mono"
                            >
                              {p.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </>
                );
              })()}

              {/* Contest Rating Mode Series */}
              {mode === 'contest' && contestPoints.length > 0 && (() => {
                const step = contestPoints.length > 1 ? plotW / (contestPoints.length - 1) : plotW;
                const path = contestPoints
                  .map((c, i) => {
                    const x = pad.left + i * step;
                    const y = yToPx(c.newRating);
                    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(' ');
                const xLabelEvery = Math.max(1, Math.ceil(contestPoints.length / 6));

                return (
                  <>
                    <path
                      d={path}
                      fill="none"
                      className="stroke-stone-700 dark:stroke-stone-300"
                      strokeWidth={2}
                      strokeLinejoin="round"
                    />
                    {contestPoints.map((c, i) => {
                      const x = pad.left + i * step;
                      const y = yToPx(c.newRating);
                      const isHover = hoverIdx === i;
                      const dotColor = getRankColor(c.newRating);
                      const label = new Date(c.ratingUpdateTimeSeconds * 1000).toLocaleDateString(
                        'en-US',
                        { month: 'short', year: '2-digit' }
                      );
                      return (
                        <g
                          key={`${c.contestId}-${i}`}
                          onMouseEnter={() => setHoverIdx(i)}
                          className="cursor-pointer"
                        >
                          <rect
                            x={x - Math.max(8, step / 2)}
                            y={pad.top}
                            width={Math.max(16, step)}
                            height={plotH}
                            fill="transparent"
                          />
                          {isHover && (
                            <line
                              x1={x}
                              x2={x}
                              y1={pad.top}
                              y2={pad.top + plotH}
                              className="stroke-stone-300 dark:stroke-stone-700"
                              strokeDasharray="3 3"
                            />
                          )}
                          <circle
                            cx={x}
                            cy={y}
                            r={isHover ? 5.5 : contestPoints.length > 60 ? 2 : 3.5}
                            fill={dotColor}
                            className="stroke-white dark:stroke-[#1B1917]"
                            strokeWidth={isHover ? 2 : 1}
                          />
                          {i % xLabelEvery === 0 && (
                            <text
                              x={x}
                              y={chartHeight - 10}
                              textAnchor="middle"
                              className="fill-stone-400 dark:fill-stone-500 text-[10px] font-mono"
                            >
                              {label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
        )}
      </div>

      {/* Right 5 cols: Problem Rating Distribution */}
      <div className="lg:col-span-5 bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
              Problems by Difficulty Rating
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Solved vs unresolved attempts across 100-point tiers
            </p>
          </div>
        </div>

        <div className="mb-3 min-h-[22px] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-500 inline-block" />
              Solved
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-400 dark:bg-rose-500/80 inline-block" />
              Unsolved
            </span>
          </div>
          <div className="font-mono tabular-nums text-stone-800 dark:text-stone-200">
            {activeBucket ? (
              <span>
                {activeBucket.rating}: {activeBucket.solved} solved · {activeBucket.unsolvedAttempted}{' '}
                stuck ({activeBucket.solveRate}%)
              </span>
            ) : (
              <span className="font-sans text-stone-400 dark:text-stone-500">
                Hover rating bars
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="h-[270px] rounded-xl bg-stone-100 dark:bg-stone-800/50 animate-pulse" />
        ) : ratingBuckets.length === 0 ? (
          <div className="h-[270px] flex items-center justify-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl text-sm text-stone-500 dark:text-stone-400">
            No rated problems attempted in this timeframe.
          </div>
        ) : (
          <div ref={rightRef} className="w-full">
            <svg
              width={rightWidth}
              height={chartHeight}
              viewBox={`0 0 ${rightWidth} ${chartHeight}`}
              className="overflow-visible select-none"
              onMouseLeave={() => setHoverBucketIdx(null)}
            >
              {[0, 0.5, 1].map((t) => {
                const val = Math.round(maxBucketProblems * t);
                const y = 20 + rightPlotH - t * rightPlotH;
                return (
                  <g key={t}>
                    <line
                      x1={40}
                      x2={rightWidth - 12}
                      y1={y}
                      y2={y}
                      className="stroke-stone-100 dark:stroke-stone-800"
                    />
                    <text
                      x={34}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-stone-400 dark:fill-stone-500 text-[10px] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {ratingBuckets.map((rb, i) => {
                const step = rightPlotW / ratingBuckets.length;
                const bw = Math.max(6, Math.min(24, step * 0.7));
                const x = 40 + i * step + (step - bw) / 2;
                const hSolved = (rb.solved / maxBucketProblems) * rightPlotH;
                const hUnsolved = (rb.unsolvedAttempted / maxBucketProblems) * rightPlotH;
                const ySolved = 20 + rightPlotH - hSolved;
                const yUnsolved = ySolved - hUnsolved;
                const isHover = hoverBucketIdx === i;
                const labelEvery = Math.max(1, Math.ceil(ratingBuckets.length / 7));

                return (
                  <g
                    key={rb.rating}
                    onMouseEnter={() => setHoverBucketIdx(i)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={40 + i * step}
                      y={20}
                      width={step}
                      height={rightPlotH}
                      fill={isHover ? 'rgba(225, 29, 72, 0.06)' : 'transparent'}
                    />
                    {hSolved > 0 && (
                      <rect
                        x={x}
                        y={ySolved}
                        width={bw}
                        height={hSolved}
                        rx={1}
                        fill={getRankColor(rb.rating)}
                        opacity={hoverBucketIdx === null || isHover ? 0.88 : 0.45}
                      />
                    )}
                    {hUnsolved > 0 && (
                      <rect
                        x={x}
                        y={yUnsolved}
                        width={bw}
                        height={hUnsolved}
                        rx={1}
                        className="fill-rose-400 dark:fill-rose-500"
                        opacity={hoverBucketIdx === null || isHover ? 0.85 : 0.4}
                      />
                    )}
                    {i % labelEvery === 0 && (
                      <text
                        x={40 + i * step + step / 2}
                        y={chartHeight - 10}
                        textAnchor="middle"
                        className="fill-stone-400 dark:fill-stone-500 text-[10px] font-mono"
                      >
                        {rb.rating}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </section>
  );
};
