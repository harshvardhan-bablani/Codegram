import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Clock, ExternalLink, RefreshCw, Trophy } from 'lucide-react';
import type { CFBundle, CFContest, ContestRsvp, RsvpStatus } from '../types/codeforces';

interface RoundsViewProps {
  contests: CFContest[];
  loading: boolean;
  error: string | null;
  rsvpsByContest: Record<string, ContestRsvp[]>;
  currentUserId: string | null;
  primaryBundle: CFBundle | null;
  onRefresh: () => void;
  onSetRsvp: (contestId: number, status: RsvpStatus | null) => Promise<void>;
  onSignIn: () => void;
  onOpenUpsolves?: () => void;
}

function formatCountdown(targetSec: number, nowSec: number): string {
  const diff = Math.max(0, targetSec - nowSec);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
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

function formatDuration(durationSeconds: number): string {
  const h = Math.floor(durationSeconds / 3600);
  const m = Math.floor((durationSeconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h 00m`;
}

export const RoundsView: React.FC<RoundsViewProps> = ({
  contests,
  loading,
  error,
  rsvpsByContest,
  currentUserId,
  primaryBundle,
  onRefresh,
  onSetRsvp,
  onSignIn,
  onOpenUpsolves,
}) => {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const upcomingRounds = useMemo(() => {
    return contests
      .filter((c) => c.phase === 'BEFORE' || c.phase === 'CODING')
      .sort((a, b) => (a.startTimeSeconds ?? 0) - (b.startTimeSeconds ?? 0));
  }, [contests]);

  const recentRounds = useMemo(() => {
    return contests
      .filter((c) => c.phase === 'FINISHED')
      .sort((a, b) => (b.startTimeSeconds ?? 0) - (a.startTimeSeconds ?? 0))
      .slice(0, 8);
  }, [contests]);

  const myHistoryByContest = useMemo(() => {
    const map = new Map<number, { rank: number; delta: number; newRating: number }>();
    for (const r of primaryBundle?.ratingHistory ?? []) {
      map.set(r.contestId, {
        rank: r.rank,
        delta: r.newRating - r.oldRating,
        newRating: r.newRating,
      });
    }
    return map;
  }, [primaryBundle]);

  const handlePlan = async (contestId: number, nextStatus: RsvpStatus | null) => {
    if (!currentUserId) {
      onSignIn();
      return;
    }
    setBusyId(contestId);
    try {
      await onSetRsvp(contestId, nextStatus);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              Upcoming Rounds
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Live Codeforces contest schedule, personal participation reminders, and your recent results.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Sync Calendar
        </button>
      </section>

      {error && (
        <div
          role="alert"
          className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 text-xs text-rose-800 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {/* Upcoming & Live Contests */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
            Upcoming &amp; Live ({upcomingRounds.length})
          </h2>
          {!currentUserId && (
            <button
              type="button"
              onClick={onSignIn}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
            >
              Sign in to save contest plans
            </button>
          )}
        </div>

        {loading && upcomingRounds.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-36 rounded-2xl bg-white dark:bg-[#1B1917] border border-stone-200 dark:border-stone-800 animate-pulse"
              />
            ))}
          </div>
        ) : upcomingRounds.length === 0 ? (
          <div className="bg-white dark:bg-[#1B1917] border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center text-sm text-stone-500 dark:text-stone-400">
            No upcoming Codeforces contests listed right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingRounds.map((c) => {
              const isLive = c.phase === 'CODING';
              const startSec = c.startTimeSeconds ?? nowSec;
              const endSec = startSec + c.durationSeconds;
              const rsvps = rsvpsByContest[String(c.id)] ?? [];
              const myRsvp = currentUserId
                ? rsvps.find((r) => r.userId === currentUserId)
                : undefined;

              return (
                <article
                  key={c.id}
                  className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <a
                        href={`https://codeforces.com/contests/${c.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-display text-sm font-bold text-stone-900 dark:text-stone-100 hover:text-rose-600 dark:hover:text-rose-400 leading-snug"
                      >
                        {c.name}
                      </a>
                      <a
                        href={`https://codeforces.com/contestRegistration/${c.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Register for ${c.name}`}
                        className="text-stone-400 hover:text-rose-600 shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatStartDate(c.startTimeSeconds)}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(c.durationSeconds)}
                      </span>
                      <span>·</span>
                      <span className="font-mono">{c.type}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-stone-400 font-medium">
                        {isLive ? 'Contest in progress' : 'Starts in'}
                      </p>
                      <p className="font-mono text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                        {isLive
                          ? `${formatCountdown(endSec, nowSec)} left`
                          : formatCountdown(startSec, nowSec)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() =>
                          handlePlan(c.id, myRsvp?.status === 'competing' ? null : 'competing')
                        }
                        className={`inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                          myRsvp?.status === 'competing'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-rose-600 text-white hover:bg-rose-700'
                        }`}
                      >
                        {myRsvp?.status === 'competing' && <Check className="w-3.5 h-3.5" />}
                        {myRsvp?.status === 'competing' ? 'Planned' : 'Competing'}
                      </button>

                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() =>
                          handlePlan(c.id, myRsvp?.status === 'watching' ? null : 'watching')
                        }
                        className={`px-3 py-2 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                          myRsvp?.status === 'watching'
                            ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                        }`}
                      >
                        Virtual
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Finished Rounds */}
      <section className="bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
              Recent Finished Rounds
            </h2>
          </div>
          {onOpenUpsolves && (
            <button
              type="button"
              onClick={onOpenUpsolves}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0"
            >
              View Contest Upsolves →
            </button>
          )}
        </div>

        <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
          {recentRounds.map((c) => {
            const myRes = myHistoryByContest.get(c.id);

            return (
              <div
                key={c.id}
                className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <a
                    href={`https://codeforces.com/contest/${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-stone-900 dark:text-stone-100 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    {c.name}
                  </a>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                    {formatStartDate(c.startTimeSeconds)} · {formatDuration(c.durationSeconds)} · {c.type}
                  </p>
                </div>

                {myRes ? (
                  <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                    <span className="text-stone-500 dark:text-stone-400 tabular-nums">
                      Rank #{myRes.rank}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        myRes.delta >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {myRes.delta >= 0 ? `+${myRes.delta}` : myRes.delta}
                    </span>
                    <span className="text-stone-600 dark:text-stone-300 tabular-nums">
                      → {myRes.newRating}
                    </span>
                  </div>
                ) : (
                  <a
                    href={`https://codeforces.com/contest/${c.id}/standings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-500 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 whitespace-nowrap shrink-0"
                  >
                    Virtual / Problems →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
