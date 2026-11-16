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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 animate-pulse"
          >
            <div className="h-3.5 w-28 bg-stone-200 dark:bg-stone-800 rounded" />
            <div className="mt-3 h-8 w-20 bg-stone-200 dark:bg-stone-800 rounded" />
            <div className="mt-2 h-3.5 w-36 bg-stone-100 dark:bg-stone-800/70 rounded" />
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
      label: 'Unique Problems Solved',
      value: analytics.uniqueSolved.toLocaleString(),
      subtext: `${analytics.uniqueAttempted.toLocaleString()} attempted · ${solveConversion}% resolved`,
      Icon: CheckCircle2,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'First-Try AC Rate',
      value: `${analytics.firstTryRate.toFixed(1)}%`,
      subtext: `${analytics.firstTrySolves.toLocaleString()} solved on initial submission`,
      Icon: Zap,
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Avg Attempts per Solve',
      value: analytics.avgAttemptsPerSolve > 0 ? analytics.avgAttemptsPerSolve.toFixed(2) : '—',
      subtext: analytics.avgSolvedRating
        ? `Mean solved rating ${analytics.avgSolvedRating}`
        : 'No rated problems in range',
      Icon: Target,
      iconColor: 'text-rose-600 dark:text-rose-400',
    },
    {
      label: 'Current Daily Streak',
      value: `${analytics.currentStreak}d`,
      subtext: `Longest ${analytics.longestStreak}d · ${analytics.activeDays} active days`,
      Icon: Flame,
      iconColor: 'text-amber-500 dark:text-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(({ label, value, subtext, Icon, iconColor }) => (
        <div
          key={label}
          className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</p>
            <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
          </div>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 tabular-nums">
            {value}
          </p>
          <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
            {subtext}
          </p>
        </div>
      ))}
    </div>
  );
};
