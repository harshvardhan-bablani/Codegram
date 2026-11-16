import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  BookmarkStatus,
  ContestRsvp,
  PrivateSettings,
  ProblemBookmark,
  PublicProfile,
  RsvpStatus,
} from '../types/codeforces';

function toEpochMs(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  return Date.now();
}

export function sanitizeDocId(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return (cleaned || 'item').slice(0, 120);
}

function clampStr(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

// ---------------------------------------------------------
// Personal Profile (/profiles/{uid}) & Private Settings (/users/{uid}/private/settings)
// ---------------------------------------------------------
export async function upsertPublicProfile(params: {
  uid: string;
  displayName: string;
  photoUrl?: string;
  cfHandle: string;
  cfRating?: number;
  cfRank?: string;
  bio?: string;
}): Promise<void> {
  const path = `profiles/${params.uid}`;
  const payload: Record<string, unknown> = {
    uid: params.uid,
    displayName: clampStr(params.displayName || params.cfHandle || 'Coder', 80),
    cfHandle: clampStr(params.cfHandle, 64),
    isPublic: false,
    updatedAt: serverTimestamp(),
  };

  if (params.photoUrl && params.photoUrl.trim()) {
    payload.photoUrl = clampStr(params.photoUrl, 500);
  }
  if (typeof params.cfRating === 'number' && params.cfRating >= 0 && params.cfRating <= 6000) {
    payload.cfRating = Math.round(params.cfRating);
  }
  if (params.cfRank && params.cfRank.trim()) {
    payload.cfRank = clampStr(params.cfRank, 40);
  }
  if (params.bio && params.bio.trim()) {
    payload.bio = clampStr(params.bio, 240);
  }

  try {
    await setDoc(doc(db, 'profiles', params.uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getOwnPublicProfile(uid: string): Promise<PublicProfile | null> {
  const path = `profiles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'profiles', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: String(d.uid),
      displayName: String(d.displayName),
      photoUrl: typeof d.photoUrl === 'string' ? d.photoUrl : undefined,
      cfHandle: String(d.cfHandle),
      cfRating: typeof d.cfRating === 'number' ? d.cfRating : undefined,
      cfRank: typeof d.cfRank === 'string' ? d.cfRank : undefined,
      bio: typeof d.bio === 'string' ? d.bio : undefined,
      isPublic: Boolean(d.isPublic),
      updatedAt: toEpochMs(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function upsertPrivateSettings(params: {
  uid: string;
  email?: string | null;
  theme: 'light' | 'dark';
  activeHandle?: string;
}): Promise<void> {
  const path = `users/${params.uid}/private/settings`;
  const payload: Record<string, unknown> = {
    uid: params.uid,
    theme: params.theme,
    updatedAt: serverTimestamp(),
  };
  if (params.email && params.email.trim()) {
    payload.email = clampStr(params.email, 200);
  }
  if (params.activeHandle && params.activeHandle.trim()) {
    payload.activeHandle = clampStr(params.activeHandle, 64);
  }

  try {
    await setDoc(doc(db, 'users', params.uid, 'private', 'settings'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getPrivateSettings(uid: string): Promise<PrivateSettings | null> {
  const path = `users/${uid}/private/settings`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'settings'));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: String(d.uid),
      email: typeof d.email === 'string' ? d.email : undefined,
      theme: d.theme === 'dark' ? 'dark' : 'light',
      activeHandle: typeof d.activeHandle === 'string' ? d.activeHandle : undefined,
      updatedAt: toEpochMs(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// ---------------------------------------------------------
// Personal Problem Bookmarks & Snoozed Leftovers (/users/{uid}/bookmarks/{itemId})
// ---------------------------------------------------------
export function subscribeUserBookmarks(
  uid: string,
  onChange: (bookmarks: ProblemBookmark[]) => void
): Unsubscribe {
  const path = `users/${uid}/bookmarks`;
  const q = query(collection(db, 'users', uid, 'bookmarks'), where('ownerId', '==', uid), limit(250));
  return onSnapshot(
    q,
    (snap) => {
      const items: ProblemBookmark[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: String(d.ownerId),
          problemKey: String(d.problemKey),
          contestId: Number(d.contestId),
          index: String(d.index),
          name: String(d.name),
          rating: typeof d.rating === 'number' ? d.rating : undefined,
          status: d.status === 'snoozed' ? 'snoozed' : 'saved',
          updatedAt: toEpochMs(d.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      onChange(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function upsertUserBookmark(params: {
  uid: string;
  problemKey: string;
  contestId: number;
  index: string;
  name: string;
  rating?: number;
  status: BookmarkStatus;
}): Promise<void> {
  const itemId = sanitizeDocId(params.problemKey);
  const path = `users/${params.uid}/bookmarks/${itemId}`;
  const payload: Record<string, unknown> = {
    ownerId: params.uid,
    problemKey: clampStr(params.problemKey, 160),
    contestId: Math.max(1, Math.round(params.contestId)),
    index: clampStr(params.index, 16),
    name: clampStr(params.name, 160),
    status: params.status,
    updatedAt: serverTimestamp(),
  };
  if (typeof params.rating === 'number' && params.rating >= 0 && params.rating <= 6000) {
    payload.rating = Math.round(params.rating);
  }

  try {
    await setDoc(doc(db, 'users', params.uid, 'bookmarks', itemId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeUserBookmark(uid: string, problemKey: string): Promise<void> {
  const itemId = sanitizeDocId(problemKey);
  const path = `users/${uid}/bookmarks/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'bookmarks', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------
// Personal Contest Plans (/contests/{contestId}/rsvps/{userId})
// ---------------------------------------------------------
export function subscribePersonalContestPlans(
  uid: string,
  contestIds: number[],
  onChange: (byContest: Record<string, ContestRsvp[]>) => void
): Unsubscribe {
  const targetIds = contestIds.slice(0, 10).map((id) => String(id));
  if (targetIds.length === 0) {
    onChange({});
    return () => {};
  }

  const state: Record<string, ContestRsvp[]> = {};
  const unsubs = targetIds.map((cid) => {
    const path = `contests/${cid}/rsvps`;
    const q = query(collection(db, 'contests', cid, 'rsvps'), where('userId', '==', uid), limit(5));
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
            cfRating: typeof d.cfRating === 'number' ? d.cfRating : undefined,
            status: d.status === 'watching' ? 'watching' : 'competing',
            isPublic: Boolean(d.isPublic),
            updatedAt: toEpochMs(d.updatedAt),
          };
        });
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

export async function setContestRsvp(params: {
  contestId: number;
  userId: string;
  cfHandle: string;
  displayName: string;
  cfRating?: number;
  status: RsvpStatus;
}): Promise<void> {
  const cid = String(params.contestId);
  const path = `contests/${cid}/rsvps/${params.userId}`;
  const payload: Record<string, unknown> = {
    userId: params.userId,
    contestId: cid,
    cfHandle: clampStr(params.cfHandle, 64),
    displayName: clampStr(params.displayName || params.cfHandle, 80),
    status: params.status,
    isPublic: false,
    updatedAt: serverTimestamp(),
  };
  if (typeof params.cfRating === 'number' && params.cfRating >= 0 && params.cfRating <= 6000) {
    payload.cfRating = Math.round(params.cfRating);
  }

  try {
    await setDoc(doc(db, 'contests', cid, 'rsvps', params.userId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeContestRsvp(contestId: number, userId: string): Promise<void> {
  const cid = String(contestId);
  const path = `contests/${cid}/rsvps/${userId}`;
  try {
    await deleteDoc(doc(db, 'contests', cid, 'rsvps', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
