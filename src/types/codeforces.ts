export interface CFUser {
  handle: string;
  email?: string;
  vkId?: string;
  openId?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  organization?: string;
  contribution: number;
  rank?: string;
  rating?: number;
  maxRank?: string;
  maxRating?: number;
  lastOnlineTimeSeconds: number;
  registrationTimeSeconds: number;
  friendOfCount: number;
  avatar: string;
  titlePhoto: string;
}

export interface CFRatingChange {
  contestId: number;
  contestName: string;
  handle: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface CFProblem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type: string;
  points?: number;
  rating?: number;
  tags: string[];
}

export interface CFAuthor {
  contestId?: number;
  members: { handle: string }[];
  participantType: string;
  ghost: boolean;
  startTimeSeconds?: number;
}

export interface CFSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  relativeTimeSeconds: number;
  problem: CFProblem;
  author: CFAuthor;
  programmingLanguage: string;
  verdict?: string;
  testset: string;
  passedTestCount: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
}

export interface CFBundle {
  user: CFUser;
  ratingHistory: CFRatingChange[];
  submissions: CFSubmission[];
  fetchedAt: number;
}

export type TimeframeKey = '30d' | '90d' | '6m' | '1y' | 'all';

export interface HeatmapDay {
  dateKey: string;
  dateLabel: string;
  timestamp: number;
  totalSubmissions: number;
  acceptedSubmissions: number;
  uniqueSolved: number;
  topProblem?: string;
}

export interface TimelineBucket {
  key: string;
  label: string;
  startTime: number;
  ok: number;
  wa: number;
  tle: number;
  other: number;
  total: number;
  uniqueSolved: number;
  avgSolvedRating: number | null;
  rollingAvgRating: number | null;
  p90SolvedRating: number | null;
  ratedProblemsSolved: number;
}

export interface RatingBucket {
  rating: number;
  label: string;
  solved: number;
  unsolvedAttempted: number;
  totalAttempts: number;
  solveRate: number;
}

export interface TopicStats {
  tag: string;
  attemptedProblems: number;
  solvedProblems: number;
  unsolvedProblems: number;
  totalSubmissions: number;
  failedSubmissions: number;
  firstTrySolves: number;
  firstTryRate: number;
  failureRate: number;
  avgAttemptsToAc: number;
  avgSolvedRating: number | null;
  maxSolvedRating: number | null;
  dominantFailureVerdict: string;
  struggleScore: number;
  isUncovered?: boolean;
}

export interface StuckProblem {
  key: string;
  name: string;
  contestId?: number;
  index: string;
  rating?: number;
  tags: string[];
  attempts: number;
  lastVerdict: string;
  lastAttemptAt: number;
  url: string;
}

export interface ContestUpsolveGroup {
  contestId: number;
  contestName: string;
  rank: number;
  oldRating: number;
  newRating: number;
  timestampSec: number;
  solvedIndices: string[];
  upsolveCandidates: {
    key: string;
    contestId: number;
    index: string;
    name: string;
    rating?: number;
    tags: string[];
    attempted: boolean;
    url: string;
  }[];
}

export interface AnalyticsSummary {
  totalSubmissions: number;
  acceptedSubmissions: number;
  uniqueSolved: number;
  uniqueAttempted: number;
  firstTrySolves: number;
  firstTryRate: number;
  avgAttemptsPerSolve: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  avgSolvedRating: number | null;
  maxSolvedRating: number | null;
  heatmapDays: HeatmapDay[];
  weeklyTimeline: TimelineBucket[];
  monthlyTimeline: TimelineBucket[];
  ratingBuckets: RatingBucket[];
  topicStats: TopicStats[];
  stuckProblems: StuckProblem[];
  filteredSubmissions: CFSubmission[];
}

export type CodeGramTab = 'home' | 'questions' | 'topics' | 'leftovers' | 'stats' | 'rounds';

export interface CFContest {
  id: number;
  name: string;
  type: 'CF' | 'IOI' | 'ICPC' | string;
  phase: 'BEFORE' | 'CODING' | 'PENDING_SYSTEM_TEST' | 'SYSTEM_TEST' | 'FINISHED' | string;
  frozen: boolean;
  durationSeconds: number;
  startTimeSeconds?: number;
  relativeTimeSeconds?: number;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  photoUrl?: string;
  cfHandle: string;
  cfRating?: number;
  cfRank?: string;
  bio?: string;
  isPublic: boolean;
  updatedAt: number;
}

export interface PrivateSettings {
  uid: string;
  email?: string;
  theme: 'light' | 'dark';
  activeHandle?: string;
  updatedAt: number;
}

export type BookmarkStatus = 'saved' | 'snoozed';

export interface ProblemBookmark {
  id: string;
  ownerId: string;
  problemKey: string;
  contestId: number;
  index: string;
  name: string;
  rating?: number;
  status: BookmarkStatus;
  updatedAt: number;
}

export type RsvpStatus = 'competing' | 'watching';

export interface ContestRsvp {
  userId: string;
  contestId: string;
  cfHandle: string;
  displayName: string;
  cfRating?: number;
  status: RsvpStatus;
  isPublic: boolean;
  updatedAt: number;
}

export interface CFProblemStatistic {
  contestId?: number;
  index: string;
  solvedCount: number;
}

export interface CFProblemsetPayload {
  problems: CFProblem[];
  problemStatistics: CFProblemStatistic[];
}

export type DifficultyBandKey = 'consolidate' | 'sweet_spot' | 'stretch';
export type FocusModeKey = 'all' | 'weak' | 'underexplored' | 'leftovers';

export interface TopicFocusItem {
  tag: string;
  reason: 'weak' | 'underexplored';
  solvedCount: number;
  struggleScore: number;
}

export interface TopicFocusProfile {
  estimatedLevel: number;
  levelSource: string;
  weakTopics: TopicFocusItem[];
  underexploredTopics: TopicFocusItem[];
}

export interface SuggestedProblem {
  key: string;
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  solvedCount: number;
  url: string;
  matchedWeakTags: string[];
  matchedUnderexploredTags: string[];
  previouslyAttempted: boolean;
  reasonText: string;
  score: number;
}
