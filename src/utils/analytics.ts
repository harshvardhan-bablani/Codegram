import type {
  AnalyticsSummary,
  CFBundle,
  CFProblem,
  CFSubmission,
  HeatmapDay,
  RatingBucket,
  StuckProblem,
  TimeframeKey,
  TimelineBucket,
  TopicStats,
} from '../types/codeforces';

const DEFAULT_CONTACT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#E5E7EB"/><circle cx="32" cy="23" r="11" fill="#4B5563"/><path d="M12 64c0-11.046 8.954-20 20-20s20 8.954 20 20Z" fill="#4B5563"/></svg>`;

export const SAMPLE_PROFILE_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  DEFAULT_CONTACT_AVATAR_SVG
)}`;

export function resolveAvatarUrl(url?: string): string {
  if (!url || !url.trim()) return SAMPLE_PROFILE_AVATAR;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes('no-title.jpg') || lower.includes('no-avatar.jpg')) {
    return SAMPLE_PROFILE_AVATAR;
  }
  return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
}

export function getProblemKey(p: CFProblem): string {
  return `${p.contestId ?? p.problemsetName ?? 'ps'}-${p.index}-${p.name}`;
}

export function getProblemUrl(p: CFProblem): string {
  if (p.contestId && p.contestId >= 100000) {
    return `https://codeforces.com/gym/${p.contestId}/problem/${p.index}`;
  }
  if (p.contestId) {
    return `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
  }
  return 'https://codeforces.com/problemset';
}

export function getRankColor(rating?: number, rank?: string): string {
  if (rating !== undefined && rating !== null) {
    if (rating < 1200) return '#808080'; // Newbie (grey)
    if (rating < 1400) return '#15803D'; // Pupil (green)
    if (rating < 1600) return '#03A89E'; // Specialist (cyan)
    if (rating < 1900) return '#2563EB'; // Expert (blue)
    if (rating < 2100) return '#9333EA'; // Candidate Master (violet)
    if (rating < 2400) return '#D97706'; // Master / IM (orange)
    return '#DC2626'; // GM / IGM / LGM (red)
  }

  const norm = rank?.toLowerCase().trim();
  if (!norm) return '#6B7280';
  if (norm === 'newbie') return '#808080';
  if (norm === 'pupil') return '#15803D';
  if (norm === 'specialist') return '#03A89E';
  if (norm === 'expert') return '#2563EB';
  if (norm === 'candidate master') return '#9333EA';
  if (norm === 'master' || norm === 'international master') return '#D97706';
  if (
    norm === 'grandmaster' ||
    norm === 'international grandmaster' ||
    norm === 'legendary grandmaster'
  ) {
    return '#DC2626';
  }
  return '#6B7280';
}

export function getRankLabel(rank?: string): string {
  if (!rank) return 'Unrated';
  return rank
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatVerdictShort(verdict?: string): {
  label: string;
  short: string;
  tone: 'success' | 'danger' | 'warning' | 'neutral';
} {
  switch (verdict) {
    case 'OK':
      return { label: 'Accepted', short: 'AC', tone: 'success' };
    case 'WRONG_ANSWER':
      return { label: 'Wrong Answer', short: 'WA', tone: 'danger' };
    case 'TIME_LIMIT_EXCEEDED':
      return { label: 'Time Limit', short: 'TLE', tone: 'warning' };
    case 'MEMORY_LIMIT_EXCEEDED':
      return { label: 'Memory Limit', short: 'MLE', tone: 'warning' };
    case 'RUNTIME_ERROR':
      return { label: 'Runtime Error', short: 'RE', tone: 'danger' };
    case 'COMPILATION_ERROR':
      return { label: 'Compile Error', short: 'CE', tone: 'neutral' };
    case 'CHALLENGED':
      return { label: 'Hacked', short: 'HACK', tone: 'danger' };
    case 'SKIPPED':
      return { label: 'Skipped', short: 'SKIP', tone: 'neutral' };
    case 'TESTING':
      return { label: 'Testing', short: 'TEST', tone: 'neutral' };
    default:
      return { label: verdict ? verdict.replace(/_/g, ' ') : 'Unknown', short: 'OTH', tone: 'neutral' };
  }
}

export function getTimeframeCutoff(timeframe: TimeframeKey): number {
  const nowSec = Math.floor(Date.now() / 1000);
  switch (timeframe) {
    case '30d':
      return nowSec - 30 * 86400;
    case '90d':
      return nowSec - 90 * 86400;
    case '6m':
      return nowSec - 183 * 86400;
    case '1y':
      return nowSec - 365 * 86400;
    case 'all':
    default:
      return 0;
  }
}

function toLocalDateKey(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeekSeconds(epochSeconds: number): number {
  const d = new Date(epochSeconds * 1000);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // Monday-based week
  d.setDate(d.getDate() - diff);
  return Math.floor(d.getTime() / 1000);
}

function startOfMonthSeconds(epochSeconds: number): number {
  const d = new Date(epochSeconds * 1000);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return Math.floor(d.getTime() / 1000);
}

function formatShortDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatMonthLabel(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

function computeStreaks(allSubmissions: CFSubmission[]): { currentStreak: number; longestStreak: number } {
  const solvedDays = new Set<string>();
  for (const s of allSubmissions) {
    if (s.verdict === 'OK') {
      solvedDays.add(toLocalDateKey(s.creationTimeSeconds));
    }
  }
  if (solvedDays.size === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const sortedDates = Array.from(solvedDays).sort();
  let longest = 1;
  let run = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(`${sortedDates[i - 1]}T00:00:00`).getTime();
    const curr = new Date(`${sortedDates[i]}T00:00:00`).getTime();
    const diffDays = Math.round((curr - prev) / 86400000);
    if (diffDays === 1) {
      run++;
      if (run > longest) longest = run;
    } else if (diffDays > 1) {
      run = 1;
    }
  }

  // Current streak: check today or yesterday backwards
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toLocalDateKey(Math.floor(today.getTime() / 1000));
  const yesterday = new Date(today.getTime() - 86400000);
  const yesterdayKey = toLocalDateKey(Math.floor(yesterday.getTime() / 1000));

  let cursorMs: number | null = null;
  if (solvedDays.has(todayKey)) {
    cursorMs = today.getTime();
  } else if (solvedDays.has(yesterdayKey)) {
    cursorMs = yesterday.getTime();
  }

  let currentStreak = 0;
  while (cursorMs !== null) {
    const key = toLocalDateKey(Math.floor(cursorMs / 1000));
    if (solvedDays.has(key)) {
      currentStreak++;
      cursorMs -= 86400000;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak: longest };
}

function buildHeatmapDays(allSubmissions: CFSubmission[]): HeatmapDay[] {
  const dayMap = new Map<
    string,
    { total: number; ac: number; solvedKeys: Set<string>; topRating: number; topProblem?: string }
  >();

  for (const s of allSubmissions) {
    const key = toLocalDateKey(s.creationTimeSeconds);
    let entry = dayMap.get(key);
    if (!entry) {
      entry = { total: 0, ac: 0, solvedKeys: new Set(), topRating: -1 };
      dayMap.set(key, entry);
    }
    entry.total += 1;
    if (s.verdict === 'OK') {
      entry.ac += 1;
      entry.solvedKeys.add(getProblemKey(s.problem));
      const r = s.problem.rating ?? 0;
      if (r >= entry.topRating) {
        entry.topRating = r;
        entry.topProblem = `${s.problem.contestId ?? ''}${s.problem.index} ${s.problem.name}`;
      }
    }
  }

  // 53 weeks (371 days) ending today, aligned cleanly to weeks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysBack = 364;
  const start = new Date(today.getTime() - daysBack * 86400000);
  // Align start back to Sunday so columns are clean Sun..Sat weeks
  const startDayOfWeek = start.getDay();
  start.setDate(start.getDate() - startDayOfWeek);

  const result: HeatmapDay[] = [];
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= today.getTime()) {
    const ts = Math.floor(cursor.getTime() / 1000);
    const key = toLocalDateKey(ts);
    const info = dayMap.get(key);
    result.push({
      dateKey: key,
      dateLabel: cursor.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      timestamp: ts,
      totalSubmissions: info?.total ?? 0,
      acceptedSubmissions: info?.ac ?? 0,
      uniqueSolved: info?.solvedKeys.size ?? 0,
      topProblem: info?.topProblem,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function buildTimeline(
  chronologicalSubs: CFSubmission[],
  granularity: 'week' | 'month'
): TimelineBucket[] {
  if (chronologicalSubs.length === 0) return [];

  const bucketsMap = new Map<
    number,
    {
      ok: number;
      wa: number;
      tle: number;
      other: number;
      solvedKeys: Set<string>;
      solvedRatings: number[];
    }
  >();

  const seenSolvedGlobally = new Set<string>();

  for (const s of chronologicalSubs) {
    const bucketStart =
      granularity === 'week'
        ? startOfWeekSeconds(s.creationTimeSeconds)
        : startOfMonthSeconds(s.creationTimeSeconds);

    let bucket = bucketsMap.get(bucketStart);
    if (!bucket) {
      bucket = {
        ok: 0,
        wa: 0,
        tle: 0,
        other: 0,
        solvedKeys: new Set(),
        solvedRatings: [],
      };
      bucketsMap.set(bucketStart, bucket);
    }

    if (s.verdict === 'OK') {
      bucket.ok += 1;
      const pKey = getProblemKey(s.problem);
      if (!seenSolvedGlobally.has(pKey)) {
        seenSolvedGlobally.add(pKey);
        bucket.solvedKeys.add(pKey);
        if (s.problem.rating) {
          bucket.solvedRatings.push(s.problem.rating);
        }
      }
    } else if (s.verdict === 'WRONG_ANSWER') {
      bucket.wa += 1;
    } else if (s.verdict === 'TIME_LIMIT_EXCEEDED') {
      bucket.tle += 1;
    } else {
      bucket.other += 1;
    }
  }

  const sortedStarts = Array.from(bucketsMap.keys()).sort((a, b) => a - b);

  // Fill intermediate empty weeks/months if span isn't huge (up to 160 buckets)
  const filledStarts: number[] = [];
  if (sortedStarts.length > 0) {
    const minStart = sortedStarts[0];
    const maxStart = sortedStarts[sortedStarts.length - 1];
    if (granularity === 'week') {
      const totalWeeks = Math.round((maxStart - minStart) / (7 * 86400));
      if (totalWeeks <= 160) {
        for (let t = minStart; t <= maxStart; t += 7 * 86400) {
          // normalize DST drift by calling startOfWeekSeconds
          const norm = startOfWeekSeconds(t + 43200);
          if (filledStarts[filledStarts.length - 1] !== norm) {
            filledStarts.push(norm);
          }
        }
      } else {
        filledStarts.push(...sortedStarts);
      }
    } else {
      const d = new Date(minStart * 1000);
      let guard = 0;
      while (Math.floor(d.getTime() / 1000) <= maxStart && guard < 180) {
        filledStarts.push(Math.floor(d.getTime() / 1000));
        d.setMonth(d.getMonth() + 1);
        guard++;
      }
    }
  }

  const rawBuckets: TimelineBucket[] = filledStarts.map((start) => {
    const b = bucketsMap.get(start);
    const ok = b?.ok ?? 0;
    const wa = b?.wa ?? 0;
    const tle = b?.tle ?? 0;
    const other = b?.other ?? 0;
    const ratings = b?.solvedRatings ?? [];
    const avgSolvedRating =
      ratings.length > 0
        ? Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length)
        : null;
    let p90SolvedRating: number | null = null;
    if (ratings.length > 0) {
      const sorted = [...ratings].sort((a, b2) => a - b2);
      const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
      p90SolvedRating = sorted[idx];
    }

    return {
      key: `${granularity}-${start}`,
      label: granularity === 'week' ? formatShortDate(start) : formatMonthLabel(start),
      startTime: start,
      ok,
      wa,
      tle,
      other,
      total: ok + wa + tle + other,
      uniqueSolved: b?.solvedKeys.size ?? 0,
      avgSolvedRating,
      rollingAvgRating: null,
      p90SolvedRating,
      ratedProblemsSolved: ratings.length,
    };
  });

  // Compute 4-bucket rolling weighted rating average
  for (let i = 0; i < rawBuckets.length; i++) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (let j = Math.max(0, i - 3); j <= i; j++) {
      const b = rawBuckets[j];
      if (b.avgSolvedRating !== null && b.ratedProblemsSolved > 0) {
        weightedSum += b.avgSolvedRating * b.ratedProblemsSolved;
        totalWeight += b.ratedProblemsSolved;
      }
    }
    rawBuckets[i].rollingAvgRating = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  }

  return rawBuckets;
}

export function computeCodeforcesAnalytics(
  bundle: CFBundle,
  timeframe: TimeframeKey
): AnalyticsSummary {
  const cutoff = getTimeframeCutoff(timeframe);
  const allChronological = [...bundle.submissions].sort(
    (a, b) => a.creationTimeSeconds - b.creationTimeSeconds
  );

  // Track globally solved problems before cutoff too, or analyze timeframe directly
  const filteredChronological =
    cutoff > 0
      ? allChronological.filter((s) => s.creationTimeSeconds >= cutoff)
      : allChronological;

  // Group submissions by unique problem inside filtered timeframe
  interface ProblemAggregate {
    problem: CFProblem;
    submissions: CFSubmission[];
    solved: boolean;
    firstAcIndex: number;
    firstTryAc: boolean;
    attemptsBeforeOrAtAc: number;
    lastVerdict: string;
    lastAttemptAt: number;
  }

  const problemMap = new Map<string, ProblemAggregate>();
  const activeDaySet = new Set<string>();
  let acceptedSubmissions = 0;

  for (const s of filteredChronological) {
    activeDaySet.add(toLocalDateKey(s.creationTimeSeconds));
    if (s.verdict === 'OK') acceptedSubmissions += 1;

    const pKey = getProblemKey(s.problem);
    let agg = problemMap.get(pKey);
    if (!agg) {
      agg = {
        problem: s.problem,
        submissions: [],
        solved: false,
        firstAcIndex: -1,
        firstTryAc: false,
        attemptsBeforeOrAtAc: 0,
        lastVerdict: s.verdict ?? 'UNKNOWN',
        lastAttemptAt: s.creationTimeSeconds,
      };
      problemMap.set(pKey, agg);
    }
    agg.submissions.push(s);
    agg.lastVerdict = s.verdict ?? 'UNKNOWN';
    agg.lastAttemptAt = s.creationTimeSeconds;
    if (s.verdict === 'OK' && !agg.solved) {
      agg.solved = true;
      agg.firstAcIndex = agg.submissions.length - 1;
      agg.firstTryAc = agg.firstAcIndex === 0;
      agg.attemptsBeforeOrAtAc = agg.submissions.length;
    }
  }

  let uniqueSolved = 0;
  let firstTrySolves = 0;
  let totalAttemptsOnSolved = 0;
  let solvedRatingSum = 0;
  let solvedRatingCount = 0;
  let maxSolvedRating: number | null = null;

  const ratingBucketMap = new Map<
    number,
    { solved: number; unsolved: number; totalAttempts: number }
  >();

  const tagMap = new Map<
    string,
    {
      attempted: number;
      solved: number;
      unsolved: number;
      totalSubs: number;
      failedSubs: number;
      firstTry: number;
      attemptsToAcSum: number;
      solvedRatings: number[];
      verdictCounts: Map<string, number>;
    }
  >();

  const stuckProblems: StuckProblem[] = [];

  for (const [pKey, agg] of problemMap.entries()) {
    const p = agg.problem;
    if (agg.solved) {
      uniqueSolved += 1;
      if (agg.firstTryAc) firstTrySolves += 1;
      totalAttemptsOnSolved += agg.attemptsBeforeOrAtAc;
      if (p.rating) {
        solvedRatingSum += p.rating;
        solvedRatingCount += 1;
        if (maxSolvedRating === null || p.rating > maxSolvedRating) {
          maxSolvedRating = p.rating;
        }
      }
    } else {
      stuckProblems.push({
        key: pKey,
        name: p.name,
        contestId: p.contestId,
        index: p.index,
        rating: p.rating,
        tags: p.tags ?? [],
        attempts: agg.submissions.length,
        lastVerdict: agg.lastVerdict,
        lastAttemptAt: agg.lastAttemptAt,
        url: getProblemUrl(p),
      });
    }

    if (p.rating) {
      const bucketRating = Math.min(3500, Math.max(800, Math.round(p.rating / 100) * 100));
      let rb = ratingBucketMap.get(bucketRating);
      if (!rb) {
        rb = { solved: 0, unsolved: 0, totalAttempts: 0 };
        ratingBucketMap.set(bucketRating, rb);
      }
      if (agg.solved) rb.solved += 1;
      else rb.unsolved += 1;
      rb.totalAttempts += agg.submissions.length;
    }

    const tags = p.tags && p.tags.length > 0 ? p.tags : ['untagged'];
    const failedCountForProblem = agg.submissions.filter((sub) => sub.verdict !== 'OK').length;

    for (const tag of tags) {
      let t = tagMap.get(tag);
      if (!t) {
        t = {
          attempted: 0,
          solved: 0,
          unsolved: 0,
          totalSubs: 0,
          failedSubs: 0,
          firstTry: 0,
          attemptsToAcSum: 0,
          solvedRatings: [],
          verdictCounts: new Map(),
        };
        tagMap.set(tag, t);
      }
      t.attempted += 1;
      t.totalSubs += agg.submissions.length;
      t.failedSubs += failedCountForProblem;
      if (agg.solved) {
        t.solved += 1;
        if (agg.firstTryAc) t.firstTry += 1;
        t.attemptsToAcSum += agg.attemptsBeforeOrAtAc;
        if (p.rating) t.solvedRatings.push(p.rating);
      } else {
        t.unsolved += 1;
      }

      for (const sub of agg.submissions) {
        if (sub.verdict && sub.verdict !== 'OK') {
          t.verdictCounts.set(sub.verdict, (t.verdictCounts.get(sub.verdict) ?? 0) + 1);
        }
      }
    }
  }

  const ratingBuckets: RatingBucket[] = Array.from(ratingBucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rating, rb]) => {
      const totalProblems = rb.solved + rb.unsolved;
      return {
        rating,
        label: String(rating),
        solved: rb.solved,
        unsolvedAttempted: rb.unsolved,
        totalAttempts: rb.totalAttempts,
        solveRate: totalProblems > 0 ? Math.round((rb.solved / totalProblems) * 100) : 0,
      };
    });

  const topicStats: TopicStats[] = Array.from(tagMap.entries())
    .filter(([tag]) => tag !== 'untagged')
    .map(([tag, t]) => {
      const failureRate = t.totalSubs > 0 ? (t.failedSubs / t.totalSubs) * 100 : 0;
      const unsolvedRatio = t.attempted > 0 ? t.unsolved / t.attempted : 0;
      const firstTryRate = t.solved > 0 ? (t.firstTry / t.solved) * 100 : 0;
      const nonFirstTryRatio = t.attempted > 0 ? 1 - t.firstTry / t.attempted : 0;
      const avgAttemptsToAc = t.solved > 0 ? t.attemptsToAcSum / t.solved : t.totalSubs;

      // Weighted Struggle Score (0 - 100)
      const rawStruggle =
        0.4 * (failureRate / 100) + 0.35 * unsolvedRatio + 0.25 * nonFirstTryRatio;
      const struggleScore = Math.round(Math.min(100, Math.max(0, rawStruggle * 100)));

      let dominantVerdict = 'NONE';
      let maxVCount = 0;
      for (const [v, count] of t.verdictCounts.entries()) {
        if (count > maxVCount) {
          maxVCount = count;
          dominantVerdict = v;
        }
      }

      const avgSolvedRating =
        t.solvedRatings.length > 0
          ? Math.round(t.solvedRatings.reduce((s, r) => s + r, 0) / t.solvedRatings.length)
          : null;
      const maxTagRating = t.solvedRatings.length > 0 ? Math.max(...t.solvedRatings) : null;

      return {
        tag,
        attemptedProblems: t.attempted,
        solvedProblems: t.solved,
        unsolvedProblems: t.unsolved,
        totalSubmissions: t.totalSubs,
        failedSubmissions: t.failedSubs,
        firstTrySolves: t.firstTry,
        firstTryRate,
        failureRate,
        avgAttemptsToAc,
        avgSolvedRating,
        maxSolvedRating: maxTagRating,
        dominantFailureVerdict: dominantVerdict,
        struggleScore,
        isUncovered: false,
      };
    });

  // Add uncovered core Codeforces topics as weak/uncovered topics (only if user has at least 1 submission)
  if (filteredChronological.length > 0) {
    const existingTags = new Set(topicStats.map((t) => t.tag));
    for (const coreTag of CORE_CF_TOPICS) {
      if (!existingTags.has(coreTag)) {
        topicStats.push({
          tag: coreTag,
          attemptedProblems: 0,
          solvedProblems: 0,
          unsolvedProblems: 0,
          totalSubmissions: 0,
          failedSubmissions: 0,
          firstTrySolves: 0,
          firstTryRate: 0,
          failureRate: 0,
          avgAttemptsToAc: 0,
          avgSolvedRating: null,
          maxSolvedRating: null,
          dominantFailureVerdict: 'NONE',
          struggleScore: 70,
          isUncovered: true,
        });
      }
    }
  }

  topicStats.sort(
    (a, b) => b.struggleScore - a.struggleScore || b.attemptedProblems - a.attemptedProblems
  );

  stuckProblems.sort((a, b) => b.attempts - a.attempts || b.lastAttemptAt - a.lastAttemptAt);

  const { currentStreak, longestStreak } = computeStreaks(allChronological);

  return {
    totalSubmissions: filteredChronological.length,
    acceptedSubmissions,
    uniqueSolved,
    uniqueAttempted: problemMap.size,
    firstTrySolves,
    firstTryRate: uniqueSolved > 0 ? (firstTrySolves / uniqueSolved) * 100 : 0,
    avgAttemptsPerSolve: uniqueSolved > 0 ? totalAttemptsOnSolved / uniqueSolved : 0,
    activeDays: activeDaySet.size,
    currentStreak,
    longestStreak,
    avgSolvedRating: solvedRatingCount > 0 ? Math.round(solvedRatingSum / solvedRatingCount) : null,
    maxSolvedRating,
    heatmapDays: buildHeatmapDays(allChronological),
    weeklyTimeline: buildTimeline(filteredChronological, 'week'),
    monthlyTimeline: buildTimeline(filteredChronological, 'month'),
    ratingBuckets,
    topicStats,
    stuckProblems,
    filteredSubmissions: [...filteredChronological].reverse(),
  };
}

export function exportTopicStrugglesCsv(handle: string, topics: TopicStats[]): void {
  const headers = [
    'Topic',
    'Struggle Score',
    'Attempted Problems',
    'Solved Problems',
    'Unsolved Problems',
    'Failure Rate (%)',
    'First-Try AC Rate (%)',
    'Avg Attempts to AC',
    'Avg Solved Rating',
    'Dominant Failure Verdict',
  ];
  const rows = topics.map((t) => [
    `"${t.tag.replace(/"/g, '""')}"`,
    t.struggleScore,
    t.attemptedProblems,
    t.solvedProblems,
    t.unsolvedProblems,
    t.failureRate.toFixed(1),
    t.firstTryRate.toFixed(1),
    t.avgAttemptsToAc.toFixed(2),
    t.avgSolvedRating ?? '',
    t.dominantFailureVerdict,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${handle}-topic-struggles.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function computeContestUpsolves(
  bundle: CFBundle,
  problemset: import('../types/codeforces').CFProblemsetPayload,
  limitContests = 12
): import('../types/codeforces').ContestUpsolveGroup[] {
  if (!bundle.ratingHistory || bundle.ratingHistory.length === 0) return [];

  const solvedKeys = new Set<string>();
  const attemptedKeys = new Set<string>();
  const solvedIndicesByContest = new Map<number, Set<string>>();

  for (const s of bundle.submissions) {
    const key = getProblemKey(s.problem);
    attemptedKeys.add(key);
    if (s.verdict === 'OK') {
      solvedKeys.add(key);
      if (s.problem.contestId) {
        let set = solvedIndicesByContest.get(s.problem.contestId);
        if (!set) {
          set = new Set<string>();
          solvedIndicesByContest.set(s.problem.contestId, set);
        }
        set.add(s.problem.index);
      }
    }
  }

  const problemsByContest = new Map<number, CFProblem[]>();
  for (const p of problemset.problems) {
    if (!p.contestId) continue;
    let list = problemsByContest.get(p.contestId);
    if (!list) {
      list = [];
      problemsByContest.set(p.contestId, list);
    }
    list.push(p);
  }

  const recentContests = [...bundle.ratingHistory]
    .sort((a, b) => b.ratingUpdateTimeSeconds - a.ratingUpdateTimeSeconds)
    .slice(0, limitContests);

  const result: import('../types/codeforces').ContestUpsolveGroup[] = [];

  for (const rc of recentContests) {
    const contestProblems = [...(problemsByContest.get(rc.contestId) ?? [])].sort((a, b) =>
      a.index.localeCompare(b.index)
    );
    if (contestProblems.length === 0) continue;

    const solvedIndices = Array.from(solvedIndicesByContest.get(rc.contestId) ?? []).sort();
    const unsolved = contestProblems
      .filter((p) => !solvedKeys.has(getProblemKey(p)))
      .slice(0, 2);

    if (unsolved.length === 0) continue;

    result.push({
      contestId: rc.contestId,
      contestName: rc.contestName,
      rank: rc.rank,
      oldRating: rc.oldRating,
      newRating: rc.newRating,
      timestampSec: rc.ratingUpdateTimeSeconds,
      solvedIndices,
      upsolveCandidates: unsolved.map((p) => {
        const key = getProblemKey(p);
        return {
          key,
          contestId: p.contestId!,
          index: p.index,
          name: p.name,
          rating: p.rating,
          tags: p.tags ?? [],
          attempted: attemptedKeys.has(key),
          url: getProblemUrl(p),
        };
      }),
    });
  }

  return result;
}

export const CORE_CF_TOPICS = [
  'dp',
  'graphs',
  'trees',
  'binary search',
  'greedy',
  'math',
  'number theory',
  'data structures',
  'two pointers',
  'bitmasks',
  'combinatorics',
  'dfs and similar',
  'shortest paths',
  'strings',
  'constructive algorithms',
  'divide and conquer',
  'dsu',
  'implementation',
];

export function computeTopicPracticeProfile(
  bundle: CFBundle,
  timeframeTopicStats: TopicStats[]
): import('../types/codeforces').TopicFocusProfile {
  // Determine user's current problem-solving level
  let estimatedLevel = 1000;
  let levelSource = 'Starter baseline';

  const recentSolvedRatings = [...bundle.submissions]
    .filter((s) => s.verdict === 'OK' && typeof s.problem.rating === 'number')
    .sort((a, b) => b.creationTimeSeconds - a.creationTimeSeconds)
    .slice(0, 40)
    .map((s) => s.problem.rating as number);

  if (typeof bundle.user.rating === 'number' && bundle.user.rating > 0) {
    const cfRound = Math.round(bundle.user.rating / 100) * 100;
    if (recentSolvedRatings.length >= 10) {
      const avgRecent =
        recentSolvedRatings.reduce((acc, r) => acc + r, 0) / recentSolvedRatings.length;
      const blended = Math.round((bundle.user.rating * 0.6 + avgRecent * 0.4) / 100) * 100;
      estimatedLevel = Math.min(3200, Math.max(800, blended));
      levelSource = `CF Rating (${bundle.user.rating}) + recent solves`;
    } else {
      estimatedLevel = Math.min(3200, Math.max(800, cfRound));
      levelSource = `Official CF Rating (${bundle.user.rating})`;
    }
  } else if (recentSolvedRatings.length > 0) {
    const avgRecent =
      recentSolvedRatings.reduce((acc, r) => acc + r, 0) / recentSolvedRatings.length;
    estimatedLevel = Math.min(3200, Math.max(800, Math.round(avgRecent / 100) * 100));
    levelSource = `Recent ${recentSolvedRatings.length} solved problems`;
  }

  // Count all-time unique solved problems per tag
  const solvedKeysByTag = new Map<string, Set<string>>();
  for (const s of bundle.submissions) {
    if (s.verdict !== 'OK') continue;
    const pKey = getProblemKey(s.problem);
    for (const tag of s.problem.tags ?? []) {
      let set = solvedKeysByTag.get(tag);
      if (!set) {
        set = new Set();
        solvedKeysByTag.set(tag, set);
      }
      set.add(pKey);
    }
  }

  // Also compute all-time topic stats as fallback if current timeframe is sparse
  const statsSource =
    timeframeTopicStats.length >= 4
      ? timeframeTopicStats
      : computeCodeforcesAnalytics(bundle, 'all').topicStats;

  const weakTopics: import('../types/codeforces').TopicFocusItem[] = [...statsSource]
    .filter(
      (t) =>
        (t.attemptedProblems >= 2 && t.struggleScore >= 32) ||
        t.isUncovered === true ||
        t.attemptedProblems === 0
    )
    .sort((a, b) => b.struggleScore - a.struggleScore || b.unsolvedProblems - a.unsolvedProblems)
    .slice(0, 8)
    .map((t) => ({
      tag: t.tag,
      reason: 'weak' as const,
      solvedCount: solvedKeysByTag.get(t.tag)?.size ?? t.solvedProblems,
      struggleScore: t.struggleScore,
    }));

  const weakTagSet = new Set(weakTopics.map((w) => w.tag));

  // Identify underexplored core topics relative to user's typical core topic volume
  const coreCounts = CORE_CF_TOPICS.map((tag) => ({
    tag,
    solved: solvedKeysByTag.get(tag)?.size ?? 0,
  }));
  const sortedCounts = [...coreCounts].map((c) => c.solved).sort((a, b) => a - b);
  const medianCoreSolved = sortedCounts[Math.floor(sortedCounts.length / 2)] ?? 0;
  const underexploredThreshold = Math.max(5, Math.round(medianCoreSolved * 0.45));

  const struggleByTag = new Map(statsSource.map((t) => [t.tag, t.struggleScore]));

  const underexploredTopics: import('../types/codeforces').TopicFocusItem[] = coreCounts
    .filter((c) => !weakTagSet.has(c.tag) && c.solved <= underexploredThreshold)
    .sort((a, b) => a.solved - b.solved)
    .slice(0, 6)
    .map((c) => ({
      tag: c.tag,
      reason: 'underexplored' as const,
      solvedCount: c.solved,
      struggleScore: struggleByTag.get(c.tag) ?? 0,
    }));

  return {
    estimatedLevel,
    levelSource,
    weakTopics,
    underexploredTopics,
  };
}

export function generateSuggestedProblems(params: {
  bundle: CFBundle;
  problemset: import('../types/codeforces').CFProblemsetPayload;
  profile: import('../types/codeforces').TopicFocusProfile;
  difficultyBand: import('../types/codeforces').DifficultyBandKey;
  focusMode: import('../types/codeforces').FocusModeKey;
  filterTopic: string | null;
  pageOffset?: number;
  limit?: number;
}): {
  suggestions: import('../types/codeforces').SuggestedProblem[];
  totalMatching: number;
  ratingRange: [number, number];
} {
  const {
    bundle,
    problemset,
    profile,
    difficultyBand,
    focusMode,
    filterTopic,
    pageOffset = 0,
    limit = 20,
  } = params;

  const base = profile.estimatedLevel;
  let minR = base;
  let maxR = base + 200;
  if (difficultyBand === 'consolidate') {
    minR = Math.max(800, base - 100);
    maxR = Math.max(800, base);
  } else if (difficultyBand === 'sweet_spot') {
    minR = Math.max(800, base);
    maxR = Math.min(3500, base + 200);
  } else {
    minR = Math.min(3400, base + 200);
    maxR = Math.min(3500, base + 400);
  }
  const idealRating = Math.round((minR + maxR) / 2);

  // Build sets of globally solved & attempted problems
  const solvedKeys = new Set<string>();
  const attemptedKeys = new Set<string>();
  for (const s of bundle.submissions) {
    const key = getProblemKey(s.problem);
    attemptedKeys.add(key);
    if (s.verdict === 'OK') {
      solvedKeys.add(key);
    }
  }

  // Build solvedCount lookup map
  const solvedCountMap = new Map<string, number>();
  for (const stat of problemset.problemStatistics) {
    if (stat.contestId) {
      solvedCountMap.set(`${stat.contestId}-${stat.index}`, stat.solvedCount);
    }
  }

  const weakMap = new Map(profile.weakTopics.map((w) => [w.tag, w]));
  const underMap = new Map(profile.underexploredTopics.map((u) => [u.tag, u]));

  const activeWeakSet =
    focusMode === 'underexplored' || focusMode === 'leftovers'
      ? new Set<string>()
      : new Set(weakMap.keys());
  const activeUnderSet =
    focusMode === 'weak' || focusMode === 'leftovers'
      ? new Set<string>()
      : new Set(underMap.keys());

  const hasFocusTargets = activeWeakSet.size > 0 || activeUnderSet.size > 0;

  const scored: import('../types/codeforces').SuggestedProblem[] = [];

  for (const p of problemset.problems) {
    if (!p.contestId || !p.rating) continue;

    const pKey = getProblemKey(p);
    if (solvedKeys.has(pKey)) continue;

    const previouslyAttempted = attemptedKeys.has(pKey);
    if (focusMode === 'leftovers') {
      if (!previouslyAttempted) continue;
    } else if (p.rating < minR || p.rating > maxR) {
      continue;
    }

    const tags = p.tags ?? [];
    if (filterTopic && !tags.includes(filterTopic)) continue;

    const matchedWeakTags = tags.filter((t) => activeWeakSet.has(t));
    const matchedUnderexploredTags = tags.filter((t) => activeUnderSet.has(t));

    if (focusMode !== 'leftovers' && !filterTopic && hasFocusTargets) {
      if (matchedWeakTags.length === 0 && matchedUnderexploredTags.length === 0) {
        continue;
      }
    }

    const solvedCount = solvedCountMap.get(`${p.contestId}-${p.index}`) ?? 0;
    // Skip ultra-obscure problems with almost no solves unless explicitly filtered or leftover
    if (focusMode !== 'leftovers' && !filterTopic && solvedCount < 150) continue;

    let score = 0;
    for (const wt of matchedWeakTags) {
      const info = weakMap.get(wt);
      score += 36 + (info ? info.struggleScore * 0.3 : 0);
    }
    for (const ut of matchedUnderexploredTags) {
      const info = underMap.get(ut);
      score += 28 + Math.max(0, 10 - (info?.solvedCount ?? 0));
    }
    if (previouslyAttempted) {
      score += focusMode === 'leftovers' ? 60 : 22;
    }

    // Prefer problems close to idealRating and well-tested community problems
    const ratingDistPenalty = Math.abs(p.rating - idealRating) * (focusMode === 'leftovers' ? 0.03 : 0.08);
    const popularityBoost = Math.log10(Math.max(10, solvedCount)) * 6;
    const recencyBoost = p.contestId >= 1400 ? 6 : 0;
    score = score + popularityBoost + recencyBoost - ratingDistPenalty;

    const reasons: string[] = [];
    if (matchedWeakTags.length > 0) {
      reasons.push(`Weak: ${matchedWeakTags.slice(0, 2).join(', ')}`);
    }
    if (matchedUnderexploredTags.length > 0) {
      reasons.push(`New: ${matchedUnderexploredTags.slice(0, 2).join(', ')}`);
    }
    if (previouslyAttempted) {
      reasons.push('Tried before');
    }
    if (reasons.length === 0 && filterTopic) {
      reasons.push(filterTopic);
    } else if (reasons.length === 0) {
      reasons.push(`${p.rating}`);
    }

    scored.push({
      key: pKey,
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: p.rating,
      tags,
      solvedCount,
      url: getProblemUrl(p),
      matchedWeakTags,
      matchedUnderexploredTags,
      previouslyAttempted,
      reasonText: reasons.join(' · '),
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.solvedCount - a.solvedCount);

  const totalMatching = scored.length;
  const safeOffset = totalMatching > 0 ? (pageOffset * limit) % totalMatching : 0;
  const slice = scored.slice(safeOffset, safeOffset + limit);

  return {
    suggestions: slice,
    totalMatching,
    ratingRange: [minR, maxR],
  };
}

export const COMMON_TRAINING_TOPICS: string[] = [
  'dp',
  'graphs',
  'trees',
  'binary search',
  'greedy',
  'math',
  'number theory',
  'constructive algorithms',
  'data structures',
  'two pointers',
  'bitmasks',
  'strings',
  'combinatorics',
  'dfs and similar',
];

export interface MemberCommunityMetrics {
  cfRating: number;
  cfMaxRating: number;
  cfRank: string;
  lastContestDelta: number;
  weeklySolves: number;
  currentStreak: number;
  totalSolved: number;
}

export function computeMemberCommunityMetrics(bundle: CFBundle): MemberCommunityMetrics {
  const cfRating = Math.max(0, Math.min(6000, Math.round(bundle.user.rating ?? 0)));
  const cfMaxRating = Math.max(
    cfRating,
    Math.min(6000, Math.round(bundle.user.maxRating ?? bundle.user.rating ?? 0))
  );
  const cfRank = (bundle.user.rank ?? 'unrated').slice(0, 40);

  let lastContestDelta = 0;
  if (bundle.ratingHistory.length > 0) {
    let latest = bundle.ratingHistory[0];
    for (const r of bundle.ratingHistory) {
      if (r.ratingUpdateTimeSeconds > latest.ratingUpdateTimeSeconds) {
        latest = r;
      }
    }
    lastContestDelta = Math.max(
      -3000,
      Math.min(3000, Math.round(latest.newRating - latest.oldRating))
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const weekCutoff = nowSec - 7 * 86400;
  const allSolved = new Set<string>();
  const weeklySolved = new Set<string>();

  for (const s of bundle.submissions) {
    if (s.verdict !== 'OK') continue;
    const key = getProblemKey(s.problem);
    allSolved.add(key);
    if (s.creationTimeSeconds >= weekCutoff) {
      weeklySolved.add(key);
    }
  }

  const streaks = computeStreaks(bundle.submissions);

  return {
    cfRating,
    cfMaxRating,
    cfRank,
    lastContestDelta,
    weeklySolves: Math.min(10000, weeklySolved.size),
    currentStreak: Math.min(5000, streaks.currentStreak),
    totalSolved: Math.min(50000, allSolved.size),
  };
}

