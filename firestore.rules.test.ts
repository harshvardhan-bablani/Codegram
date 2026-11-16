/**
 * Payload-First Security TDD specification for CodeGram Firestore Rules.
 * Verifies the "Dirty Dozen" adversarial payloads against firestore.rules.
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Spoofed Post Author',
    path: 'posts/post_1',
    operation: 'create',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: {
      authorId: 'victim_uid',
      authorHandle: 'tourist',
      authorName: 'Attacker',
      postType: 'note',
      content: 'Spoofed post',
      likeCount: 0,
      commentCount: 0,
      isPublic: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Profile',
    path: 'profiles/attacker_uid',
    operation: 'create',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: {
      uid: 'attacker_uid',
      displayName: 'Attacker',
      cfHandle: 'attacker_cf',
      isPublic: true,
      isVerifiedAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'PII Cross-User Read',
    path: 'users/victim_uid/private/settings',
    operation: 'get',
    auth: { uid: 'attacker_uid', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unverified Email Write',
    path: 'posts/post_2',
    operation: 'create',
    auth: { uid: 'unverified_uid', email_verified: false },
    payload: {
      authorId: 'unverified_uid',
      authorHandle: 'user1',
      authorName: 'User One',
      postType: 'note',
      content: 'Unverified write',
      likeCount: 0,
      commentCount: 0,
      isPublic: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Fake Like Counter Inflation',
    path: 'posts/victim_post',
    operation: 'update',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: { likeCount: 999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Orphaned Like Document Without Post Batch Update',
    path: 'posts/victim_post/likes/attacker_uid',
    operation: 'create',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: {
      userId: 'attacker_uid',
      postId: 'victim_post',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Other User Post Content Edit',
    path: 'posts/victim_post',
    operation: 'update',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: { content: 'Defaced content' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Timestamp Backdating on Post Create',
    path: 'posts/post_backdate',
    operation: 'create',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: {
      authorId: 'attacker_uid',
      authorHandle: 'attacker_cf',
      authorName: 'Attacker',
      postType: 'note',
      content: 'Backdated post',
      likeCount: 0,
      commentCount: 0,
      isPublic: true,
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'ID Poisoning via Invalid Doc ID',
    path: 'posts/bad id with spaces and $chars',
    operation: 'create',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: {
      authorId: 'attacker_uid',
      authorHandle: 'attacker_cf',
      authorName: 'Attacker',
      postType: 'note',
      content: 'Bad ID',
      likeCount: 0,
      commentCount: 0,
      isPublic: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Oversized Content & Unbounded Tags Array',
    path: 'posts/post_oversize',
    operation: 'create',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: {
      authorId: 'attacker_uid',
      authorHandle: 'attacker_cf',
      authorName: 'Attacker',
      postType: 'note',
      content: 'x'.repeat(2500),
      tags: Array.from({ length: 15 }, (_, i) => `tag_${i}`),
      likeCount: 0,
      commentCount: 0,
      isPublic: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Squad Member Injection by Non-Owner',
    path: 'squads/victim_squad/members/m_evil',
    operation: 'create',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: {
      squadId: 'victim_squad',
      ownerId: 'attacker_uid',
      handle: 'attacker_cf',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Immutable authorId Mutation on Post Update',
    path: 'posts/attacker_post',
    operation: 'update',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: { authorId: 'victim_uid', content: 'Updated' },
    expected: 'PERMISSION_DENIED',
  },
];
