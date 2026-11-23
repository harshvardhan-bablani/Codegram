import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  BarChart3,
  Calendar,
  ChevronRight,
  Clock,
  ExternalLink,
  Search,
  Trophy,
  Users,
} from 'lucide-react';
import type {
  CommunityContest,
  CommunityContestRsvp,
  CommunityMember,
  LeaderboardMetric,
} from '../types/codeforces';
import {
  SAMPLE_PROFILE_AVATAR,
  getRankColor,
  resolveAvatarUrl,
} from '../utils/analytics';
import { InviteJoinCard } from './InviteJoinCard';

interface CommunityViewProps {
  isSignedIn: boolean;
  isFounder: boolean;
  hasHandle: boolean;
  cfHandle?: string;
  authBusy: boolean;
  isEnrolled: boolean;
  currentUid: string | null;
  members: CommunityMember[];
  loadingMembers: boolean;
  communityContests: CommunityContest[];
  communityRsvpsByContest: Record<string, CommunityContestRsvp[]>;
  communityMembersById: Record<string, CommunityMember>;
  onSignIn: () => void;
  onJoinWithInvite: (inviteCode: string) => Promise<void>;
  onSelectMember: (member: CommunityMember) => void;
  onSelectMemberById: (uid: string, fallback?: CommunityContestRsvp) => void;
  onOpenInvites?: () => void;
}

type TierFilter = 'all' | '1600+' | '1400+' | '1200+' | 'under1200';

const PAGE_SIZE = 30;

function formatCountdown(targetSec: number, nowSec: number): string {
  const diff = Math.max(0, targetSec - nowSec);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatStartDate(epochSec?: number): string {
  if (!epochSec) return 'TBD';
  return new Date(epochSec * 1000).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h 00m`;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  isSignedIn,
  isFounder,
  hasHandle,
  cfHandle,
  authBusy,
  isEnrolled,
  currentUid,
  members,
  loadingMembers,
  communityContests,
  communityRsvpsByContest,
  communityMembersById,
  onSignIn,
  onJoinWithInvite,
  onSelectMember,
  onSelectMemberById,
  onOpenInvites,
}) => {
  const [metric, setMetric] = useState<LeaderboardMetric>('rating');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const upcomingCodeGramContests = useMemo(() => {
    return communityContests
      .filter((c) => c.status !== 'completed')
      .sort((a, b) => a.startsAtEpoch - b.startsAtEpoch);
  }, [communityContests]);

  const featuredContest = upcomingCodeGramContests[0] ?? null;
  const secondaryContests = upcomingCodeGramContests.slice(1);

  const rankedMembers = useMemo(() => {
    const copy = [...members];
    copy.sort((a, b) => {
      if (metric === 'weekly') {
        return (
          b.weeklySolves - a.weeklySolves ||
          b.cfRating - a.cfRating ||
          b.currentStreak - a.currentStreak
        );
      }
      return (
        b.cfRating - a.cfRating ||
        b.weeklySolves - a.weeklySolves ||
        b.totalSolved - a.totalSolved
      );
    });
    return copy.map((m, idx) => ({ member: m, rank: idx + 1 }));
  }, [members, metric]);

  const myRankedEntry = useMemo(() => {
    if (!currentUid) return null;
    return rankedMembers.find((r) => r.member.uid === currentUid) ?? null;
  }, [rankedMembers, currentUid]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rankedMembers.filter(({ member }) => {
      if (
        q &&
        !member.cfHandle.toLowerCase().includes(q) &&
        !member.displayName.toLowerCase().includes(q) &&
        !member.trainingFocus.some((t) => t.toLowerCase().includes(q))
      ) {
        return false;
      }
      if (tierFilter === '1600+' && member.cfRating < 1600) return false;
      if (tierFilter === '1400+' && member.cfRating < 1400) return false;
      if (tierFilter === '1200+' && member.cfRating < 1200) return false;
      if (tierFilter === 'under1200' && member.cfRating >= 1200) return false;
      return true;
    });
  }, [rankedMembers, searchQuery, tierFilter]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);

  const communityStats = useMemo(() => {
    const total = members.length;
    const ratedMembers = members.filter((m) => m.cfRating > 0);
    const avgRating =
      ratedMembers.length > 0
        ? Math.round(ratedMembers.reduce((s, m) => s + m.cfRating, 0) / ratedMembers.length)
        : 0;
    const topRating = ratedMembers.reduce((max, m) => Math.max(max, m.cfRating), 0);

    const tiers = [
      {
        label: '1600+ Expert',
        color: getRankColor(1600, 'expert'),
        count: ratedMembers.filter((m) => m.cfRating >= 1600).length,
      },
      {
        label: '1400–1599 Specialist',
        color: getRankColor(1400, 'specialist'),
        count: ratedMembers.filter((m) => m.cfRating >= 1400 && m.cfRating < 1600).length,
      },
      {
        label: '1200–1399 Pupil',
        color: getRankColor(1200, 'pupil'),
        count: ratedMembers.filter((m) => m.cfRating >= 1200 && m.cfRating < 1400).length,
      },
      {
        label: '<1200 Newbie',
        color: getRankColor(800, 'newbie'),
        count: ratedMembers.filter((m) => m.cfRating < 1200).length,
      },
    ];

    const focusCounts = new Map<string, number>();
    for (const m of members) {
      for (const topic of m.trainingFocus) {
        focusCounts.set(topic, (focusCounts.get(topic) ?? 0) + 1);
      }
    }
    const topTopics = Array.from(focusCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      total,
      ratedCount: ratedMembers.length,
      avgRating,
      topRating,
      tiers,
      topTopics,
    };
  }, [members]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Minimal Community Context Bar */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          <Users className="w-3.5 h-3.5 text-[#0047CC] dark:text-blue-400 shrink-0" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">CodeGram</span>
          <span>·</span>
          <span>
            {isEnrolled
              ? `${members.length} ${members.length === 1 ? 'member' : 'members'}`
              : 'Invite-only community'}
          </span>
        </div>

        {isFounder && onOpenInvites && (
          <button
            type="button"
            onClick={onOpenInvites}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-[#0047CC] dark:hover:text-blue-400 whitespace-nowrap"
          >
            Invites
          </button>
        )}
      </div>

      {/* 1. HERO FOCUS: UPCOMING CODEGRAM CONTEST (Single Codeforces Redirect Button) */}
      <section aria-label="Upcoming CodeGram Contest" className="space-y-3">
        {!featuredContest ? (
          <div className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-8 text-center">
            <p className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              No Upcoming CodeGram Contests
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Check back soon for the next CodeGram round on Codeforces.
            </p>
          </div>
        ) : (
          (() => {
            const c = featuredContest;
            const isLive = c.status === 'live';
            const endSec = c.startsAtEpoch + c.durationMinutes * 60;
            const rsvps = communityRsvpsByContest[c.contestId] ?? [];

            return (
              <article className="bg-white dark:bg-[#121824] border border-blue-200 dark:border-blue-900/70 rounded-2xl p-5 sm:p-7 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                  <div className="space-y-2.5 min-w-0">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#0047CC] dark:text-blue-400">
                      <span>{isLive ? 'Live Now' : 'Upcoming Contest'}</span>
                      <span>·</span>
                      <span>{c.platform}</span>
                      <span>·</span>
                      <span>{c.divisionTag}</span>
                    </div>

                    <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                      {c.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Calendar className="w-4 h-4 text-[#0047CC] dark:text-blue-400" />
                        {formatStartDate(c.startsAtEpoch)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {formatDuration(c.durationMinutes)}
                      </span>
                    </div>
                  </div>

                  {/* Countdown & Single Codeforces Redirect CTA */}
                  <div className="flex flex-col sm:flex-row lg:flex-col lg:items-end justify-between gap-3.5 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800/80">
                    <div className="lg:text-right">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {isLive ? 'Time remaining' : 'Starts in'}
                      </p>
                      <p className="font-mono text-2xl sm:text-3xl font-bold text-[#0047CC] dark:text-blue-400 tabular-nums tracking-tight mt-0.5">
                        {isLive
                          ? `${formatCountdown(endSec, nowSec)} left`
                          : formatCountdown(c.startsAtEpoch, nowSec)}
                      </p>
                    </div>

                    <a
                      href={c.contestUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
                    >
                      <span>Open on Codeforces</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {isEnrolled && rsvps.length > 0 && (
                  <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      <Users className="w-3.5 h-3.5" />
                      {rsvps.length} going:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {rsvps.slice(0, 8).map((r) => {
                        const m = communityMembersById[r.userId];
                        return (
                          <button
                            key={r.userId}
                            type="button"
                            onClick={() => onSelectMemberById(r.userId, r)}
                            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold hover:underline"
                            style={{ color: getRankColor(m?.cfRating ?? r.cfRating) }}
                          >
                            <img
                              src={resolveAvatarUrl(m?.photoUrl ?? r.photoUrl) || SAMPLE_PROFILE_AVATAR}
                              alt={r.cfHandle}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.src = SAMPLE_PROFILE_AVATAR;
                              }}
                              className="w-4 h-4 rounded-full object-cover"
                            />
                            @{r.cfHandle}
                          </button>
                        );
                      })}
                      {rsvps.length > 8 && (
                        <span className="text-xs text-slate-400 font-mono">
                          +{rsvps.length - 8}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })()
        )}

        {secondaryContests.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {secondaryContests.map((c) => (
              <article
                key={c.contestId}
                className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {c.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                    {formatStartDate(c.startsAtEpoch)} · {formatDuration(c.durationMinutes)}
                  </p>
                </div>
                <a
                  href={c.contestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white whitespace-nowrap shrink-0"
                >
                  <span>Codeforces</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      {!isEnrolled ? (
        <div className="py-1">
          <InviteJoinCard
            isSignedIn={isSignedIn}
            isFounder={isFounder}
            hasHandle={hasHandle}
            cfHandle={cfHandle}
            authBusy={authBusy}
            onSignIn={onSignIn}
            onJoinWithInvite={onJoinWithInvite}
          />
        </div>
      ) : (
        /* 2. PARALLEL SIDE-BY-SIDE: LEADERBOARD & COMMUNITY STATS */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Community Leaderboard */}
          <section
            className="lg:col-span-7 space-y-3 min-w-0"
            aria-label="Community Leaderboard"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  Leaderboard
                </h2>
              </div>

              {myRankedEntry && (
                <button
                  type="button"
                  onClick={() => onSelectMember(myRankedEntry.member)}
                  className="inline-flex items-center gap-2 text-xs font-mono tabular-nums px-2.5 py-1 rounded-xl bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 transition-colors"
                >
                  <span className="font-bold text-[#0047CC] dark:text-blue-400">
                    You #{myRankedEntry.rank}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span
                    className="font-bold"
                    style={{ color: getRankColor(myRankedEntry.member.cfRating || undefined) }}
                  >
                    {myRankedEntry.member.cfRating || 'Unrated'}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {myRankedEntry.member.weeklySolves}/7d
                  </span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 self-start">
                {(
                  [
                    { key: 'rating', label: 'Rating' },
                    { key: 'weekly', label: '7d Solves' },
                  ] as { key: LeaderboardMetric; label: string }[]
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setMetric(item.key);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      metric === item.key
                        ? 'bg-[#0047CC] text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-44">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    placeholder="Handle or name..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={tierFilter}
                  onChange={(e) => {
                    setTierFilter(e.target.value as TierFilter);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  aria-label="Filter by rating"
                  className="px-2 py-1.5 text-xs bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                >
                  <option value="all">All</option>
                  <option value="1600+">1600+</option>
                  <option value="1400+">1400+</option>
                  <option value="1200+">1200+</option>
                  <option value="under1200">&lt; 1200</option>
                </select>
              </div>
            </div>

            <div className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden">
              {loadingMembers && members.length === 0 ? (
                <div className="p-4 space-y-2.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse"
                    />
                  ))}
                </div>
              ) : visibleEntries.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Trophy className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    No members match this filter
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Try clearing search or rank filter.
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <div className="col-span-1">#</div>
                    <div className="col-span-7">Member</div>
                    <div className="col-span-2 text-right">Rating</div>
                    <div className="col-span-2 text-right">7d</div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {visibleEntries.map(({ member, rank }) => {
                      const isSelf = member.uid === currentUid;
                      const rankColor = getRankColor(member.cfRating || undefined, member.cfRank);
                      return (
                        <button
                          key={member.uid}
                          type="button"
                          onClick={() => onSelectMember(member)}
                          className={`w-full text-left px-3.5 sm:px-4 py-3 grid grid-cols-12 items-center gap-2 hover:bg-slate-50/90 dark:hover:bg-slate-800/35 transition-colors ${
                            isSelf ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                          }`}
                        >
                          <div className="col-span-2 sm:col-span-1 font-mono text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                            #{rank}
                          </div>

                          <div className="col-span-6 sm:col-span-7 flex items-center gap-2.5 min-w-0">
                            <img
                              src={resolveAvatarUrl(member.photoUrl) || SAMPLE_PROFILE_AVATAR}
                              alt={member.cfHandle}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.src = SAMPLE_PROFILE_AVATAR;
                              }}
                              className="w-8 h-8 rounded-full object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                            />
                            <div className="min-w-0">
                              <p
                                className="text-xs sm:text-sm font-semibold truncate"
                                style={{ color: rankColor }}
                              >
                                @{member.cfHandle}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate capitalize">
                                {member.trainingFocus.length > 0
                                  ? member.trainingFocus.slice(0, 2).join(' · ')
                                  : member.displayName}
                              </p>
                            </div>
                          </div>

                          <div className="col-span-4 sm:col-span-2 text-right font-mono text-xs sm:text-sm font-bold tabular-nums">
                            <span style={{ color: member.cfRating ? rankColor : undefined }}>
                              {member.cfRating || '—'}
                            </span>
                            <span className="sm:hidden block text-[10px] font-normal text-slate-400">
                              {member.weeklySolves}/7d
                            </span>
                          </div>

                          <div className="hidden sm:flex sm:col-span-2 items-center justify-end gap-1 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                            <span>{member.weeklySolves}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {filteredEntries.length > visibleCount && (
                    <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                        Show more ({filteredEntries.length - visibleCount} left)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Right Column: Community Stats */}
          <section
            className="lg:col-span-5 space-y-3 min-w-0"
            aria-label="Community Stats"
          >
            <div className="flex items-center gap-2 px-1">
              <BarChart3 className="w-4 h-4 text-[#0047CC] dark:text-blue-400 shrink-0" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Community Stats
              </h2>
            </div>

            <div className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Enrolled
                  </p>
                  <p className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {communityStats.total}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {communityStats.ratedCount} rated
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Avg Rating
                  </p>
                  <p
                    className="font-mono text-xl font-bold tabular-nums mt-0.5"
                    style={{
                      color: communityStats.avgRating
                        ? getRankColor(communityStats.avgRating)
                        : undefined,
                    }}
                  >
                    {communityStats.avgRating || '—'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Top {communityStats.topRating || '—'}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Rank Tiers
                  </p>
                  <div className="space-y-2">
                    {communityStats.tiers.map((tier) => {
                      const pct =
                        communityStats.ratedCount > 0
                          ? Math.round((tier.count / communityStats.ratedCount) * 100)
                          : 0;
                      return (
                        <div key={tier.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs tabular-nums">
                            <span className="font-semibold" style={{ color: tier.color }}>
                              {tier.label}
                            </span>
                            <span className="font-mono text-slate-500 dark:text-slate-400">
                              {tier.count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: tier.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Top Training Focus
                  </p>
                  {communityStats.topTopics.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No focus topics set yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {communityStats.topTopics.map(([topic, count]) => (
                        <div
                          key={topic}
                          className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                        >
                          <span className="capitalize font-medium text-slate-800 dark:text-slate-200">
                            {topic}
                          </span>
                          <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                            {count} {count === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
