import React, { useMemo, useState } from 'react';
import type { TimelineBucket } from '../types/codeforces';
import { useContainerWidth } from '../utils/useContainerWidth';

interface SubmissionHistoryChartProps {
  weekly: TimelineBucket[];
  monthly: TimelineBucket[];
  loading: boolean;
}

export const SubmissionHistoryChart: React.FC<SubmissionHistoryChartProps> = ({
  weekly,
  monthly,
  loading,
}) => {
  const [granularity, setGranularity] = useState<'week' | 'month'>('week');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const { ref, width } = useContainerWidth(720);

  const buckets = useMemo(() => {
    const raw = granularity === 'week' ? weekly : monthly;
    // Cap displayed bars to keep visual density crisp on very long histories
    if (granularity === 'week' && raw.length > 52) {
      return raw.slice(-52);
    }
    if (granularity === 'month' && raw.length > 36) {
      return raw.slice(-36);
    }
    return raw;
  }, [granularity, weekly, monthly]);

  const height = 260;
  const pad = { top: 18, right: 16, bottom: 32, left: 42 };
  const plotW = Math.max(120, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const maxTotal = useMemo(() => {
    const peak = buckets.reduce((m, b) => Math.max(m, b.total), 0);
    if (peak <= 10) return 10;
    const step = peak > 100 ? 25 : peak > 40 ? 10 : 5;
    return Math.ceil(peak / step) * step;
  }, [buckets]);

  const yTicks = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxTotal * t));
  }, [maxTotal]);

  const activeBucket = hoverIdx !== null && buckets[hoverIdx] ? buckets[hoverIdx] : null;

  const xLabelStep = useMemo(() => {
    if (buckets.length <= 8) return 1;
    return Math.ceil(buckets.length / 8);
  }, [buckets.length]);

  const barStep = buckets.length > 0 ? plotW / buckets.length : plotW;
  const barWidth = Math.max(4, Math.min(26, barStep * 0.68));

  const acLinePath = useMemo(() => {
    if (buckets.length < 2) return '';
    return buckets
      .map((b, i) => {
        const cx = pad.left + i * barStep + barStep / 2;
        const cy = pad.top + plotH - (b.uniqueSolved / Math.max(1, maxTotal)) * plotH;
        return `${i === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
      })
      .join(' ');
  }, [buckets, barStep, maxTotal, pad.left, pad.top, plotH]);

  return (
    <section className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
            Submission History &amp; Verdict Breakdown
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Stacked submission verdicts paired with unique accepted problems per period
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Submission timeline granularity"
            className="inline-flex items-center p-1 bg-stone-100 dark:bg-[#141210] border border-stone-200 dark:border-stone-800 rounded-xl"
          >
            <button
              type="button"
              onClick={() => setGranularity('week')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                granularity === 'week'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setGranularity('month')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                granularity === 'month'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      {/* Live readout strip */}
      <div className="mb-3 min-h-[24px] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-stone-600 dark:text-stone-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-500 inline-block" />
            Accepted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 dark:bg-rose-500 inline-block" />
            Wrong Answer
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 dark:bg-amber-400 inline-block" />
            TLE
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-stone-400 dark:bg-stone-600 inline-block" />
            Other (RE/MLE/CE)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-600 dark:bg-blue-400 inline-block" />
            Unique Solved
          </span>
        </div>

        <div className="font-mono tabular-nums text-stone-700 dark:text-stone-200">
          {activeBucket ? (
            <span>
              {activeBucket.label}: {activeBucket.total} subs ({activeBucket.ok} AC ·{' '}
              {activeBucket.wa} WA · {activeBucket.tle} TLE · {activeBucket.uniqueSolved} unique solved)
            </span>
          ) : (
            <span className="font-sans text-stone-400 dark:text-stone-500">
              Hover bars for period totals
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-[260px] rounded-xl bg-stone-100 dark:bg-stone-800/50 animate-pulse" />
      ) : buckets.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl text-sm text-stone-500 dark:text-stone-400">
          No submissions found in this timeframe.
        </div>
      ) : (
        <div ref={ref} className="w-full relative">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="overflow-visible select-none"
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Horizontal grid lines */}
            {yTicks.map((tick) => {
              const y = pad.top + plotH - (tick / Math.max(1, maxTotal)) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    x2={width - pad.right}
                    y1={y}
                    y2={y}
                    className="stroke-stone-100 dark:stroke-stone-800"
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

            {/* Stacked bars */}
            {buckets.map((b, i) => {
              const x = pad.left + i * barStep + (barStep - barWidth) / 2;
              const isHovered = hoverIdx === i;

              const hOk = (b.ok / Math.max(1, maxTotal)) * plotH;
              const hWa = (b.wa / Math.max(1, maxTotal)) * plotH;
              const hTle = (b.tle / Math.max(1, maxTotal)) * plotH;
              const hOther = (b.other / Math.max(1, maxTotal)) * plotH;

              const yOk = pad.top + plotH - hOk;
              const yWa = yOk - hWa;
              const yTle = yWa - hTle;
              const yOther = yTle - hOther;

              return (
                <g
                  key={b.key}
                  onMouseEnter={() => setHoverIdx(i)}
                  className="cursor-pointer"
                >
                  {/* Full hover hit zone */}
                  <rect
                    x={pad.left + i * barStep}
                    y={pad.top}
                    width={barStep}
                    height={plotH}
                    fill={isHovered ? 'rgba(225, 29, 72, 0.06)' : 'transparent'}
                  />

                  {hOk > 0 && (
                    <rect
                      x={x}
                      y={yOk}
                      width={barWidth}
                      height={hOk}
                      rx={1}
                      className="fill-emerald-600 dark:fill-emerald-500"
                      opacity={hoverIdx === null || isHovered ? 0.92 : 0.45}
                    />
                  )}
                  {hWa > 0 && (
                    <rect
                      x={x}
                      y={yWa}
                      width={barWidth}
                      height={hWa}
                      rx={1}
                      className="fill-rose-500 dark:fill-rose-500"
                      opacity={hoverIdx === null || isHovered ? 0.88 : 0.4}
                    />
                  )}
                  {hTle > 0 && (
                    <rect
                      x={x}
                      y={yTle}
                      width={barWidth}
                      height={hTle}
                      rx={1}
                      className="fill-amber-500 dark:fill-amber-400"
                      opacity={hoverIdx === null || isHovered ? 0.9 : 0.4}
                    />
                  )}
                  {hOther > 0 && (
                    <rect
                      x={x}
                      y={yOther}
                      width={barWidth}
                      height={hOther}
                      rx={1}
                      className="fill-stone-400 dark:fill-stone-600"
                      opacity={hoverIdx === null || isHovered ? 0.85 : 0.35}
                    />
                  )}

                  {i % xLabelStep === 0 && (
                    <text
                      x={pad.left + i * barStep + barStep / 2}
                      y={height - 10}
                      textAnchor="middle"
                      className="fill-stone-400 dark:fill-stone-500 text-[10px] font-mono"
                    >
                      {b.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Unique solved trend overlay */}
            {acLinePath && (
              <path
                d={acLinePath}
                fill="none"
                className="stroke-blue-600 dark:stroke-blue-400 pointer-events-none"
                strokeWidth={2}
                strokeLinejoin="round"
              />
            )}

            {hoverIdx !== null && buckets[hoverIdx] && (
              <circle
                cx={pad.left + hoverIdx * barStep + barStep / 2}
                cy={
                  pad.top +
                  plotH -
                  (buckets[hoverIdx].uniqueSolved / Math.max(1, maxTotal)) * plotH
                }
                r={4}
                className="fill-blue-600 dark:fill-blue-400 stroke-white dark:stroke-[#1B1917] pointer-events-none"
                strokeWidth={2}
              />
            )}
          </svg>
        </div>
      )}
    </section>
  );
};
