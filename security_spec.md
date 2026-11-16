# CodeGram Firestore Security Specification

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document (`PublicProfile`, `PrivateSettings`, `FriendEntry`, `Post`, `PostLike`, `PostComment`, `ContestRsvp`, `Squad`, `SquadMember`) MUST bind its `uid` / `authorId` / `ownerId` / `userId` field strictly to `request.auth.uid` on creation and preserve it as immutable on update.
2. **Verified Write Gate**: All mutations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: User email addresses exist exclusively inside `/users/{userId}/private/settings` and are readable/writable only by `userId == request.auth.uid`. Public `/profiles/{userId}` documents never contain email, phone, or private metadata.
4. **Master Gate & Parent Existence**: Subcollections (`/posts/{postId}/likes/{userId}`, `/posts/{postId}/comments/{commentId}`, `/squads/{squadId}/members/{memberId}`) require `exists()` / `get()` validation on their parent document before creation.
5. **Atomic Like Counters**: Creating or deleting `/posts/{postId}/likes/{userId}` MUST execute in the same atomic batch as updating `likeCount` (`+1` or `-1`) on `/posts/{postId}`, enforced bi-directionally via `existsAfter` and `getAfter`.
6. **Temporal Integrity**: All `createdAt`, `updatedAt`, and `addedAt` fields MUST equal `request.time` (`serverTimestamp()`), and `createdAt` / `addedAt` remain immutable after creation.
7. **Strict Schema & Bounds**: Every string field enforces `.size()` bounds matching `firebase-blueprint.json`; every array (`tags`) enforces `.size() <= 10` and element type checks; every document ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128` chars); shadow/ghost fields are rejected via `hasAll` + `hasOnly` and `affectedKeys().hasOnly()`.
8. **Query-Side Rule Enforcement**: No `allow list` rule delegates filtering to the client or uses `get()`/`exists()`. Every `allow list` rule explicitly evaluates `resource.data`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Spoofed Post Author**: Authenticated user `attacker` creates `/posts/p1` with `authorId: "victim_uid"`. -> `PERMISSION_DENIED`
2. **Shadow Field Injection on Profile**: Owner creates `/profiles/attacker` with extra ghost field `isVerifiedAdmin: true`. -> `PERMISSION_DENIED`
3. **PII Cross-User Read**: Authenticated user `attacker` attempts `get` on `/users/victim_uid/private/settings`. -> `PERMISSION_DENIED`
4. **Unverified Email Write**: User with `email_verified: false` attempts to create a post or RSVP. -> `PERMISSION_DENIED`
5. **Fake Like Counter Inflation**: Attacker updates `/posts/p1` setting `likeCount: 999` without creating a corresponding `/posts/p1/likes/attacker` document in the same batch. -> `PERMISSION_DENIED`
6. **Orphaned Like Document**: Attacker creates `/posts/p1/likes/attacker` without incrementing `/posts/p1.likeCount` in the same batch. -> `PERMISSION_DENIED`
7. **Other User's Post Edit**: Attacker updates `content` on a post owned by `victim_uid`. -> `PERMISSION_DENIED`
8. **Timestamp Backdating**: Author creates a post with `createdAt: Timestamp(2020-01-01)` instead of `request.time`. -> `PERMISSION_DENIED`
9. **ID Poisoning / Oversized Doc ID**: Attacker creates `/posts/<200-char-invalid-id>` containing spaces or special characters. -> `PERMISSION_DENIED`
10. **Value Poisoning / Oversized Content**: Author writes a `2500`-character `content` string or `15`-item `tags` array on a post. -> `PERMISSION_DENIED`
11. **Squad Member Injection by Non-Owner**: Attacker creates `/squads/s1/members/m1` inside a squad owned by `victim_uid`. -> `PERMISSION_DENIED`
12. **Immutable Field Mutation**: Author updates `/posts/p1` attempting to modify `createdAt` or `authorId`. -> `PERMISSION_DENIED`
