import React, { useMemo, useState } from 'react';
import type { HeatmapDay } from '../types/codeforces';

interface ActivityHeatmapProps {
  days: HeatmapDay[];
  currentStreak: number;
  longestStreak: number;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  days,
  currentStreak,
  longestStreak,
}) => {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  const { weeks, monthLabels, totalSolvedYear, totalActiveYear } = useMemo(() => {
    const grouped: HeatmapDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      grouped.push(days.slice(i, i + 7));
    }

    const labels: { colIndex: number; label: string }[] = [];
    let lastMonth = -1;
    grouped.forEach((week, idx) => {
      const firstDay = week[0];
      if (!firstDay) return;
      const m = new Date(firstDay.timestamp * 1000).getMonth();
      if (m !== lastMonth) {
        labels.push({
          colIndex: idx,
          label: new Date(firstDay.timestamp * 1000).toLocaleDateString('en-US', {
            month: 'short',
          }),
        });
        lastMonth = m;
      }
    });

    let solvedSum = 0;
    let activeCount = 0;
    for (const d of days) {
      solvedSum += d.uniqueSolved;
      if (d.totalSubmissions > 0) activeCount += 1;
    }

    return {
      weeks: grouped,
      monthLabels: labels,
      totalSolvedYear: solvedSum,
      totalActiveYear: activeCount,
    };
  }, [days]);

  const getCellColorClass = (day: HeatmapDay): string => {
    if (day.totalSubmissions === 0) {
      return 'bg-stone-100 dark:bg-stone-800/80';
    }
    if (day.uniqueSolved === 0 && day.totalSubmissions > 0) {
      return 'bg-amber-200 dark:bg-amber-900/70';
    }
    if (day.uniqueSolved === 1) {
      return 'bg-emerald-200 dark:bg-emerald-900/70';
    }
    if (day.uniqueSolved <= 3) {
      return 'bg-emerald-400 dark:bg-emerald-700';
    }
    if (day.uniqueSolved <= 5) {
      return 'bg-emerald-500 dark:bg-emerald-500';
    }
    return 'bg-emerald-700 dark:bg-emerald-400';
  };

  return (
    <section className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
            Daily Practice Consistency (Trailing 12 Months)
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
            {totalSolvedYear.toLocaleString()} solves across {totalActiveYear} active days
            <span aria-hidden="true"> · </span>
            Current streak {currentStreak}d
            <span aria-hidden="true"> · </span>
            Longest {longestStreak}d
          </p>
        </div>

        {/* Live hovered day inspector */}
        <div className="text-xs font-mono text-stone-600 dark:text-stone-300 tabular-nums min-h-[20px]">
          {hoveredDay ? (
            <span>
              {hoveredDay.dateLabel} — {hoveredDay.uniqueSolved} solved ·{' '}
              {hoveredDay.totalSubmissions} submissions
              {hoveredDay.topProblem ? ` · Top: ${hoveredDay.topProblem}` : ''}
            </span>
          ) : (
            <span className="text-stone-400 dark:text-stone-500 font-sans">
              Hover any day cell to inspect submissions
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[740px]">
          {/* Month labels */}
          <div className="flex pl-8 mb-1.5 text-[11px] text-stone-400 dark:text-stone-500 relative h-4">
            {monthLabels.map((m) => (
              <span
                key={`${m.colIndex}-${m.label}`}
                style={{ left: `calc(32px + ${(m.colIndex / Math.max(1, weeks.length)) * 100}%)` }}
                className="absolute top-0"
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-1.5">
            {/* Day of week axis */}
            <div className="w-7 flex flex-col justify-between text-[10px] text-stone-400 dark:text-stone-500 py-0.5 shrink-0">
              <span>Sun</span>
              <span>Tue</span>
              <span>Thu</span>
              <span>Sat</span>
            </div>

            {/* Grid of weeks */}
            <div
              className="grid flex-1 gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            >
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-rows-7 gap-[3px]">
                  {week.map((day) => (
                    <button
                      key={day.dateKey}
                      type="button"
                      onMouseEnter={() => setHoveredDay(day)}
                      onFocus={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      aria-label={`${day.dateLabel}: ${day.uniqueSolved} solved, ${day.totalSubmissions} submissions`}
                      className={`aspect-square w-full rounded-[2px] transition-transform duration-100 hover:scale-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 ${getCellColorClass(day)}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between flex-wrap gap-3 text-[11px] text-stone-500 dark:text-stone-400">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[2px] bg-amber-200 dark:bg-amber-900/70 inline-block" />
            Attempted only (no AC)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <span className="w-3 h-3 rounded-[2px] bg-stone-100 dark:bg-stone-800/80 inline-block" />
          <span className="w-3 h-3 rounded-[2px] bg-emerald-200 dark:bg-emerald-900/70 inline-block" />
          <span className="w-3 h-3 rounded-[2px] bg-emerald-400 dark:bg-emerald-700 inline-block" />
          <span className="w-3 h-3 rounded-[2px] bg-emerald-500 dark:bg-emerald-500 inline-block" />
          <span className="w-3 h-3 rounded-[2px] bg-emerald-700 dark:bg-emerald-400 inline-block" />
          <span>More solved</span>
        </div>
      </div>
    </section>
  );
};
