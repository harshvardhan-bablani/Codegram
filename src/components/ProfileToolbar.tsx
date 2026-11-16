import React, { useEffect, useState } from 'react';
import { Edit3, Moon, RefreshCw, Search, Sun } from 'lucide-react';
import type { CFUser, TimeframeKey } from '../types/codeforces';
import {
  SAMPLE_PROFILE_AVATAR,
  getRankColor,
  getRankLabel,
  resolveAvatarUrl,
} from '../utils/analytics';

interface ProfileToolbarProps {
  user: CFUser | null;
  activeHandle: string;
  recentHandles: string[];
  timeframe: TimeframeKey;
  loading: boolean;
  isDark: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelectHandle: (handle: string) => void;
  onRefresh: () => void;
  onChangeTimeframe: (tf: TimeframeKey) => void;
  onToggleTheme: () => void;
}

const TIMEFRAMES: { key: TimeframeKey; label: string }[] = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All Time' },
];

export const ProfileToolbar: React.FC<ProfileToolbarProps> = ({
  user,
  activeHandle,
  recentHandles,
  timeframe,
  loading,
  isDark,
  inputRef,
  onSelectHandle,
  onRefresh,
  onChangeTimeframe,
  onToggleTheme,
}) => {
  const [draftHandle, setDraftHandle] = useState(activeHandle);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showSwitchForm, setShowSwitchForm] = useState(!activeHandle);

  useEffect(() => {
    setDraftHandle(activeHandle);
    setAvatarFailed(false);
    if (activeHandle) setShowSwitchForm(false);
  }, [activeHandle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftHandle.trim();
    if (trimmed) {
      onSelectHandle(trimmed);
    }
  };

  const rankColor = getRankColor(user?.rating, user?.rank);
  const avatarSrc = avatarFailed
    ? SAMPLE_PROFILE_AVATAR
    : resolveAvatarUrl(user?.titlePhoto || user?.avatar);

  return (
    <section
      id="overview"
      className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        {/* Left: Profile Header */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
            <img
              src={avatarSrc}
              alt={`${user?.handle || activeHandle || 'Profile'} avatar`}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h1
                className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate"
                style={{ color: rankColor }}
              >
                {user?.handle ? `@${user.handle}` : activeHandle ? `@${activeHandle}` : 'No handle linked'}
              </h1>
              {user && (
                <span
                  className="font-mono text-sm font-bold tabular-nums"
                  style={{ color: rankColor }}
                >
                  {user.rating ?? 'Unrated'}
                </span>
              )}
            </div>

            {user ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 dark:text-stone-400">
                <span className="font-semibold" style={{ color: rankColor }}>
                  {getRankLabel(user.rank)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Peak {user.maxRating ?? '—'} ({getRankLabel(user.maxRank)})
                </span>
                {user.organization && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate max-w-[220px]">{user.organization}</span>
                  </>
                )}
              </div>
            ) : (
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                {loading
                  ? 'Fetching official Codeforces profile and submission history'
                  : 'Enter your Codeforces handle to load your profile & insights'}
              </p>
            )}
          </div>
        </div>

        {/* Right: Timeframe Filter & Clean Icon Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Timeframe Segmented Control */}
          <div
            role="group"
            aria-label="Timeframe filter"
            className="inline-flex items-center p-1 bg-stone-100 dark:bg-[#141312] border border-stone-200/80 dark:border-stone-800 rounded-xl"
          >
            {TIMEFRAMES.map((tf) => {
              const active = timeframe === tf.key;
              return (
                <button
                  key={tf.key}
                  type="button"
                  onClick={() => onChangeTimeframe(tf.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowSwitchForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5 text-rose-500" />
            <span>Switch</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || !activeHandle}
            title="Refresh data from Codeforces API"
            aria-label="Refresh data from Codeforces API"
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Handle Switcher & Recent Handles */}
      {(showSwitchForm || recentHandles.length > 0) && (
        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {showSwitchForm && (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Search
                  className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={draftHandle}
                  onChange={(e) => setDraftHandle(e.target.value)}
                  placeholder="Codeforces handle..."
                  aria-label="Codeforces handle"
                  className="w-52 pl-9 pr-3 py-2 text-xs bg-stone-50 dark:bg-[#141312] border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !draftHandle.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {loading ? 'Loading...' : 'Load Profile'}
              </button>
            </form>
          )}

          {recentHandles.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Recent:</span>
              {recentHandles.map((h) => {
                const isCurrent = h.toLowerCase() === activeHandle.toLowerCase();
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onSelectHandle(h)}
                    className={`font-mono transition-colors whitespace-nowrap shrink-0 ${
                      isCurrent
                        ? 'text-rose-600 dark:text-rose-400 font-bold underline underline-offset-4'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    @{h}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
