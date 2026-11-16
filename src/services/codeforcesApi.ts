import type {
  CFBundle,
  CFContest,
  CFProblemsetPayload,
  CFRatingChange,
  CFSubmission,
  CFUser,
} from '../types/codeforces';

const CF_API_BASE = 'https://codeforces.com/api';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PROBLEMSET_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CONTEST_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REQUEST_GAP_MS = 380;

const memoryCache = new Map<string, CFBundle>();
let problemsetCache: { payload: CFProblemsetPayload; fetchedAt: number } | null = null;
let problemsetInFlight: Promise<CFProblemsetPayload> | null = null;
let contestCache: { contests: CFContest[]; fetchedAt: number } | null = null;
let contestInFlight: Promise<CFContest[]> | null = null;

let lastRequestTime = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCFEndpoint<T>(path: string, attempt = 0): Promise<T> {
  const now = Date.now();
  const wait = Math.max(0, REQUEST_GAP_MS - (now - lastRequestTime));
  if (wait > 0) {
    await sleep(wait);
  }
  lastRequestTime = Date.now();

  let response: Response;
  try {
    response = await fetch(`${CF_API_BASE}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    if (attempt < 2) {
      await sleep(900 * (attempt + 1));
      return fetchCFEndpoint<T>(path, attempt + 1);
    }
    throw new Error('Unable to reach Codeforces API. Check your internet connection or try again in a moment.');
  }

  let payload: { status?: string; comment?: string; result?: T } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 429 || response.status === 503 || payload?.comment?.includes('Call limit exceeded')) {
    if (attempt < 3) {
      await sleep(1200 * (attempt + 1));
      return fetchCFEndpoint<T>(path, attempt + 1);
    }
    throw new Error('Codeforces API rate limit reached. Please wait a few seconds and refresh.');
  }

  if (!response.ok || !payload || payload.status !== 'OK' || payload.result === undefined) {
    const comment = payload?.comment || `Codeforces API returned HTTP ${response.status}`;
    throw new Error(comment);
  }

  return payload.result;
}

export async function fetchCodeforcesUserBundle(
  rawHandle: string,
  options?: { forceRefresh?: boolean }
): Promise<CFBundle> {
  const handle = rawHandle.trim();
  if (!handle) {
    throw new Error('Please enter a valid Codeforces handle.');
  }

  const cacheKey = handle.toLowerCase();
  const cached = memoryCache.get(cacheKey);
  if (cached && !options?.forceRefresh && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  const encoded = encodeURIComponent(handle);

  const users = await fetchCFEndpoint<CFUser[]>(`/user.info?handles=${encoded}`);
  if (!users || users.length === 0) {
    throw new Error(`Handle "${handle}" was not found on Codeforces.`);
  }
  const user = users[0];

  const ratingHistory = await fetchCFEndpoint<CFRatingChange[]>(
    `/user.rating?handle=${encodeURIComponent(user.handle)}`
  );
  const submissions = await fetchCFEndpoint<CFSubmission[]>(
    `/user.status?handle=${encodeURIComponent(user.handle)}&from=1&count=10000`
  );

  const bundle: CFBundle = {
    user,
    ratingHistory: Array.isArray(ratingHistory) ? ratingHistory : [],
    submissions: Array.isArray(submissions) ? submissions : [],
    fetchedAt: Date.now(),
  };

  memoryCache.set(cacheKey, bundle);
  return bundle;
}

export function getCachedProblemset(): CFProblemsetPayload | null {
  if (problemsetCache && Date.now() - problemsetCache.fetchedAt < PROBLEMSET_CACHE_TTL_MS) {
    return problemsetCache.payload;
  }
  return null;
}

export async function fetchCodeforcesProblemset(
  forceRefresh = false
): Promise<CFProblemsetPayload> {
  if (!forceRefresh) {
    const cached = getCachedProblemset();
    if (cached) return cached;
  }
  if (problemsetInFlight && !forceRefresh) {
    return problemsetInFlight;
  }

  problemsetInFlight = fetchCFEndpoint<CFProblemsetPayload>('/problemset.problems')
    .then((payload) => {
      problemsetCache = { payload, fetchedAt: Date.now() };
      return payload;
    })
    .finally(() => {
      problemsetInFlight = null;
    });

  return problemsetInFlight;
}

export function getCachedContests(): CFContest[] | null {
  if (contestCache && Date.now() - contestCache.fetchedAt < CONTEST_CACHE_TTL_MS) {
    return contestCache.contests;
  }
  return null;
}

export async function fetchCodeforcesContests(forceRefresh = false): Promise<CFContest[]> {
  if (!forceRefresh) {
    const cached = getCachedContests();
    if (cached) return cached;
  }
  if (contestInFlight && !forceRefresh) {
    return contestInFlight;
  }

  contestInFlight = fetchCFEndpoint<CFContest[]>('/contest.list?gym=false')
    .then((list) => {
      const normalized = Array.isArray(list) ? list : [];
      contestCache = { contests: normalized, fetchedAt: Date.now() };
      return normalized;
    })
    .finally(() => {
      contestInFlight = null;
    });

  return contestInFlight;
}
