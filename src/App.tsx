import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AlertCircle, ListChecks, Sparkles, Target } from 'lucide-react';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import type {
  BookmarkStatus,
  CFBundle,
  CFContest,
  CodeGramTab,
  ContestRsvp,
  FocusModeKey,
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
import { computeCodeforcesAnalytics } from './utils/analytics';
import { TopBar } from './components/TopBar';
import { OnboardingHandleGate } from './components/OnboardingHandleGate';
import { HomeView } from './components/HomeView';
import { SuggestedProblemsView } from './components/SuggestedProblemsView';
import { TopicStruggleSection } from './components/TopicStruggleSection';
import { LeftoversView } from './components/LeftoversView';
import { RoundsView } from './components/RoundsView';
import { ProfileToolbar } from './components/ProfileToolbar';
import { KpiStrip } from './components/KpiStrip';
import { ActivityHeatmap } from './components/ActivityHeatmap';
import { SubmissionHistoryChart } from './components/SubmissionHistoryChart';
import { DifficultyProgressionChart } from './components/DifficultyProgressionChart';

const STORAGE_HANDLE_KEY = 'cf_ledger_handle';
const STORAGE_RECENT_KEY = 'cf_ledger_recent_handles';
const STORAGE_THEME_KEY = 'codegram_theme';
const STORAGE_BOOKMARKS_KEY = 'codegram_bookmarks';
const STORAGE_CLEAN_MIGRATION_KEY = 'cf_ledger_sample_removed_v1';

const SAMPLE_HANDLES_SET = new Set(['errichto', 'neal', 'tourist', 'jiangly']);

function runOneTimeCleanup() {
  try {
    // Remove legacy social keys if they exist from older builds
    localStorage.removeItem('cf_ledger_friends');
    localStorage.removeItem('cf_ledger_groups');

    if (localStorage.getItem(STORAGE_CLEAN_MIGRATION_KEY)) return;

    const savedHandle = localStorage.getItem(STORAGE_HANDLE_KEY);
    if (savedHandle && SAMPLE_HANDLES_SET.has(savedHandle.toLowerCase())) {
      localStorage.removeItem(STORAGE_HANDLE_KEY);
    }

    const savedRecent = localStorage.getItem(STORAGE_RECENT_KEY);
    if (savedRecent) {
      const parsed = JSON.parse(savedRecent);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (h) => typeof h === 'string' && !SAMPLE_HANDLES_SET.has(h.toLowerCase())
        );
        localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(cleaned));
      }
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

function getInitialRecentHandles(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((h): h is string => typeof h === 'string' && h.trim().length > 0);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return [];
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
  const [questionsFocusMode, setQuestionsFocusMode] = useState<FocusModeKey>('all');

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeHandle, setActiveHandle] = useState<string>(getInitialHandle);
  const [recentHandles, setRecentHandles] = useState<string[]>(getInitialRecentHandles);
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1y');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const [bundlesByHandle, setBundlesByHandle] = useState<Record<string, CFBundle>>({});
  const [loadingPrimary, setLoadingPrimary] = useState<boolean>(() => Boolean(getInitialHandle()));
  const [primaryError, setPrimaryError] = useState<string | null>(null);
  const [checkingCloudHandle, setCheckingCloudHandle] = useState<boolean>(false);
  const [needsGoogleSignupPrompt, setNeedsGoogleSignupPrompt] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);

  // Personal saved/snoozed problem bookmarks
  const [guestBookmarks, setGuestBookmarks] = useState<ProblemBookmark[]>(getInitialBookmarks);
  const [cloudBookmarks, setCloudBookmarks] = useState<ProblemBookmark[] | null>(null);

  // Contests calendar state
  const [contests, setContests] = useState<CFContest[]>([]);
  const [contestsLoading, setContestsLoading] = useState(true);
  const [contestsError, setContestsError] = useState<string | null>(null);
  const [rsvpsByContest, setRsvpsByContest] = useState<Record<string, ContestRsvp[]>>({});

  const handleInputRef = useRef<HTMLInputElement | null>(null);

  const bookmarks = authUser && cloudBookmarks !== null ? cloudBookmarks : guestBookmarks;

  // Persist theme
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

  // Persist guest bookmarks locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOOKMARKS_KEY, JSON.stringify(guestBookmarks));
    } catch {
      // Ignore storage errors
    }
  }, [guestBookmarks]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) {
        setNeedsGoogleSignupPrompt(false);
      } else {
        setCloudBookmarks(null);
        setRsvpsByContest({});
      }
    });
    return () => unsub();
  }, []);

  const loadPrimaryHandle = useCallback(async (handleToLoad: string, forceRefresh = false) => {
    const clean = handleToLoad.trim();
    if (!clean) return false;

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

      setRecentHandles((prev) => {
        const next = [
          canon,
          ...prev.filter((h) => h.toLowerCase() !== canon.toLowerCase()),
        ].slice(0, 6);
        try {
          localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch data from Codeforces API.';
      setPrimaryError(message);
      return false;
    } finally {
      setLoadingPrimary(false);
    }
  }, []);

  // Load initial primary handle if saved
  useEffect(() => {
    if (activeHandle) {
      void loadPrimaryHandle(activeHandle);
    } else {
      setLoadingPrimary(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Codeforces contests calendar on mount
  const loadContests = useCallback(async (forceRefresh = false) => {
    setContestsLoading(true);
    setContestsError(null);
    try {
      const list = await fetchCodeforcesContests(forceRefresh);
      setContests(list);
    } catch (err) {
      setContestsError(
        err instanceof Error ? err.message : 'Could not fetch Codeforces contests.'
      );
    } finally {
      setContestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContests(false);
  }, [loadContests]);

  // Attach owner-only Firestore subscriptions when authenticated
  useEffect(() => {
    if (!authReady || !authUser) return;

    const unsubBookmarks = subscribeUserBookmarks(authUser.uid, setCloudBookmarks);

    setCheckingCloudHandle(true);
    void (async () => {
      try {
        const [profile, settings] = await Promise.all([
          getOwnPublicProfile(authUser.uid),
          getPrivateSettings(authUser.uid),
        ]);
        const cloudHandle = profile?.cfHandle || settings?.activeHandle;
        if (cloudHandle && !activeHandle) {
          void loadPrimaryHandle(cloudHandle);
        }
      } catch {
        // Handled cleanly inside socialService
      } finally {
        setCheckingCloudHandle(false);
      }
    })();

    return () => {
      unsubBookmarks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, authUser]);

  // Subscribe to personal upcoming contest reminders when authenticated
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

  // Sync user profile & settings to Firestore whenever signed-in user links/updates handle
  useEffect(() => {
    if (!authReady || !authUser || !primaryBundle?.user.handle) return;
    void upsertPublicProfile({
      uid: authUser.uid,
      displayName: authUser.displayName || primaryBundle.user.handle,
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
  }, [authReady, authUser, primaryBundle, isDark]);

  const analytics = useMemo(() => {
    return computeCodeforcesAnalytics(primaryBundle ?? EMPTY_BUNDLE, timeframe);
  }, [primaryBundle, timeframe]);

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
      setQuestionsFocusMode('all');
    }
    setActiveTab(tab);
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
    setQuestionsFocusMode('all');
    setActiveTab('questions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewLeftoversTopic = (tag: string) => {
    setSelectedTopic(tag);
    setActiveTab('leftovers');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePracticeLeftovers = () => {
    setSelectedTopic(null);
    setQuestionsFocusMode('leftovers');
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
    await setContestRsvp({
      contestId,
      userId: authUser.uid,
      cfHandle: handle,
      displayName: authUser.displayName || handle,
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

  const onboardingStep: 'handle' | 'google' | null = !activeHandle
    ? 'handle'
    : needsGoogleSignupPrompt && !authUser
    ? 'google'
    : null;

  const handleOnboardingLink = async (handle: string) => {
    const ok = await loadPrimaryHandle(handle);
    if (ok && !authUser) {
      setNeedsGoogleSignupPrompt(true);
    }
  };

  const handleBackToOnboardingHandle = () => {
    setNeedsGoogleSignupPrompt(false);
    setActiveHandle('');
    setPrimaryError(null);
    try {
      localStorage.removeItem(STORAGE_HANDLE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#121110] text-stone-900 dark:text-stone-100">
      <TopBar
        activeTab={activeTab}
        isSignedIn={Boolean(authUser)}
        isDark={isDark}
        hasLinkedHandle={onboardingStep === null}
        onChangeTab={handleNavigateTab}
        onPrimaryAction={handlePrimaryAction}
        onToggleTheme={() => setIsDark((prev) => !prev)}
      />

      <main className="flex-1 max-w-[1160px] w-full mx-auto px-4 sm:px-6 py-6 pb-12 space-y-6">
        {onboardingStep ? (
          authReady && !checkingCloudHandle ? (
            <OnboardingHandleGate
              step={onboardingStep}
              authUser={authUser}
              authReady={authReady}
              authBusy={authBusy}
              authError={authError}
              loading={loadingPrimary}
              error={primaryError}
              linkedHandle={activeHandle}
              linkedBundle={primaryBundle}
              onLinkHandle={(h) => void handleOnboardingLink(h)}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
              onSkipGoogle={() => setNeedsGoogleSignupPrompt(false)}
              onBackToHandle={handleBackToOnboardingHandle}
            />
          ) : (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="w-full max-w-md h-64 rounded-2xl bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 animate-pulse" />
            </div>
          )
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
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                onSelectHandle={(h) => void loadPrimaryHandle(h)}
                onRefreshHandle={() => void loadPrimaryHandle(activeHandle, true)}
                onToggleRsvp={handleToggleQuickRsvp}
                onNavigateTab={handleNavigateTab}
                onPracticeTopic={handlePracticeTopic}
              />
            )}

            {/* PERSONALIZED QUESTIONS */}
            {activeTab === 'questions' && (
              <SuggestedProblemsView
                bundle={primaryBundle ?? EMPTY_BUNDLE}
                timeframeTopicStats={analytics.topicStats}
                selectedTopic={selectedTopic}
                bookmarks={bookmarks}
                initialFocusMode={questionsFocusMode}
                onSelectTopic={setSelectedTopic}
                onToggleBookmark={handleToggleBookmark}
              />
            )}

            {/* WEAK TOPICS */}
            {activeTab === 'topics' && (
              <TopicStruggleSection
                handle={primaryBundle?.user.handle ?? activeHandle}
                topics={analytics.topicStats}
                selectedTopic={selectedTopic}
                timeframe={timeframe}
                onChangeTimeframe={setTimeframe}
                onSelectTopic={setSelectedTopic}
                onPracticeTopic={handlePracticeTopic}
                onViewLeftoversTopic={handleViewLeftoversTopic}
                loading={loadingPrimary && !primaryBundle}
              />
            )}

            {/* LEFTOVER THINGS */}
            {activeTab === 'leftovers' && (
              <LeftoversView
                bundle={primaryBundle ?? EMPTY_BUNDLE}
                stuckProblems={analytics.stuckProblems}
                submissions={analytics.filteredSubmissions}
                bookmarks={bookmarks}
                selectedTopic={selectedTopic}
                loading={loadingPrimary && !primaryBundle}
                onSelectTopic={setSelectedTopic}
                onToggleBookmark={handleToggleBookmark}
                onPracticeLeftovers={handlePracticeLeftovers}
              />
            )}

            {/* MY STATS */}
            {activeTab === 'stats' && (
              <>
                <ProfileToolbar
                  user={primaryBundle?.user ?? null}
                  activeHandle={activeHandle}
                  recentHandles={recentHandles}
                  timeframe={timeframe}
                  loading={loadingPrimary}
                  isDark={isDark}
                  inputRef={handleInputRef}
                  onSelectHandle={(h) => {
                    setActiveHandle(h);
                    void loadPrimaryHandle(h);
                  }}
                  onRefresh={() => void loadPrimaryHandle(activeHandle, true)}
                  onChangeTimeframe={setTimeframe}
                  onToggleTheme={() => setIsDark((prev) => !prev)}
                />

                {primaryError && (
                  <div
                    role="alert"
                    className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                          Could not load Codeforces data
                        </p>
                        <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                          {primaryError}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadPrimaryHandle(activeHandle, true)}
                      className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!primaryBundle && !loadingPrimary && !primaryError ? (
                  <section className="bg-white dark:bg-[#1B1917] border border-dashed border-stone-300 dark:border-stone-700 rounded-2xl p-10 sm:p-14 text-center">
                    <h2 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
                      Connect your Codeforces account
                    </h2>
                    <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                      Enter your Codeforces handle in the bar above to load your official submission history, difficulty progression, and personal practice diagnostics.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleInputRef.current?.focus()}
                      className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 rounded-xl transition-colors"
                    >
                      Enter Codeforces Handle
                    </button>
                  </section>
                ) : (
                  <>
                    {/* Quick Action Strip to Practice Workspaces */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#1B1917] border border-stone-200/80 dark:border-stone-800 rounded-2xl px-4 py-3">
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        Turn these stats into action:
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleNavigateTab('questions')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Personalized Questions</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNavigateTab('topics')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-rose-400 transition-colors"
                        >
                          <Target className="w-3.5 h-3.5 text-rose-500" />
                          <span>Weak Topics</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNavigateTab('leftovers')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-rose-400 transition-colors"
                        >
                          <ListChecks className="w-3.5 h-3.5 text-rose-500" />
                          <span>Leftover Things ({analytics.stuckProblems.length})</span>
                        </button>
                      </div>
                    </div>

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

            {/* UPCOMING ROUNDS */}
            {activeTab === 'rounds' && (
              <RoundsView
                contests={contests}
                loading={contestsLoading}
                error={contestsError}
                rsvpsByContest={rsvpsByContest}
                currentUserId={authUser?.uid ?? null}
                primaryBundle={primaryBundle}
                onRefresh={() => void loadContests(true)}
                onSetRsvp={handleSetRsvp}
                onSignIn={handleSignIn}
                onOpenUpsolves={() => handleNavigateTab('leftovers')}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
