import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  CommunityContest,
  CommunityContestRsvp,
  CommunityContestStatus,
  CommunityInvite,
  CommunityMember,
  CommunityRole,
  RsvpStatus,
} from '../types/codeforces';
import type { MemberCommunityMetrics } from '../utils/analytics';

export const FOUNDER_EMAIL = 'harshvardhanbablani@gmail.com';
export const DEFAULT_PLATFORM_INVITE_CODE = 'CODEGRAM_WEB';
export const WHATSAPP_COMMUNITY_URL =
  import.meta.env.VITE_WHATSAPP_COMMUNITY_URL ||
  'https://chat.whatsapp.com/GQQ8H6eYHP5HjBk7NJz2hb?s=cl&p=i&iam=2';

function toEpochMs(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  return Date.now();
}

function clampStr(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

function clampNum(val: number, minVal: number, maxVal: number): number {
  if (!Number.isFinite(val)) return minVal;
  return Math.max(minVal, Math.min(maxVal, Math.round(val)));
}

export function normalizeInviteCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
}

export function sanitizeContestDocId(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || `cg_${Date.now()}`).slice(0, 64);
}

function normalizeTrainingFocus(tags: string[]): string[] {
  const unique: string[] = [];
  for (const t of tags) {
    const clean = clampStr(t, 40);
    if (clean && !unique.includes(clean)) {
      unique.push(clean);
    }
    if (unique.length >= 3) break;
  }
  return unique;
}

function mapMemberDoc(d: Record<string, unknown>): CommunityMember {
  return {
    uid: String(d.uid),
    displayName: String(d.displayName),
    photoUrl: typeof d.photoUrl === 'string' ? d.photoUrl : undefined,
    cfHandle: String(d.cfHandle),
    cfRating: typeof d.cfRating === 'number' ? d.cfRating : 0,
    cfMaxRating: typeof d.cfMaxRating === 'number' ? d.cfMaxRating : 0,
    cfRank: typeof d.cfRank === 'string' ? d.cfRank : 'unrated',
    lastContestDelta: typeof d.lastContestDelta === 'number' ? d.lastContestDelta : 0,
    weeklySolves: typeof d.weeklySolves === 'number' ? d.weeklySolves : 0,
    currentStreak: typeof d.currentStreak === 'number' ? d.currentStreak : 0,
    totalSolved: typeof d.totalSolved === 'number' ? d.totalSolved : 0,
    trainingFocus: Array.isArray(d.trainingFocus)
      ? d.trainingFocus.filter((x): x is string => typeof x === 'string').slice(0, 3)
      : [],
    goalLabel: typeof d.goalLabel === 'string' ? d.goalLabel : undefined,
    inviteCode: String(d.inviteCode || ''),
    isCommunityVisible: Boolean(d.isCommunityVisible),
    joinedAt: toEpochMs(d.joinedAt),
    updatedAt: toEpochMs(d.updatedAt),
  };
}

// ---------------------------------------------------------
// Membership & Role Lookups
// ---------------------------------------------------------
export async function getOwnCommunityMember(uid: string): Promise<CommunityMember | null> {
  const path = `communityMembers/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'communityMembers', uid));
    if (!snap.exists()) return null;
    return mapMemberDoc(snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getOwnCommunityRole(uid: string): Promise<CommunityRole | null> {
  const path = `communityRoles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'communityRoles', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: String(d.uid),
      role: 'host',
      cfHandle: String(d.cfHandle),
      displayName: String(d.displayName),
      assignedBy: String(d.assignedBy),
      createdAt: toEpochMs(d.createdAt),
      updatedAt: toEpochMs(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function verifyInviteCode(rawCode: string): Promise<CommunityInvite | null> {
  const code = normalizeInviteCode(rawCode);
  if (code.length < 4) return null;
  const path = `communityInvites/${code}`;
  try {
    const snap = await getDoc(doc(db, 'communityInvites', code));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (!d.active) return null;
    return {
      code: String(d.code),
      label: String(d.label),
      active: Boolean(d.active),
      createdBy: String(d.createdBy),
      createdAt: toEpochMs(d.createdAt),
      updatedAt: toEpochMs(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function joinCommunityWithInvite(params: {
  uid: string;
  isFounder: boolean;
  inviteCode: string;
  displayName: string;
  photoUrl?: string;
  cfHandle: string;
  metrics: MemberCommunityMetrics;
  trainingFocus?: string[];
  goalLabel?: string;
}): Promise<CommunityMember> {
  const normalizedCode = params.isFounder
    ? normalizeInviteCode(params.inviteCode || 'FOUNDER') || 'FOUNDER'
    : normalizeInviteCode(params.inviteCode);

  if (!params.isFounder && normalizedCode !== DEFAULT_PLATFORM_INVITE_CODE) {
    if (normalizedCode.length < 4) {
      throw new Error('Invite code must be at least 4 characters.');
    }
    const valid = await verifyInviteCode(normalizedCode);
    if (!valid) {
      throw new Error('Invalid or inactive CodeGram invite code.');
    }
  }

  const path = `communityMembers/${params.uid}`;
  const cleanFocus = normalizeTrainingFocus(params.trainingFocus ?? []);
  const cleanGoal = params.goalLabel ? clampStr(params.goalLabel, 40) : '';

  const payload: Record<string, unknown> = {
    uid: params.uid,
    displayName: clampStr(params.displayName || params.cfHandle || 'Member', 80),
    cfHandle: clampStr(params.cfHandle, 64),
    cfRating: clampNum(params.metrics.cfRating, 0, 6000),
    cfMaxRating: clampNum(params.metrics.cfMaxRating, 0, 6000),
    cfRank: clampStr(params.metrics.cfRank || 'unrated', 40),
    lastContestDelta: clampNum(params.metrics.lastContestDelta, -3000, 3000),
    weeklySolves: clampNum(params.metrics.weeklySolves, 0, 10000),
    currentStreak: clampNum(params.metrics.currentStreak, 0, 5000),
    totalSolved: clampNum(params.metrics.totalSolved, 0, 50000),
    trainingFocus: cleanFocus,
    inviteCode: normalizedCode,
    isCommunityVisible: true,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.photoUrl && params.photoUrl.trim()) {
    payload.photoUrl = clampStr(params.photoUrl, 500);
  }
  if (cleanGoal) {
    payload.goalLabel = cleanGoal;
  }

  try {
    await setDoc(doc(db, 'communityMembers', params.uid), payload);
    return {
      uid: params.uid,
      displayName: String(payload.displayName),
      photoUrl: typeof payload.photoUrl === 'string' ? payload.photoUrl : undefined,
      cfHandle: String(payload.cfHandle),
      cfRating: Number(payload.cfRating),
      cfMaxRating: Number(payload.cfMaxRating),
      cfRank: String(payload.cfRank),
      lastContestDelta: Number(payload.lastContestDelta),
      weeklySolves: Number(payload.weeklySolves),
      currentStreak: Number(payload.currentStreak),
      totalSolved: Number(payload.totalSolved),
      trainingFocus: cleanFocus,
      goalLabel: cleanGoal || undefined,
      inviteCode: normalizedCode,
      isCommunityVisible: true,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function joinCommunityDefault(params: {
  uid: string;
  isFounder: boolean;
  displayName: string;
  photoUrl?: string;
  cfHandle: string;
  metrics: MemberCommunityMetrics;
}): Promise<CommunityMember> {
  return joinCommunityWithInvite({
    uid: params.uid,
    isFounder: params.isFounder,
    inviteCode: params.isFounder ? 'FOUNDER' : DEFAULT_PLATFORM_INVITE_CODE,
    displayName: params.displayName,
    photoUrl: params.photoUrl,
    cfHandle: params.cfHandle,
    metrics: params.metrics,
  });
}

export async function syncOwnCommunityMemberStats(params: {
  uid: string;
  displayName: string;
  photoUrl?: string;
  cfHandle: string;
  metrics: MemberCommunityMetrics;
}): Promise<void> {
  const path = `communityMembers/${params.uid}`;
  const payload: Record<string, unknown> = {
    displayName: clampStr(params.displayName || params.cfHandle || 'Member', 80),
    cfHandle: clampStr(params.cfHandle, 64),
    cfRating: clampNum(params.metrics.cfRating, 0, 6000),
    cfMaxRating: clampNum(params.metrics.cfMaxRating, 0, 6000),
    cfRank: clampStr(params.metrics.cfRank || 'unrated', 40),
    lastContestDelta: clampNum(params.metrics.lastContestDelta, -3000, 3000),
    weeklySolves: clampNum(params.metrics.weeklySolves, 0, 10000),
    currentStreak: clampNum(params.metrics.currentStreak, 0, 5000),
    totalSolved: clampNum(params.metrics.totalSolved, 0, 50000),
    isCommunityVisible: true,
    updatedAt: serverTimestamp(),
  };

  if (params.photoUrl && params.photoUrl.trim()) {
    payload.photoUrl = clampStr(params.photoUrl, 500);
  }

  try {
    await updateDoc(doc(db, 'communityMembers', params.uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOwnTrainingFocus(
  uid: string,
  trainingFocus: string[],
  goalLabel?: string
): Promise<void> {
  const path = `communityMembers/${uid}`;
  const cleanFocus = normalizeTrainingFocus(trainingFocus);
  const cleanGoal = goalLabel ? clampStr(goalLabel, 40) : '';

  const payload: Record<string, unknown> = {
    trainingFocus: cleanFocus,
    goalLabel: cleanGoal ? cleanGoal : deleteField(),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'communityMembers', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------
// Leaderboard & Community Member Directory
// ---------------------------------------------------------
export function subscribeCommunityMembers(
  onChange: (members: CommunityMember[]) => void
): Unsubscribe {
  const path = 'communityMembers';
  const q = query(
    collection(db, 'communityMembers'),
    where('isCommunityVisible', '==', true),
    limit(500)
  );
  return onSnapshot(
    q,
    (snap) => {
      const members = snap.docs.map((docSnap) => mapMemberDoc(docSnap.data()));
      onChange(members);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ---------------------------------------------------------
// Community Hosted Contests & RSVPs
// ---------------------------------------------------------
export function subscribeCommunityContests(
  onChange: (contests: CommunityContest[]) => void
): Unsubscribe {
  const path = 'communityContests';
  const q = query(
    collection(db, 'communityContests'),
    where('isCommunityVisible', '==', true),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: CommunityContest[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          contestId: String(d.contestId),
          title: String(d.title),
          summary: typeof d.summary === 'string' ? d.summary : undefined,
          platform: 'Codeforces',
          contestUrl: String(d.contestUrl),
          startsAtEpoch: Number(d.startsAtEpoch),
          durationMinutes: Number(d.durationMinutes),
          divisionTag: String(d.divisionTag),
          hostUid: String(d.hostUid),
          hostHandle: String(d.hostHandle),
          status:
            d.status === 'live'
              ? 'live'
              : d.status === 'completed'
              ? 'completed'
              : 'upcoming',
          isCommunityVisible: Boolean(d.isCommunityVisible),
          createdAt: toEpochMs(d.createdAt),
          updatedAt: toEpochMs(d.updatedAt),
        };
      });
      items.sort((a, b) => a.startsAtEpoch - b.startsAtEpoch);
      onChange(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeCommunityContestRsvps(
  contestIds: string[],
  onChange: (byContest: Record<string, CommunityContestRsvp[]>) => void
): Unsubscribe {
  const targetIds = contestIds.slice(0, 12);
  if (targetIds.length === 0) {
    onChange({});
    return () => {};
  }

  const state: Record<string, CommunityContestRsvp[]> = {};
  const unsubs = targetIds.map((cid) => {
    const path = `communityContests/${cid}/rsvps`;
    const q = query(
      collection(db, 'communityContests', cid, 'rsvps'),
      where('isCommunityVisible', '==', true),
      limit(400)
    );
    return onSnapshot(
      q,
      (snap) => {
        state[cid] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            userId: String(d.userId),
            contestId: String(d.contestId),
            cfHandle: String(d.cfHandle),
            displayName: String(d.displayName),
            photoUrl: typeof d.photoUrl === 'string' ? d.photoUrl : undefined,
            cfRating: typeof d.cfRating === 'number' ? d.cfRating : 0,
            status: d.status === 'watching' ? 'watching' : 'competing',
            isCommunityVisible: Boolean(d.isCommunityVisible),
            updatedAt: toEpochMs(d.updatedAt),
          };
        });
        state[cid].sort((a, b) => b.cfRating - a.cfRating);
        onChange({ ...state });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  });

  return () => {
    for (const u of unsubs) u();
  };
}

export async function setCommunityContestRsvp(params: {
  contestId: string;
  userId: string;
  cfHandle: string;
  displayName: string;
  photoUrl?: string;
  cfRating: number;
  status: RsvpStatus;
}): Promise<void> {
  const path = `communityContests/${params.contestId}/rsvps/${params.userId}`;
  const payload: Record<string, unknown> = {
    userId: params.userId,
    contestId: clampStr(params.contestId, 64),
    cfHandle: clampStr(params.cfHandle, 64),
    displayName: clampStr(params.displayName || params.cfHandle, 80),
    cfRating: clampNum(params.cfRating, 0, 6000),
    status: params.status,
    isCommunityVisible: true,
    updatedAt: serverTimestamp(),
  };
  if (params.photoUrl && params.photoUrl.trim()) {
    payload.photoUrl = clampStr(params.photoUrl, 500);
  }

  try {
    await setDoc(doc(db, 'communityContests', params.contestId, 'rsvps', params.userId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeCommunityContestRsvp(
  contestId: string,
  userId: string
): Promise<void> {
  const path = `communityContests/${contestId}/rsvps/${userId}`;
  try {
    await deleteDoc(doc(db, 'communityContests', contestId, 'rsvps', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------
// Backend Contest Catalog & Seed Sync
// ---------------------------------------------------------
export function getDefaultTestingContest(
  hostUid = 'founder',
  hostHandle = 'codegram'
): CommunityContest {
  const startsAtEpoch = Math.floor(new Date(2026, 11, 13, 20, 0, 0).getTime() / 1000);
  return {
    contestId: 'codegram_round_1',
    title: 'CodeGram Round 1',
    summary: 'CodeGram community round on Codeforces.',
    platform: 'Codeforces',
    contestUrl: 'https://codeforces.com/contests',
    startsAtEpoch,
    durationMinutes: 120,
    divisionTag: 'Open',
    hostUid,
    hostHandle,
    status: 'upcoming',
    isCommunityVisible: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function ensureBackendTestingContestSeeded(
  uid: string,
  hostHandle: string
): Promise<void> {
  const contestId = 'codegram_round_1';
  const path = `communityContests/${contestId}`;
  try {
    const ref = doc(db, 'communityContests', contestId);
    const snap = await getDoc(ref);
    if (snap.exists()) return;

    const seed = getDefaultTestingContest(uid, clampStr(hostHandle || 'codegram', 64));
    await setDoc(ref, {
      contestId: seed.contestId,
      title: seed.title,
      summary: seed.summary,
      platform: 'Codeforces',
      contestUrl: seed.contestUrl,
      startsAtEpoch: seed.startsAtEpoch,
      durationMinutes: seed.durationMinutes,
      divisionTag: seed.divisionTag,
      hostUid: uid,
      hostHandle: seed.hostHandle,
      status: 'upcoming',
      isCommunityVisible: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ---------------------------------------------------------
// Organizer Actions (Founder & Hosts)
// ---------------------------------------------------------
export async function saveCommunityContest(params: {
  existingContestId?: string;
  title: string;
  summary?: string;
  contestUrl: string;
  startsAtEpoch: number;
  durationMinutes: number;
  divisionTag: string;
  hostUid: string;
  hostHandle: string;
  status: CommunityContestStatus;
}): Promise<void> {
  const contestId = params.existingContestId
    ? clampStr(params.existingContestId, 64)
    : sanitizeContestDocId(`${params.title}_${Math.floor(Date.now() / 1000)}`);
  const path = `communityContests/${contestId}`;
  const cleanSummary = params.summary ? clampStr(params.summary, 200) : '';

  if (params.existingContestId) {
    const updatePayload: Record<string, unknown> = {
      title: clampStr(params.title, 120),
      summary: cleanSummary ? cleanSummary : deleteField(),
      platform: 'Codeforces',
      contestUrl: clampStr(params.contestUrl, 300),
      startsAtEpoch: clampNum(params.startsAtEpoch, 1000000000, 4000000000),
      durationMinutes: clampNum(params.durationMinutes, 10, 1440),
      divisionTag: clampStr(params.divisionTag || 'Open', 32),
      hostHandle: clampStr(params.hostHandle, 64),
      status: params.status,
      isCommunityVisible: true,
      updatedAt: serverTimestamp(),
    };
    try {
      await updateDoc(doc(db, 'communityContests', contestId), updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  const createPayload: Record<string, unknown> = {
    contestId,
    title: clampStr(params.title, 120),
    platform: 'Codeforces',
    contestUrl: clampStr(params.contestUrl, 300),
    startsAtEpoch: clampNum(params.startsAtEpoch, 1000000000, 4000000000),
    durationMinutes: clampNum(params.durationMinutes, 10, 1440),
    divisionTag: clampStr(params.divisionTag || 'Open', 32),
    hostUid: params.hostUid,
    hostHandle: clampStr(params.hostHandle, 64),
    status: params.status,
    isCommunityVisible: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (cleanSummary) {
    createPayload.summary = cleanSummary;
  }

  try {
    await setDoc(doc(db, 'communityContests', contestId), createPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCommunityContest(contestId: string): Promise<void> {
  const path = `communityContests/${contestId}`;
  try {
    await deleteDoc(doc(db, 'communityContests', contestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------
// Founder-Only Invites & Host Assignments
// ---------------------------------------------------------
export function subscribeCommunityInvites(
  onChange: (invites: CommunityInvite[]) => void
): Unsubscribe {
  const path = 'communityInvites';
  const q = query(collection(db, 'communityInvites'), where('code', '!=', ''), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const list: CommunityInvite[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          code: String(d.code),
          label: String(d.label),
          active: Boolean(d.active),
          createdBy: String(d.createdBy),
          createdAt: toEpochMs(d.createdAt),
          updatedAt: toEpochMs(d.updatedAt),
        };
      });
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      onChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createCommunityInvite(params: {
  code: string;
  label: string;
  createdBy: string;
}): Promise<void> {
  const code = normalizeInviteCode(params.code);
  if (code.length < 4) {
    throw new Error('Invite code must be 4–32 uppercase letters, numbers, dashes, or underscores.');
  }
  const path = `communityInvites/${code}`;
  try {
    await setDoc(doc(db, 'communityInvites', code), {
      code,
      label: clampStr(params.label || 'CodeGram Cohort', 80),
      active: true,
      createdBy: params.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleCommunityInvite(code: string, active: boolean): Promise<void> {
  const path = `communityInvites/${code}`;
  try {
    await updateDoc(doc(db, 'communityInvites', code), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCommunityInvite(code: string): Promise<void> {
  const path = `communityInvites/${code}`;
  try {
    await deleteDoc(doc(db, 'communityInvites', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeCommunityRoles(
  onChange: (roles: CommunityRole[]) => void
): Unsubscribe {
  const path = 'communityRoles';
  const q = query(collection(db, 'communityRoles'), where('role', '==', 'host'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list: CommunityRole[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          uid: String(d.uid),
          role: 'host',
          cfHandle: String(d.cfHandle),
          displayName: String(d.displayName),
          assignedBy: String(d.assignedBy),
          createdAt: toEpochMs(d.createdAt),
          updatedAt: toEpochMs(d.updatedAt),
        };
      });
      onChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function assignCommunityHost(params: {
  member: CommunityMember;
  assignedBy: string;
}): Promise<void> {
  const path = `communityRoles/${params.member.uid}`;
  try {
    await setDoc(doc(db, 'communityRoles', params.member.uid), {
      uid: params.member.uid,
      role: 'host',
      cfHandle: clampStr(params.member.cfHandle, 64),
      displayName: clampStr(params.member.displayName, 80),
      assignedBy: params.assignedBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeCommunityHost(uid: string): Promise<void> {
  const path = `communityRoles/${uid}`;
  try {
    await deleteDoc(doc(db, 'communityRoles', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
