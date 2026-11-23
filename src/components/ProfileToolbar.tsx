import React, { useEffect, useState } from 'react';
import { ExternalLink, Moon, RefreshCw, Sun } from 'lucide-react';
import type { CFUser, CommunityMember } from '../types/codeforces';
import {
  SAMPLE_PROFILE_AVATAR,
  getRankColor,
  getRankLabel,
  resolveAvatarUrl,
} from '../utils/analytics';

interface ProfileToolbarProps {
  user: CFUser | null;
  displayName: string;
  activeHandle: string;
  loading: boolean;
  isDark: boolean;
  communityMember: CommunityMember | null;
  communityRank: number | null;
  communityMemberCount: number;
  onOpenCommunity: () => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
}

function formatMemberSince(epochMs?: number): string {
  if (!epochMs) return '—';
  return new Date(epochMs).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function capitalizeName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Member';
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const ProfileToolbar: React.FC<ProfileToolbarProps> = ({
  user,
  displayName,
  activeHandle,
  loading,
  isDark,
  communityMember,
  communityRank,
  communityMemberCount,
  onOpenCommunity,
  onRefresh,
  onToggleTheme,
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [activeHandle]);

  const boundHandle = communityMember?.cfHandle || user?.handle || activeHandle;
  const rankColor = getRankColor(
    user?.rating ?? communityMember?.cfRating,
    user?.rank ?? communityMember?.cfRank
  );
  const avatarSrc = avatarFailed
    ? SAMPLE_PROFILE_AVATAR
    : resolveAvatarUrl(user?.titlePhoto || user?.avatar || communityMember?.photoUrl);

  const resolvedName = capitalizeName(
    displayName.trim() || communityMember?.displayName || boundHandle || 'Member'
  );
  const joinedLabel = formatMemberSince(communityMember?.joinedAt);

  return (
    <section
      id="overview"
      aria-label="You"
      className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-5">
        {/* Left: Personal Identity, Bound Handle & Compact Join Date */}
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <img
              src={avatarSrc}
              alt={`${resolvedName} avatar`}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0 space-y-1">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {resolvedName}
            </h1>

            <div className="flex items-center gap-2 flex-wrap">
              {boundHandle && (
                <a
                  href={`https://codeforces.com/profile/${encodeURIComponent(boundHandle)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-sm font-bold hover:underline whitespace-nowrap shrink-0"
                  style={{ color: rankColor }}
                >
                  <span>@{boundHandle}</span>
                  <ExternalLink className="w-3 h-3 opacity-75" />
                </a>
              )}
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span className="font-semibold" style={{ color: rankColor }}>
                  {getRankLabel(user.rank)}
                </span>
                <span aria-hidden="true">·</span>
                <span>
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {loading ? 'Loading Codeforces profile...' : 'Bound Codeforces account'}
              </p>
            )}

            {communityMember && (
              <p className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                Member since {joinedLabel}
              </p>
            )}
          </div>
        </div>

        {/* Right: Highlighted Community Rank + Prominent Sync CTA + Theme */}
        <div className="flex items-center justify-between lg:justify-end gap-4 sm:gap-5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={onOpenCommunity}
            className="text-left lg:text-right sm:pr-5 sm:border-r sm:border-slate-200 dark:sm:border-slate-800 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          >
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 group-hover:text-[#0047CC] dark:group-hover:text-blue-400 transition-colors">
              Community Rank
            </p>
            <div className="mt-0.5 flex items-baseline lg:justify-end gap-1.5 tabular-nums">
              <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[#0047CC] dark:text-blue-400 leading-none">
                {communityRank ? `#${communityRank}` : '—'}
              </span>
              {communityMemberCount > 0 && (
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  of {communityMemberCount}
                </span>
              )}
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || !boundHandle}
              aria-label="Sync Codeforces data"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Syncing...' : 'Sync'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
