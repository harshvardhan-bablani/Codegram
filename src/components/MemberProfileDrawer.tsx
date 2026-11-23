import React, { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Flame,
  Target,
  X,
} from 'lucide-react';
import type { CommunityMember } from '../types/codeforces';
import {
  COMMON_TRAINING_TOPICS,
  SAMPLE_PROFILE_AVATAR,
  getRankColor,
  getRankLabel,
  resolveAvatarUrl,
} from '../utils/analytics';

interface MemberProfileDrawerProps {
  member: CommunityMember | null;
  currentMember: CommunityMember | null;
  isOwnProfile: boolean;
  isHostBadge?: boolean;
  onClose: () => void;
  onPracticeTopic: (topic: string) => void;
  onUpdateTrainingFocus?: (trainingFocus: string[], goalLabel?: string) => Promise<void>;
}

export const MemberProfileDrawer: React.FC<MemberProfileDrawerProps> = ({
  member,
  currentMember,
  isOwnProfile,
  isHostBadge = false,
  onClose,
  onPracticeTopic,
  onUpdateTrainingFocus,
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [editingFocus, setEditingFocus] = useState(false);
  const [draftTopics, setDraftTopics] = useState<string[]>([]);
  const [draftGoal, setDraftGoal] = useState('');
  const [savingFocus, setSavingFocus] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
    setEditingFocus(false);
    if (member) {
      setDraftTopics(member.trainingFocus ?? []);
      setDraftGoal(member.goalLabel ?? '');
    }
  }, [member]);

  if (!member) return null;

  const rankColor = getRankColor(member.cfRating || undefined, member.cfRank);
  const avatarUrl = avatarFailed
    ? SAMPLE_PROFILE_AVATAR
    : resolveAvatarUrl(member.photoUrl);

  const ratingDiff =
    currentMember && !isOwnProfile ? member.cfRating - currentMember.cfRating : null;
  const weeklyDiff =
    currentMember && !isOwnProfile ? member.weeklySolves - currentMember.weeklySolves : null;

  const toggleTopic = (tag: string) => {
    setDraftTopics((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 3) return prev;
      return [...prev, tag];
    });
  };

  const handleSaveFocus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateTrainingFocus) return;
    setSavingFocus(true);
    try {
      await onUpdateTrainingFocus(draftTopics, draftGoal.trim());
      setEditingFocus(false);
    } finally {
      setSavingFocus(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Profile for ${member.cfHandle}`}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-[#121824] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Profile Strip */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
              <img
                src={avatarUrl}
                alt={member.cfHandle}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  className="font-display text-lg font-bold truncate"
                  style={{ color: rankColor }}
                >
                  @{member.cfHandle}
                </h2>
                {isHostBadge && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-[#0047CC] dark:text-blue-400">
                    Host
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                {member.displayName} ·{' '}
                <span className="font-semibold" style={{ color: rankColor }}>
                  {getRankLabel(member.cfRank)}
                </span>
                {member.joinedAt > 0 && (
                  <span className="text-slate-400 dark:text-slate-500">
                    {' '}
                    · Since{' '}
                    {new Date(member.joinedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </p>
              {member.goalLabel && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {member.goalLabel}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close member profile"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Compact Stat Cells */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Rating</span>
              <Award className="w-3.5 h-3.5 text-[#0047CC] dark:text-blue-400 shrink-0" />
            </div>
            <p
              className="mt-1 font-mono text-lg sm:text-xl font-bold tabular-nums truncate"
              style={{ color: member.cfRating ? rankColor : undefined }}
            >
              {member.cfRating || 'Unrated'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
              Peak {member.cfMaxRating || '—'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>7d Solves</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </div>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums truncate">
              {member.weeklySolves}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
              {member.totalSolved.toLocaleString()} total
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Streak</span>
              <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />
            </div>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums truncate">
              {member.currentStreak}d
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Active days</p>
          </div>
        </div>

        {/* Compact Comparison vs Viewer */}
        {ratingDiff !== null && weeklyDiff !== null && (
          <div className="rounded-xl bg-slate-50 dark:bg-[#0E131D] border border-slate-200/70 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between text-xs tabular-nums">
            <span className="text-slate-500 dark:text-slate-400 font-medium">vs You</span>
            <div className="flex items-center gap-3 font-mono font-semibold">
              <span
                className={
                  ratingDiff > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : ratingDiff < 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500'
                }
              >
                {ratingDiff >= 0 ? `+${ratingDiff}` : ratingDiff} rating
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-700 dark:text-slate-300">
                {weeklyDiff >= 0 ? `+${weeklyDiff}` : weeklyDiff} / 7d
              </span>
            </div>
          </div>
        )}

        {/* Training Focus */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Target className="w-3.5 h-3.5 text-[#0047CC] dark:text-blue-400" />
              Training Focus
            </span>
            {isOwnProfile && onUpdateTrainingFocus && !editingFocus && (
              <button
                type="button"
                onClick={() => setEditingFocus(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0047CC] dark:text-blue-400 hover:underline"
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>

          {editingFocus && isOwnProfile ? (
            <form onSubmit={handleSaveFocus} className="space-y-2.5 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {COMMON_TRAINING_TOPICS.map((tag) => {
                  const active = draftTopics.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTopic(tag)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors capitalize ${
                        active
                          ? 'bg-[#0047CC] border-[#0047CC] text-white'
                          : 'bg-white dark:bg-[#121824] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draftGoal}
                  onChange={(e) => setDraftGoal(e.target.value)}
                  placeholder="Short goal (e.g. Aiming 1600)"
                  maxLength={40}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={savingFocus}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#0047CC] text-white disabled:opacity-50 whitespace-nowrap"
                >
                  {savingFocus ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : member.trainingFocus.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No focus topics set yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {member.trainingFocus.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => {
                    onClose();
                    onPracticeTopic(topic);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500 hover:text-[#0047CC] dark:hover:text-blue-400 transition-colors capitalize"
                >
                  <span>{topic}</span>
                  <span className="text-[10px] text-slate-400">→ Practice</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <a
            href={`https://codeforces.com/profile/${encodeURIComponent(member.cfHandle)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 text-white"
          >
            <span>Codeforces Profile</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
