import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  Edit3,
  KeyRound,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  X,
} from 'lucide-react';
import type {
  CommunityContest,
  CommunityContestStatus,
  CommunityInvite,
  CommunityMember,
  CommunityRole,
} from '../types/codeforces';
import {
  assignCommunityHost,
  createCommunityInvite,
  deleteCommunityContest,
  deleteCommunityInvite,
  normalizeInviteCode,
  revokeCommunityHost,
  saveCommunityContest,
  toggleCommunityInvite,
} from '../services/communityService';

interface OrganizerPanelModalProps {
  open: boolean;
  initialSection?: 'contests' | 'invites' | 'hosts';
  isFounder: boolean;
  currentUid: string;
  currentHandle: string;
  contests: CommunityContest[];
  invites: CommunityInvite[];
  roles: CommunityRole[];
  members: CommunityMember[];
  onClose: () => void;
}

function toDatetimeLocal(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export const OrganizerPanelModal: React.FC<OrganizerPanelModalProps> = ({
  open,
  initialSection = 'contests',
  isFounder,
  currentUid,
  currentHandle,
  contests,
  invites,
  roles,
  members,
  onClose,
}) => {
  const [section, setSection] = useState<'contests' | 'invites' | 'hosts'>(initialSection);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSection(initialSection);
    }
  }, [open, initialSection]);
  const [error, setError] = useState<string | null>(null);

  // Contest form state
  const [editingContestId, setEditingContestId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [contestUrl, setContestUrl] = useState('https://codeforces.com/contests');
  const [startsAtLocal, setStartsAtLocal] = useState(() =>
    toDatetimeLocal(Math.floor(Date.now() / 1000) + 7 * 86400)
  );
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [divisionTag, setDivisionTag] = useState('Open');
  const [status, setStatus] = useState<CommunityContestStatus>('upcoming');

  // Invite form state
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLabel, setInviteLabel] = useState('CodeGram Cohort');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Host search
  const [hostSearch, setHostSearch] = useState('');

  const hostUidSet = useMemo(() => new Set(roles.map((r) => r.uid)), [roles]);

  const filteredCandidates = useMemo(() => {
    const q = hostSearch.trim().toLowerCase();
    return members
      .filter((m) => m.uid !== currentUid)
      .filter(
        (m) =>
          !q ||
          m.cfHandle.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [members, hostSearch, currentUid]);

  if (!open) return null;

  const resetContestForm = () => {
    setEditingContestId(undefined);
    setTitle('');
    setSummary('');
    setContestUrl('https://codeforces.com/contests');
    setStartsAtLocal(toDatetimeLocal(Math.floor(Date.now() / 1000) + 7 * 86400));
    setDurationMinutes(120);
    setDivisionTag('Open');
    setStatus('upcoming');
  };

  const loadContestIntoForm = (c: CommunityContest) => {
    setEditingContestId(c.contestId);
    setTitle(c.title);
    setSummary(c.summary ?? '');
    setContestUrl(c.contestUrl);
    setStartsAtLocal(toDatetimeLocal(c.startsAtEpoch));
    setDurationMinutes(c.durationMinutes);
    setDivisionTag(c.divisionTag);
    setStatus(c.status);
    setSection('contests');
  };

  const handleSaveContest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const epoch = Math.floor(new Date(startsAtLocal).getTime() / 1000);
    if (!title.trim() || !contestUrl.trim() || !Number.isFinite(epoch)) {
      setError('Fill in title, Codeforces URL, and start time.');
      return;
    }
    setBusy(true);
    try {
      await saveCommunityContest({
        existingContestId: editingContestId,
        title: title.trim(),
        summary: summary.trim(),
        contestUrl: contestUrl.trim(),
        startsAtEpoch: epoch,
        durationMinutes,
        divisionTag: divisionTag.trim() || 'Open',
        hostUid: currentUid,
        hostHandle: currentHandle || 'organizer',
        status,
      });
      resetContestForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save contest.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = normalizeInviteCode(inviteCode);
    if (clean.length < 4) {
      setError('Invite code needs 4+ uppercase letters or numbers.');
      return;
    }
    setBusy(true);
    try {
      await createCommunityInvite({
        code: clean,
        label: inviteLabel.trim() || 'CodeGram Cohort',
        createdBy: currentUid,
      });
      setInviteCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite code.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Organizer Panel"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white dark:bg-[#121824] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[90vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
              <Shield className="w-4 h-4 text-[#0047CC] dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Organizer Panel
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isFounder ? 'Founder · Full Access' : 'Contest Host'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Organizer Panel"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-200/80 dark:border-slate-800 pb-2.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSection('contests')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 ${
              section === 'contests'
                ? 'bg-[#0047CC] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Contests
          </button>

          {isFounder && (
            <>
              <button
                type="button"
                onClick={() => setSection('invites')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 ${
                  section === 'invites'
                    ? 'bg-[#0047CC] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                Invites
              </button>
              <button
                type="button"
                onClick={() => setSection('hosts')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 ${
                  section === 'hosts'
                    ? 'bg-[#0047CC] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Hosts
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* SECTION 1: CONTESTS */}
        {section === 'contests' && (
          <div className="space-y-4">
            <form onSubmit={handleSaveContest} className="space-y-3 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {editingContestId ? 'Edit CodeGram Contest' : 'New CodeGram Contest'}
                </span>
                {editingContestId && (
                  <button
                    type="button"
                    onClick={resetContestForm}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contest title (e.g. CodeGram Cup #1)"
                  maxLength={120}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
                <input
                  type="url"
                  value={contestUrl}
                  onChange={(e) => setContestUrl(e.target.value)}
                  placeholder="Codeforces contest / mashup URL"
                  maxLength={300}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
                <input
                  type="datetime-local"
                  value={startsAtLocal}
                  onChange={(e) => setStartsAtLocal(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={10}
                    max={1440}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value) || 120)}
                    placeholder="Mins"
                    className="px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={divisionTag}
                    onChange={(e) => setDivisionTag(e.target.value)}
                    placeholder="Div / Open"
                    maxLength={32}
                    className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CommunityContestStatus)}
                    className="px-2 py-2 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="completed">Done</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Short 1-line note (optional)"
                  maxLength={200}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] text-white disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{editingContestId ? 'Save Changes' : 'Publish Contest'}</span>
                </button>
              </div>
            </form>

            {contests.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-3.5">
                {contests.map((c) => {
                  const lockedForNonFounder = c.status === 'completed' && !isFounder;
                  return (
                    <div
                      key={c.contestId}
                      className="py-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {c.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {c.status.toUpperCase()} · {c.divisionTag} · {c.durationMinutes}m
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={lockedForNonFounder}
                          onClick={() => loadContestIntoForm(c)}
                          title={lockedForNonFounder ? 'Completed contests locked for hosts' : 'Edit'}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500 disabled:opacity-40"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteCommunityContest(c.contestId)}
                          title="Delete contest"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: INVITE CODES (Founder only) */}
        {section === 'invites' && isFounder && (
          <div className="space-y-4">
            <form onSubmit={handleCreateInvite} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="CODE (e.g. CODEGRAM2026)"
                maxLength={32}
                className="sm:w-44 px-3 py-2 text-xs font-mono uppercase bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={inviteLabel}
                onChange={(e) => setInviteLabel(e.target.value)}
                placeholder="Cohort label"
                maxLength={80}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#0047CC] hover:bg-[#0039A6] text-white whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Code
              </button>
            </form>

            {invites.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                Create an invite code above so your 300+ members can unlock the community hub.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-3.5">
                {invites.map((inv) => (
                  <div
                    key={inv.code}
                    className="py-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {inv.code}
                        </span>
                        <span
                          className={`text-[10px] font-semibold uppercase ${
                            inv.active
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {inv.active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {inv.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyCode(inv.code)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500"
                        title="Copy invite code"
                      >
                        {copiedCode === inv.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleCommunityInvite(inv.code, !inv.active)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500"
                      >
                        {inv.active ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCommunityInvite(inv.code)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400"
                        title="Delete invite code"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: HOSTS (Founder only) */}
        {section === 'hosts' && isFounder && (
          <div className="space-y-3">
            <input
              type="text"
              value={hostSearch}
              onChange={(e) => setHostSearch(e.target.value)}
              placeholder="Search enrolled members to designate as contest host..."
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0E131D] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
            />

            {filteredCandidates.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                No matching enrolled members found yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-3.5 max-h-64 overflow-y-auto">
                {filteredCandidates.map((m) => {
                  const isAssignedHost = hostUidSet.has(m.uid);
                  return (
                    <div
                      key={m.uid}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          @{m.cfHandle} · {m.displayName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {m.cfRating || 'Unrated'}
                        </p>
                      </div>
                      {isAssignedHost ? (
                        <button
                          type="button"
                          onClick={() => void revokeCommunityHost(m.uid)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                        >
                          <UserMinus className="w-3 h-3" />
                          Revoke Host
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void assignCommunityHost({ member: m, assignedBy: currentUid })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0047CC] dark:text-blue-400 hover:bg-[#0047CC] hover:text-white shrink-0"
                        >
                          <UserCheck className="w-3 h-3" />
                          Make Host
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
