import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AlertCircle } from 'lucide-react';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import type {
  BookmarkStatus,
  CFBundle,
  CFContest,
  CodeGramTab,
  CommunityContest,
  CommunityContestRsvp,
  CommunityInvite,
  CommunityMember,
  CommunityRole,
  ContestRsvp,
  ProblemBookmark,
  RsvpStatus,
  TimeframeKey,
} from './types/codeforces';
import {
  fetchCodeforcesContests,
  fetchCodeforcesUserBundle,
} from './services/codeforcesApi';
import {
  getOwnPublicProfile,
  getPrivateSettings,
  removeContestRsvp,
  removeUserBookmark,
  setContestRsvp,
  subscribePersonalContestPlans,
  subscribeUserBookmarks,
  upsertPrivateSettings,
  upsertPublicProfile,
  upsertUserBookmark,
} from './services/socialService';
import {
  FOUNDER_EMAIL,
  ensureBackendTestingContestSeeded,
  getDefaultTestingContest,
  getOwnCommunityMember,
  getOwnCommunityRole,
  joinCommunityDefault,
  joinCommunityWithInvite,
  removeCommunityContestRsvp,
  setCommunityContestRsvp,
  subscribeCommunityContestRsvps,
  subscribeCommunityContests,
  subscribeCommunityInvites,
  subscribeCommunityMembers,
  subscribeCommunityRoles,
  syncOwnCommunityMemberStats,
  updateOwnTrainingFocus,
} from './services/communityService';
import {
  computeCodeforcesAnalytics,
  computeMemberCommunityMetrics,
} from './utils/analytics';
import { TopBar } from './components/TopBar';
import { OnboardingHandleGate } from './components/OnboardingHandleGate';
import { HomeView } from './components/HomeView';
import { CommunityView } from './components/CommunityView';
import { SuggestedProblemsView, type PracticeSubTab } from './components/SuggestedProblemsView';
import { ProfileToolbar } from './components/ProfileToolbar';
import { KpiStrip } from './components/KpiStrip';
import { ActivityHeatmap } from './components/ActivityHeatmap';
import { SubmissionHistoryChart } from './components/SubmissionHistoryChart';
import { DifficultyProgressionChart } from './components/DifficultyProgressionChart';
import { MemberProfileDrawer } from './components/MemberProfileDrawer';
import { OrganizerPanelModal } from './components/OrganizerPanelModal';
import { OfflineIndicator } from './components/PWAInstallButton';

const STORAGE_HANDLE_KEY = 'cf_ledger_handle';
const STORAGE_THEME_KEY = 'codegram_theme';
const STORAGE_BOOKMARKS_KEY = 'codegram_bookmarks';
const STORAGE_CLEAN_MIGRATION_KEY = 'cf_ledger_sample_removed_v1';

const SAMPLE_HANDLES_SET = new Set(['errichto', 'neal', 'tourist', 'jiangly']);

function runOneTimeCleanup() {
  try {
    localStorage.removeItem('cf_ledger_friends');
    localStorage.removeItem('cf_ledger_groups');
    localStorage.removeItem('cf_ledger_recent_handles');

    if (localStorage.getItem(STORAGE_CLEAN_MIGRATION_KEY)) return;

    const savedHandle = localStorage.getItem(STORAGE_HANDLE_KEY);
    if (savedHandle && SAMPLE_HANDLES_SET.has(savedHandle.toLowerCase())) {
      localStorage.removeItem(STORAGE_HANDLE_KEY);
    }

    localStorage.setItem(STORAGE_CLEAN_MIGRATION_KEY, '1');
  } catch {
    // Ignore storage errors
  }
}

runOneTimeCleanup();

function getInitialHandle(): string {
  try {
    const saved = localStorage.getItem(STORAGE_HANDLE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // Ignore storage errors
  }
  return '';
}

function getInitialTheme(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    if (saved === 'light') return false;
    if (saved === 'dark') return true;
  } catch {
    // Ignore storage errors
  }
  return true;
}

function getInitialBookmarks(): ProblemBookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_BOOKMARKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (b): b is ProblemBookmark =>
            Boolean(b) && typeof b.problemKey === 'string' && typeof b.name === 'string'
        );
      }
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

const EMPTY_BUNDLE: CFBundle = {
  user: {
    handle: '',
    contribution: 0,
    lastOnlineTimeSeconds: 0,
    registrationTimeSeconds: 0,
    friendOfCount: 0,
    avatar: '',
    titlePhoto: '',
  },
  ratingHistory: [],
  submissions: [],
  fetchedAt: 0,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<CodeGramTab>('home');
  const [practiceSubTab, setPracticeSubTab] = useState<PracticeSubTab>('problems');

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeHandle, setActiveHandle] = useState<string>(getInitialHandle);
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1y');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const [bundlesByHandle, setBundlesByHandle] = useState<Record<string, CFBundle>>({});
  const [loadingPrimary, setLoadingPrimary] = useState<boolean>(() => Boolean(getInitialHandle()));
  const [primaryError, setPrimaryError] = useState<string | null>(null);
  const [checkingCloudHandle, setCheckingCloudHandle] = useState<boolean>(false);
  const [submittingOnboarding, setSubmittingOnboarding] = useState<boolean>(false);
  const [showWhatsAppGreeting, setShowWhatsAppGreeting] = useState<boolean>(false);
  const [customDisplayName, setCustomDisplayName] = useState<string>('');
  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);

  const [guestBookmarks, setGuestBookmarks] = useState<ProblemBookmark[]>(getInitialBookmarks);
  const [cloudBookmarks, setCloudBookmarks] = useState<ProblemBookmark[] | null>(null);

  const [contests, setContests] = useState<CFContest[]>([]);
  const [contestsLoading, setContestsLoading] = useState(true);
  const [rsvpsByContest, setRsvpsByContest] = useState<Record<string, ContestRsvp[]>>({});

  // CodeGram Community Hub State
  const [ownCommunityMember, setOwnCommunityMember] = useState<CommunityMember | null>(null);
  const [ownCommunityRole, setOwnCommunityRole] = useState<CommunityRole | null>(null);
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([]);
  const [communityMembersLoading, setCommunityMembersLoading] = useState(false);
  const [communityContests, setCommunityContests] = useState<CommunityContest[]>([]);
  const [communityRsvpsByContest, setCommunityRsvpsByContest] = useState<
    Record<string, CommunityContestRsvp[]>
  >({});
  const [communityInvites, setCommunityInvites] = useState<CommunityInvite[]>([]);
  const [communityRoles, setCommunityRoles] = useState<CommunityRole[]>([]);
  const [selectedMemberDrawer, setSelectedMemberDrawer] = useState<CommunityMember | null>(null);
  const [organizerModalOpen, setOrganizerModalOpen] = useState(false);
  const [organizerInitialSection, setOrganizerInitialSection] = useState<
    'contests' | 'invites' | 'hosts'
  >('contests');

  const seededRound1Ref = useRef(false);

  const bookmarks = authUser && cloudBookmarks !== null ? cloudBookmarks : guestBookmarks;
  const isFounder = Boolean(
    authUser?.emailVerified && authUser.email?.toLowerCase() === FOUNDER_EMAIL
  );
  const isCommunityEnrolled = Boolean(ownCommunityMember);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(STORAGE_THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOOKMARKS_KEY, JSON.stringify(guestBookmarks));
    } catch {
      // Ignore storage errors
    }
  }, [guestBookmarks]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) {
        setCheckingCloudHandle(true);
      } else {
        setCheckingCloudHandle(false);
        setShowWhatsAppGreeting(false);
        setCustomDisplayName('');
        setActiveHandle('');
        setPrimaryError(null);
        try {
          localStorage.removeItem(STORAGE_HANDLE_KEY);
        } catch {
          // Ignore storage errors
        }
        setCloudBookmarks(null);
        setRsvpsByContest({});
        setOwnCommunityMember(null);
        setOwnCommunityRole(null);
        setCommunityMembers([]);
        setCommunityContests([]);
        setCommunityRsvpsByContest({});
        setCommunityInvites([]);
        setCommunityRoles([]);
      }
    });
    return () => unsub();
  }, []);

  const loadPrimaryHandle = useCallback(
    async (handleToLoad: string, forceRefresh = false): Promise<CFBundle | null> => {
      const clean = handleToLoad.trim();
      if (!clean) return null;

      setLoadingPrimary(true);
      setPrimaryError(null);
      setSelectedTopic(null);

      try {
        const result = await fetchCodeforcesUserBundle(clean, { forceRefresh });
        const canon = result.user.handle;
        setBundlesByHandle((prev) => ({ ...prev, [canon.toLowerCase()]: result }));
        setActiveHandle(canon);

        try {
          localStorage.setItem(STORAGE_HANDLE_KEY, canon);
        } catch {
          // Ignore storage errors
        }
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch data from Codeforces API.';
        setPrimaryError(message);
        return null;
      } finally {
        setLoadingPrimary(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeHandle) {
      void loadPrimaryHandle(activeHandle);
    } else {
      setLoadingPrimary(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadContests = useCallback(async (forceRefresh = false) => {
    setContestsLoading(true);
    try {
      const list = await fetchCodeforcesContests(forceRefresh);
      setContests(list);
    } catch {
      // Best-effort schedule fetch for Home reminder bar
    } finally {
      setContestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContests(false);
  }, [loadContests]);

  useEffect(() => {
    if (!authReady || !authUser) return;

    const unsubBookmarks = subscribeUserBookmarks(authUser.uid, setCloudBookmarks);

    setCheckingCloudHandle(true);
    void (async () => {
      try {
        const [profile, settings, memberDoc, roleDoc] = await Promise.all([
          getOwnPublicProfile(authUser.uid),
          getPrivateSettings(authUser.uid),
          getOwnCommunityMember(authUser.uid),
          getOwnCommunityRole(authUser.uid),
        ]);
        setOwnCommunityMember(memberDoc);
        setOwnCommunityRole(roleDoc);
        const cloudName =
          memberDoc?.displayName || profile?.displayName || authUser.displayName || '';
        setCustomDisplayName(cloudName);
        const cloudHandle =
          memberDoc?.cfHandle || profile?.cfHandle || settings?.activeHandle;
        if (cloudHandle) {
          void loadPrimaryHandle(cloudHandle);
        }
      } catch {
        // Handled cleanly inside socialService / communityService
      } finally {
        setCheckingCloudHandle(false);
      }
    })();

    return () => {
      unsubBookmarks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, authUser]);

  // Subscribe to community directory & contests only after enrollment (or Founder access)
  useEffect(() => {
    if (!authReady || !authUser || (!isCommunityEnrolled && !isFounder)) return;
    setCommunityMembersLoading(true);
    const unsubMembers = subscribeCommunityMembers((members) => {
      setCommunityMembers(members);
      setCommunityMembersLoading(false);
      const mine = members.find((m) => m.uid === authUser.uid) ?? null;
      if (mine) setOwnCommunityMember(mine);
    });
    const unsubContests = subscribeCommunityContests(setCommunityContests);
    return () => {
      unsubMembers();
      unsubContests();
    };
  }, [authReady, authUser, isCommunityEnrolled, isFounder]);

  // Subscribe to RSVPs for visible CodeGram contests
  const communityContestIds = useMemo(
    () => communityContests.slice(0, 12).map((c) => c.contestId),
    [communityContests]
  );

  useEffect(() => {
    if (!authReady || !authUser || (!isCommunityEnrolled && !isFounder) || communityContestIds.length === 0) {
      return;
    }
    const unsub = subscribeCommunityContestRsvps(communityContestIds, setCommunityRsvpsByContest);
    return () => unsub();
  }, [authReady, authUser, isCommunityEnrolled, isFounder, communityContestIds]);

  // Founder-only subscriptions for invite codes & host assignments
  useEffect(() => {
    if (!authReady || !authUser || !isFounder) return;
    const unsubInvites = subscribeCommunityInvites(setCommunityInvites);
    const unsubRoles = subscribeCommunityRoles(setCommunityRoles);
    return () => {
      unsubInvites();
      unsubRoles();
    };
  }, [authReady, authUser, isFounder]);

  const upcomingContestIds = useMemo(() => {
    return contests
      .filter((c) => c.phase === 'BEFORE' || c.phase === 'CODING')
      .sort((a, b) => (a.startTimeSeconds ?? 0) - (b.startTimeSeconds ?? 0))
      .slice(0, 8)
      .map((c) => c.id);
  }, [contests]);

  useEffect(() => {
    if (!authReady || !authUser || upcomingContestIds.length === 0) return;
    const unsub = subscribePersonalContestPlans(authUser.uid, upcomingContestIds, setRsvpsByContest);
    return () => unsub();
  }, [authReady, authUser, upcomingContestIds]);

  const primaryBundle = bundlesByHandle[activeHandle.toLowerCase()] ?? null;

  // Auto-seed CodeGram Round 1 into Firestore once for Founder testing
  useEffect(() => {
    if (!authReady || !authUser || !isFounder || seededRound1Ref.current) return;
    seededRound1Ref.current = true;
    try {
      if (localStorage.getItem('codegram_round1_seeded_v1') === '1') return;
    } catch {
      // Ignore storage errors
    }
    const handle = primaryBundle?.user.handle || activeHandle || 'codegram';
    void ensureBackendTestingContestSeeded(authUser.uid, handle)
      .then(() => {
        try {
          localStorage.setItem('codegram_round1_seeded_v1', '1');
        } catch {
          // Ignore storage errors
        }
      })
      .catch(() => {
        // Error surface handled inside communityService
      });
  }, [authReady, authUser, isFounder, primaryBundle?.user.handle, activeHandle]);

  useEffect(() => {
    if (!authReady || !authUser || !primaryBundle?.user.handle) return;
    const preferredName =
      ownCommunityMember?.displayName ||
      customDisplayName ||
      authUser.displayName ||
      primaryBundle.user.handle;

    void upsertPublicProfile({
      uid: authUser.uid,
      displayName: preferredName,
      photoUrl: authUser.photoURL || primaryBundle.user.avatar || undefined,
      cfHandle: primaryBundle.user.handle,
      cfRating: primaryBundle.user.rating,
      cfRank: primaryBundle.user.rank,
    });
    void upsertPrivateSettings({
      uid: authUser.uid,
      email: authUser.email,
      theme: isDark ? 'dark' : 'light',
      activeHandle: primaryBundle.user.handle,
    });
    if (ownCommunityMember) {
      const metrics = computeMemberCommunityMetrics(primaryBundle);
      void syncOwnCommunityMemberStats({
        uid: authUser.uid,
        displayName: preferredName,
        photoUrl: authUser.photoURL || primaryBundle.user.avatar || undefined,
        cfHandle: primaryBundle.user.handle,
        metrics,
      });
    }
  }, [
    authReady,
    authUser,
    primaryBundle,
    isDark,
    ownCommunityMember?.uid,
    ownCommunityMember?.displayName,
    customDisplayName,
  ]);

  const analytics = useMemo(() => {
    return computeCodeforcesAnalytics(primaryBundle ?? EMPTY_BUNDLE, timeframe);
  }, [primaryBundle, timeframe]);

  const communityMembersById = useMemo(() => {
    const map: Record<string, CommunityMember> = {};
    for (const m of communityMembers) map[m.uid] = m;
    return map;
  }, [communityMembers]);

  const myCommunityRank = useMemo(() => {
    if (!authUser || communityMembers.length === 0) return null;
    const sorted = [...communityMembers].sort(
      (a, b) =>
        b.cfRating - a.cfRating ||
        b.weeklySolves - a.weeklySolves ||
        b.totalSolved - a.totalSolved
    );
    const idx = sorted.findIndex((m) => m.uid === authUser.uid);
    return idx >= 0 ? idx + 1 : null;
  }, [communityMembers, authUser]);

  const effectiveCommunityContests = useMemo(() => {
    if (communityContests.length > 0) return communityContests;
    return [getDefaultTestingContest(authUser?.uid || 'founder', activeHandle || 'codegram')];
  }, [communityContests, authUser?.uid, activeHandle]);

  const nextCommunityContest = useMemo(() => {
    return (
      effectiveCommunityContests
        .filter((c) => c.status !== 'completed')
        .sort((a, b) => a.startsAtEpoch - b.startsAtEpoch)[0] ?? null
    );
  }, [effectiveCommunityContests]);

  const handleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const handleNavigateTab = useCallback((tab: CodeGramTab) => {
    if (tab === 'questions') {
      setPracticeSubTab('problems');
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenWeakTopics = useCallback(() => {
    setPracticeSubTab('topics');
    setActiveTab('questions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenContests = useCallback(() => {
    setActiveTab('community');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePrimaryAction = () => {
    if (!authUser) {
      void handleSignIn();
      return;
    }
    handleNavigateTab('questions');
  };

  const handlePracticeTopic = (tag: string) => {
    setSelectedTopic(tag);
    setPracticeSubTab('problems');
    setActiveTab('questions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleBookmark = async (params: {
    problemKey: string;
    contestId: number;
    index: string;
    name: string;
    rating?: number;
    status: BookmarkStatus;
  }) => {
    const existing = bookmarks.find((b) => b.problemKey === params.problemKey);
    const removingSameStatus = existing?.status === params.status;

    if (authUser) {
      if (removingSameStatus) {
        await removeUserBookmark(authUser.uid, params.problemKey);
      } else {
        await upsertUserBookmark({
          uid: authUser.uid,
          problemKey: params.problemKey,
          contestId: params.contestId,
          index: params.index,
          name: params.name,
          rating: params.rating,
          status: params.status,
        });
      }
      return;
    }

    setGuestBookmarks((prev) => {
      if (removingSameStatus) {
        return prev.filter((b) => b.problemKey !== params.problemKey);
      }
      const nextItem: ProblemBookmark = {
        id: params.problemKey,
        ownerId: 'guest',
        problemKey: params.problemKey,
        contestId: params.contestId,
        index: params.index,
        name: params.name,
        rating: params.rating,
        status: params.status,
        updatedAt: Date.now(),
      };
      return [nextItem, ...prev.filter((b) => b.problemKey !== params.problemKey)];
    });
  };

  const handleSetRsvp = async (contestId: number, status: RsvpStatus | null) => {
    if (!authUser) {
      void handleSignIn();
      return;
    }
    if (!status) {
      await removeContestRsvp(contestId, authUser.uid);
      return;
    }
    const handle = primaryBundle?.user.handle || activeHandle || authUser.displayName || 'coder';
    const preferredName =
      ownCommunityMember?.displayName || customDisplayName || authUser.displayName || handle;
    await setContestRsvp({
      contestId,
      userId: authUser.uid,
      cfHandle: handle,
      displayName: preferredName,
      cfRating: primaryBundle?.user.rating,
      status,
    });
  };

  const handleToggleQuickRsvp = async (contestId: number) => {
    if (!authUser) {
      await handleSignIn();
      return;
    }
    const existing = (rsvpsByContest[String(contestId)] ?? []).find(
      (r) => r.userId === authUser.uid
    );
    await handleSetRsvp(contestId, existing ? null : 'competing');
  };

  const handleJoinCommunityWithInvite = async (inviteCode: string) => {
    if (!authUser || !primaryBundle?.user.handle) {
      throw new Error('Sign in with Google and link a Codeforces handle first.');
    }
    const metrics = computeMemberCommunityMetrics(primaryBundle);
    const preferredName =
      customDisplayName || authUser.displayName || primaryBundle.user.handle;
    const created = await joinCommunityWithInvite({
      uid: authUser.uid,
      isFounder,
      inviteCode,
      displayName: preferredName,
      photoUrl: authUser.photoURL || primaryBundle.user.avatar || undefined,
      cfHandle: primaryBundle.user.handle,
      metrics,
    });
    setOwnCommunityMember(created);
  };

  const handleSetCommunityRsvp = async (contestId: string, status: RsvpStatus | null) => {
    if (!authUser) {
      await handleSignIn();
      return;
    }
    if (!status) {
      await removeCommunityContestRsvp(contestId, authUser.uid);
      return;
    }
    const handle =
      ownCommunityMember?.cfHandle || primaryBundle?.user.handle || activeHandle || 'coder';
    const preferredName =
      ownCommunityMember?.displayName || customDisplayName || authUser.displayName || handle;
    await setCommunityContestRsvp({
      contestId,
      userId: authUser.uid,
      cfHandle: handle,
      displayName: preferredName,
      photoUrl: authUser.photoURL || ownCommunityMember?.photoUrl || primaryBundle?.user.avatar,
      cfRating: ownCommunityMember?.cfRating ?? primaryBundle?.user.rating ?? 0,
      status,
    });
  };

  const handleToggleQuickCommunityRsvp = async (contestId: string) => {
    if (!authUser) {
      await handleSignIn();
      return;
    }
    const existing = (communityRsvpsByContest[contestId] ?? []).find(
      (r) => r.userId === authUser.uid
    );
    await handleSetCommunityRsvp(contestId, existing ? null : 'competing');
  };

  const handleUpdateTrainingFocus = async (trainingFocus: string[], goalLabel?: string) => {
    if (!authUser) return;
    await updateOwnTrainingFocus(authUser.uid, trainingFocus, goalLabel);
  };

  const handleSelectMemberFromRsvp = (uid: string, fallback?: CommunityContestRsvp) => {
    const found = communityMembersById[uid];
    if (found) {
      setSelectedMemberDrawer(found);
      return;
    }
    if (fallback) {
      setSelectedMemberDrawer({
        uid: fallback.userId,
        displayName: fallback.displayName,
        photoUrl: fallback.photoUrl,
        cfHandle: fallback.cfHandle,
        cfRating: fallback.cfRating,
        cfMaxRating: fallback.cfRating,
        cfRank: 'member',
        lastContestDelta: 0,
        weeklySolves: 0,
        currentStreak: 0,
        totalSolved: 0,
        trainingFocus: [],
        inviteCode: '',
        isCommunityVisible: true,
        joinedAt: fallback.updatedAt,
        updatedAt: fallback.updatedAt,
      });
    }
  };

  const onboardingStep: 'login' | 'details' | 'whatsapp' | null = !authUser
    ? 'login'
    : showWhatsAppGreeting
    ? 'whatsapp'
    : !ownCommunityMember || !activeHandle
    ? 'details'
    : null;

  const isAuthBootstrapping = !authReady || (Boolean(authUser) && checkingCloudHandle);

  const handleCompleteOnboarding = async (fullName: string, cfHandle: string) => {
    if (!authUser) return;
    const cleanName = fullName.trim();
    const cleanHandle = cfHandle.trim();
    if (!cleanName || !cleanHandle) return;

    setSubmittingOnboarding(true);
    setPrimaryError(null);

    try {
      const bundle = await loadPrimaryHandle(cleanHandle);
      if (!bundle) return;

      const canonHandle = bundle.user.handle;
      const metrics = computeMemberCommunityMetrics(bundle);
      const photoUrl = authUser.photoURL || bundle.user.avatar || undefined;

      await Promise.all([
        upsertPublicProfile({
          uid: authUser.uid,
          displayName: cleanName,
          photoUrl,
          cfHandle: canonHandle,
          cfRating: bundle.user.rating,
          cfRank: bundle.user.rank,
        }),
        upsertPrivateSettings({
          uid: authUser.uid,
          email: authUser.email,
          theme: isDark ? 'dark' : 'light',
          activeHandle: canonHandle,
        }),
      ]);

      const member = await joinCommunityDefault({
        uid: authUser.uid,
        isFounder,
        displayName: cleanName,
        photoUrl,
        cfHandle: canonHandle,
        metrics,
      });

      setCustomDisplayName(cleanName);
      setOwnCommunityMember(member);
      setShowWhatsAppGreeting(true);
    } catch (err) {
      setPrimaryError(
        err instanceof Error ? err.message : 'Could not complete your profile. Please try again.'
      );
    } finally {
      setSubmittingOnboarding(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      <TopBar
        activeTab={activeTab}
        isSignedIn={Boolean(authUser)}
        isDark={isDark}
        hasLinkedHandle={!isAuthBootstrapping && onboardingStep === null}
        onChangeTab={handleNavigateTab}
        onPrimaryAction={handlePrimaryAction}
        onToggleTheme={() => setIsDark((prev) => !prev)}
      />

      <main className="flex-1 max-w-[1160px] w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] space-y-4 sm:space-y-6">
        {isAuthBootstrapping ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-full max-w-md h-64 rounded-2xl bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 animate-pulse" />
          </div>
        ) : onboardingStep ? (
          <OnboardingHandleGate
            step={onboardingStep}
            authUser={authUser}
            authBusy={authBusy}
            authError={authError}
            loading={loadingPrimary || submittingOnboarding}
            error={primaryError}
            initialName={customDisplayName || authUser?.displayName || ''}
            initialHandle={activeHandle}
            linkedHandle={activeHandle}
            linkedBundle={primaryBundle}
            memberName={
              ownCommunityMember?.displayName ||
              customDisplayName ||
              authUser?.displayName ||
              ''
            }
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onSubmitDetails={(name, handle) => void handleCompleteOnboarding(name, handle)}
            onEnterPlatform={() => setShowWhatsAppGreeting(false)}
          />
        ) : (
          <>
            {/* HOME: Personal Coach Dashboard & Focus Workspaces */}
            {activeTab === 'home' && (
              <HomeView
                authUser={authUser}
                authReady={authReady}
                authBusy={authBusy}
                authError={authError}
                activeHandle={activeHandle}
                primaryBundle={primaryBundle}
                analytics={analytics}
                bookmarks={bookmarks}
                loadingHandle={loadingPrimary}
                handleError={primaryError}
                contests={contests}
                contestsLoading={contestsLoading}
                rsvpsByContest={rsvpsByContest}
                isEnrolled={isCommunityEnrolled}
                isFounder={isFounder}
                communityRank={myCommunityRank}
                communityMemberCount={communityMembers.length}
                nextCommunityContest={nextCommunityContest}
                nextCommunityRsvps={
                  nextCommunityContest
                    ? communityRsvpsByContest[nextCommunityContest.contestId] ?? []
                    : []
                }
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                onRefreshHandle={() => void loadPrimaryHandle(activeHandle, true)}
                onJoinWithInvite={handleJoinCommunityWithInvite}
                onToggleCommunityRsvp={handleToggleQuickCommunityRsvp}
                onToggleRsvp={handleToggleQuickRsvp}
                onToggleBookmark={handleToggleBookmark}
                onNavigateTab={handleNavigateTab}
                onPracticeTopic={handlePracticeTopic}
                onOpenWeakTopics={handleOpenWeakTopics}
                onOpenContests={handleOpenContests}
              />
            )}

            {/* CODEGRAM COMMUNITY */}
            {activeTab === 'community' && (
              <CommunityView
                isSignedIn={Boolean(authUser)}
                isFounder={isFounder}
                hasHandle={Boolean(primaryBundle?.user.handle)}
                cfHandle={primaryBundle?.user.handle || activeHandle}
                authBusy={authBusy}
                isEnrolled={isCommunityEnrolled}
                currentUid={authUser?.uid ?? null}
                members={communityMembers}
                loadingMembers={communityMembersLoading}
                communityContests={effectiveCommunityContests}
                communityRsvpsByContest={communityRsvpsByContest}
                communityMembersById={communityMembersById}
                onSignIn={handleSignIn}
                onJoinWithInvite={handleJoinCommunityWithInvite}
                onSelectMember={(m) => setSelectedMemberDrawer(m)}
                onSelectMemberById={handleSelectMemberFromRsvp}
                onOpenInvites={() => {
                  setOrganizerInitialSection('invites');
                  setOrganizerModalOpen(true);
                }}
              />
            )}

            {/* PRACTICE & WEAK TOPICS */}
            {activeTab === 'questions' && (
              <SuggestedProblemsView
                bundle={primaryBundle ?? EMPTY_BUNDLE}
                timeframeTopicStats={analytics.topicStats}
                timeframe={timeframe}
                selectedTopic={selectedTopic}
                bookmarks={bookmarks}
                subTab={practiceSubTab}
                loadingAnalytics={loadingPrimary && !primaryBundle}
                onChangeSubTab={setPracticeSubTab}
                onChangeTimeframe={setTimeframe}
                onSelectTopic={setSelectedTopic}
                onToggleBookmark={handleToggleBookmark}
              />
            )}

            {/* YOU: Personal Identity, Community Standing & Analytics */}
            {activeTab === 'stats' && (
              <>
                <ProfileToolbar
                  user={primaryBundle?.user ?? null}
                  displayName={
                    ownCommunityMember?.displayName ||
                    customDisplayName ||
                    authUser?.displayName ||
                    activeHandle
                  }
                  activeHandle={activeHandle}
                  loading={loadingPrimary}
                  isDark={isDark}
                  communityMember={ownCommunityMember}
                  communityRank={myCommunityRank}
                  communityMemberCount={communityMembers.length}
                  onOpenCommunity={() => handleNavigateTab('community')}
                  onRefresh={() => void loadPrimaryHandle(activeHandle, true)}
                  onToggleTheme={() => setIsDark((prev) => !prev)}
                />

                {primaryError && (
                  <div
                    role="alert"
                    className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                          Could not load Codeforces data
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                          {primaryError}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadPrimaryHandle(activeHandle, true)}
                      className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!primaryBundle && !loadingPrimary && !primaryError ? (
                  <section className="bg-white dark:bg-[#121824] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center">
                    <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Syncing @{activeHandle}
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Click refresh to fetch your latest official Codeforces submission history and analytics.
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadPrimaryHandle(activeHandle, true)}
                      className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-[#0047CC] hover:bg-[#0039A6] dark:bg-blue-600 dark:hover:bg-blue-500 rounded-xl transition-colors"
                    >
                      Refresh Data
                    </button>
                  </section>
                ) : (
                  <>
                    <KpiStrip analytics={analytics} loading={loadingPrimary && !primaryBundle} />
                    <ActivityHeatmap
                      days={analytics.heatmapDays}
                      currentStreak={analytics.currentStreak}
                      longestStreak={analytics.longestStreak}
                    />
                    <DifficultyProgressionChart
                      ratingHistory={primaryBundle?.ratingHistory ?? []}
                      weeklyTimeline={analytics.weeklyTimeline}
                      monthlyTimeline={analytics.monthlyTimeline}
                      ratingBuckets={analytics.ratingBuckets}
                      timeframe={timeframe}
                      loading={loadingPrimary && !primaryBundle}
                    />
                    <SubmissionHistoryChart
                      weekly={analytics.weeklyTimeline}
                      monthly={analytics.monthlyTimeline}
                      loading={loadingPrimary && !primaryBundle}
                    />
                  </>
                )}
              </>
            )}

          </>
        )}
      </main>

      <MemberProfileDrawer
        member={selectedMemberDrawer}
        currentMember={ownCommunityMember}
        isOwnProfile={Boolean(authUser && selectedMemberDrawer?.uid === authUser.uid)}
        isHostBadge={Boolean(
          selectedMemberDrawer &&
            communityRoles.some((r) => r.uid === selectedMemberDrawer.uid)
        )}
        onClose={() => setSelectedMemberDrawer(null)}
        onPracticeTopic={handlePracticeTopic}
        onUpdateTrainingFocus={handleUpdateTrainingFocus}
      />

      {authUser && isFounder && (
        <OrganizerPanelModal
          open={organizerModalOpen}
          initialSection={organizerInitialSection}
          isFounder={isFounder}
          currentUid={authUser.uid}
          currentHandle={ownCommunityMember?.cfHandle || activeHandle || 'organizer'}
          contests={communityContests}
          invites={communityInvites}
          roles={communityRoles}
          members={communityMembers}
          onClose={() => setOrganizerModalOpen(false)}
        />
      )}

      <OfflineIndicator />
    </div>
  );
}
