import React from 'react';
import { CheckCircle2, Flame, Target, Zap } from 'lucide-react';
import type { AnalyticsSummary } from '../types/codeforces';

interface KpiStripProps {
  analytics: AnalyticsSummary;
  loading: boolean;
}

export const KpiStrip: React.FC<KpiStripProps> = ({ analytics, loading }) => {
  if (loading) {
    return (
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
    );
  }

  const solveConversion =
    analytics.uniqueAttempted > 0
      ? Math.round((analytics.uniqueSolved / analytics.uniqueAttempted) * 100)
      : 0;

  const items = [
    {
      label: 'Solved',
      value: analytics.uniqueSolved.toLocaleString(),
      subtext: `${solveConversion}% of ${analytics.uniqueAttempted.toLocaleString()} tried`,
      Icon: CheckCircle2,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: '1st-Try AC',
      value: `${analytics.firstTryRate.toFixed(1)}%`,
      subtext: `${analytics.firstTrySolves.toLocaleString()} clean`,
      Icon: Zap,
      iconColor: 'text-amber-500 dark:text-amber-400',
    },
    {
      label: 'Avg Tries',
      value: analytics.avgAttemptsPerSolve > 0 ? analytics.avgAttemptsPerSolve.toFixed(2) : '—',
      subtext: analytics.avgSolvedRating ? `Mean ${analytics.avgSolvedRating}` : 'Unrated',
      Icon: Target,
      iconColor: 'text-[#0047CC] dark:text-blue-400',
    },
    {
      label: 'Streak',
      value: `${analytics.currentStreak}d`,
      subtext: `Best ${analytics.longestStreak}d · ${analytics.activeDays}d`,
      Icon: Flame,
      iconColor: 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {items.map(({ label, value, subtext, Icon, iconColor }) => (
        <div
          key={label}
          className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>
            <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
          </div>
          <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums truncate">
            {value}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
            {subtext}
          </p>
        </div>
      ))}
    </div>
  );
};
