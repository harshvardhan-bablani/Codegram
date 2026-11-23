# CodeGram Firestore Security Specification

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document (`PublicProfile`, `PrivateSettings`, `ProblemBookmark`, `ContestRsvp`, `CommunityMember`, `CommunityContestRsvp`) MUST bind its `uid` / `ownerId` / `userId` strictly to `request.auth.uid` on creation and preserve it as immutable on update.
2. **Verified Write Gate**: All mutations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: User email addresses exist exclusively inside `/users/{userId}/private/settings` and are readable/writable only by `userId == request.auth.uid`. `/profiles/{userId}` and `/communityMembers/{userId}` NEVER contain email, phone, or private metadata.
4. **Invite-Code Enrollment Gate**: Creating `/communityMembers/{userId}` requires either verified Founder status (`request.auth.token.email == 'harshvardhanbablani@gmail.com' && request.auth.token.email_verified == true`) OR an active invite document at `/communityInvites/{inviteCode}` with `active == true`. Members cannot list `/communityInvites`.
5. **Privilege Escalation Prevention**: `/communityRoles/{userId}` can ONLY be created, updated, deleted, or listed by the verified Founder. Regular members cannot promote themselves to `'host'`, and `CommunityMember` documents carry no privilege fields.
6. **Organizer Contest Control & Terminal Locking**: `/communityContests/{contestId}` can ONLY be created, updated, or deleted by the Founder or a designated Host in `/communityRoles`. Completed contests (`status == 'completed'`) are locked against edits unless overridden by the Founder.
7. **Master Gate on Community Contest RSVPs**: Creating or updating `/communityContests/{contestId}/rsvps/{userId}` requires verified community membership (`isCommunityMember()`) AND `exists(/databases/$(database)/documents/communityContests/$(contestId))`.
8. **Temporal Integrity & Strict Schema Bounds**: Server timestamps (`request.time`) are mandatory on `createdAt`, `joinedAt`, and `updatedAt`. All strings, arrays (`trainingFocus` max 3 strings <= 40 chars), and IDs enforce explicit bounds matching `firebase-blueprint.json`, with `hasAll` + `hasOnly` and `affectedKeys().hasOnly()`.
9. **Query-Side Rule Enforcement**: Every `allow list` rule evaluates `resource.data` directly (e.g., `existing().isCommunityVisible == true` or `existing().ownerId == request.auth.uid`) rather than delegating filtering to the client.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Invite-Code Bypass on Member Join**: Verified non-founder user creates `/communityMembers/attacker_uid` with `inviteCode: "FAKE_CODE"` that does not exist in `/communityInvites`. -> `PERMISSION_DENIED`
2. **Deactivated Invite Code Abuse**: Verified user tries to join `/communityMembers/attacker_uid` using an invite code whose `active` flag is `false`. -> `PERMISSION_DENIED`
3. **Invite Code Enumeration**: Non-founder user attempts `list` on `/communityInvites` to scrape active invite codes. -> `PERMISSION_DENIED`
4. **Self-Assigned Host Privilege Escalation**: Enrolled member attempts to create `/communityRoles/attacker_uid` with `role: "host"`. -> `PERMISSION_DENIED`
5. **Non-Host Contest Creation**: Regular member attempts to create `/communityContests/cg_fake` without Founder or Host status. -> `PERMISSION_DENIED`
6. **PII / Shadow Field Injection on Community Member**: Member creates/updates `/communityMembers/attacker_uid` with extra field `email: "leak@example.com"` or `isAdmin: true`. -> `PERMISSION_DENIED`
7. **PII Cross-User Read**: Authenticated user attempts `get` on `/users/victim_uid/private/settings`. -> `PERMISSION_DENIED`
8. **Unverified Email Write**: User with `email_verified: false` attempts to join `/communityMembers` or RSVP. -> `PERMISSION_DENIED`
9. **Orphaned Community Contest RSVP**: Community member creates `/communityContests/nonexistent_round/rsvps/attacker_uid`. -> `PERMISSION_DENIED`
10. **Spoofed RSVP Identity**: Community member creates `/communityContests/cg_round_1/rsvps/victim_uid` under another member's UID. -> `PERMISSION_DENIED`
11. **Oversized `trainingFocus` Array**: Member updates `/communityMembers/attacker_uid` with a 6-item `trainingFocus` array or 200-char topic string. -> `PERMISSION_DENIED`
12. **Terminal State Mutation on Completed Contest**: Host attempts to modify a contest in `/communityContests/cg_round_1` after `status` reached `'completed'`. -> `PERMISSION_DENIED`
