// API client for the Flask backend.
//
// The server endpoint URL is read from NEXT_PUBLIC_API_URL (see .env.local),
// falling back to the local dev server. Change this one variable to point the
// whole UI at a different backend.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

export type User = {
  user_id: string;
  username: string;
  email: string;
};

// A chat log row. The server stores flexible documents, so fields are optional.
export type Chat = {
  _id?: string;
  user_id?: string;
  input?: string;
  tool?: string;
  output?: string;
  status?: string;
  timestamp?: string;
  [key: string]: unknown;
};

// User-defined session metadata. A flexible list mixing:
//   { session_id: "display name" }          — per-session names (string value)
//   { Green: [...ids], Blue: [...ids] }      — color labels grouping sessions
export type SessionMap = Record<string, string | string[]>[];

export type ChatsResult = { chats: Chat[]; sessionMap: SessionMap };

export type SessionGroup = {
  sessionId: string;
  latestTs: string;
  count: number;
};

export type ChatsSummaryResult = {
  sessions: SessionGroup[];
  sessionMap: SessionMap;
};

export type ChatsStatsResult = {
  total: number;
  toolCalls: number;
  distinctTools: number;
};

export type SessionLabel = "None" | "Green" | "Blue";
const LABEL_COLORS: SessionLabel[] = ["Green", "Blue"];

/** Look up a session's display name from the session_map, or "" if untagged. */
export function sessionName(map: SessionMap | undefined, sessionId: string): string {
  if (!map) return "";
  for (const entry of map) {
    const v = entry[sessionId];
    if (typeof v === "string") return v || "";
  }
  return "";
}

/** Look up a session's color label, or "None" if unlabeled. */
export function sessionLabel(
  map: SessionMap | undefined,
  sessionId: string
): SessionLabel {
  if (!map) return "None";
  for (const entry of map) {
    for (const color of LABEL_COLORS) {
      const ids = entry[color];
      if (Array.isArray(ids) && ids.includes(sessionId)) return color;
    }
  }
  return "None";
}

// --- session storage (token + 5-minute TTL, per requirements) ----------------

const TOKEN_KEY = "cli-dashboard:token";
const EXPIRES_KEY = "cli-dashboard:expires_at"; // epoch ms
const USER_KEY = "cli-dashboard:user";

// --- client-side response cache (sessionStorage, with TTL) -------------------
// Caches /api/chats responses so navigating around the app doesn't re-hit the
// server (and its DB). The manual Sync button bypasses this and rehydrates it.

const CHATS_CACHE_PREFIX = "cli-dashboard:chats:";
const SUMMARY_CACHE_PREFIX = "cli-dashboard:summary:";
const STATS_CACHE_PREFIX = "cli-dashboard:stats:";
const CHATS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CachedChats = { data: Chat[]; sessionMap: SessionMap; cachedAt: number };

function chatsCacheKey(scope: string): string {
  return CHATS_CACHE_PREFIX + scope;
}

function readChatsCache(scope: string): ChatsResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(chatsCacheKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedChats;
    if (Date.now() - parsed.cachedAt > CHATS_CACHE_TTL_MS) {
      sessionStorage.removeItem(chatsCacheKey(scope));
      return null;
    }
    return { chats: parsed.data, sessionMap: parsed.sessionMap ?? [] };
  } catch {
    return null;
  }
}

function writeChatsCache(scope: string, data: Chat[], sessionMap: SessionMap): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedChats = { data, sessionMap, cachedAt: Date.now() };
    sessionStorage.setItem(chatsCacheKey(scope), JSON.stringify(payload));
  } catch {
    /* quota or serialization failure — caching is best-effort */
  }
}

/** Drop all cached chat responses (e.g. on logout or when switching users). */
export function clearChatsCache(): void {
  if (typeof window === "undefined") return;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key && (key.startsWith(CHATS_CACHE_PREFIX) || key.startsWith(SUMMARY_CACHE_PREFIX) || key.startsWith(STATS_CACHE_PREFIX))) {
      sessionStorage.removeItem(key);
    }
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function setSession(token: string, expiresAtMs: number, user: User): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(expiresAtMs));
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
  sessionStorage.removeItem(USER_KEY);
  clearChatsCache();
}

/** Returns the token only if it exists and has not passed its TTL. */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(sessionStorage.getItem(EXPIRES_KEY) ?? 0);
  if (!token || !expiresAt) return null;
  if (Date.now() >= expiresAt) {
    clearSession();
    return null;
  }
  return token;
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/** True when a non-expired token is present locally. */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

// --- request helper ----------------------------------------------------------

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = getToken();
    if (!token) throw new ApiError("invalid_or_expired_session", 401);
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Could not reach the server.", 0);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty / non-JSON body */
  }

  if (!res.ok) {
    if (res.status === 401) clearSession();
    const message =
      (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

// --- endpoints ---------------------------------------------------------------

type AuthResponse = {
  token: string;
  expires_at: string;
  ttl_seconds: number;
  user: User;
};

/** POST /api/authenticate — log in (or sign up) and persist the session token. */
export async function login(
  username: string,
  password: string,
  options?: { signup?: boolean; email?: string }
): Promise<User> {
  const body: Record<string, unknown> = { username, password };
  if (options?.signup) {
    body.signup = true;
    body.email = options.email;
  }

  const data = await request<AuthResponse>("/api/authenticate", {
    method: "POST",
    body: JSON.stringify(body),
  });

  // Prefer the server's expiry; fall back to ttl_seconds, then 15 minutes.
  const expiresAtMs =
    Date.parse(data.expires_at) ||
    Date.now() + (data.ttl_seconds ?? 900) * 1000;

  // Drop any cache left over from a previous user before storing this session.
  clearChatsCache();
  setSession(data.token, expiresAtMs, data.user);
  return data.user;
}

/** GET /api/session — confirm the token is still active on the server. */
export async function checkSession(): Promise<boolean> {
  try {
    await request("/api/session", { method: "GET" }, true);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

/** DELETE /api/session — revoke server-side, then clear local session. */
export async function logout(): Promise<void> {
  try {
    await request("/api/session", { method: "DELETE" }, true);
  } catch {
    /* clear locally regardless */
  }
  clearSession();
}

/**
 * GET /api/chats — the authenticated user's chat logs.
 *
 * Served from the sessionStorage cache when fresh. Pass `forceRefresh: true`
 * (the Sync button) to bypass both the client cache and the server cache and
 * rehydrate with fresh data.
 */
export async function getChats(options?: {
  demo?: boolean;
  forceRefresh?: boolean;
  sessionId?: string;
}): Promise<ChatsResult> {
  const isDemo = options?.demo ?? false;
  const forceRefresh = options?.forceRefresh ?? false;
  const sid = options?.sessionId;
  const scope = isDemo ? "demo" : getStoredUser()?.user_id ?? "me";
  const cacheScope = sid ? `${scope}:${sid}` : scope;

  if (!forceRefresh) {
    const cached = readChatsCache(cacheScope);
    if (cached) return cached;
  }

  const params = new URLSearchParams();
  if (isDemo) {
    params.set("demo", "true");
  } else {
    const userId = getStoredUser()?.user_id;
    if (userId) params.set("user_id", userId);
  }
  if (sid) params.set("session_id", sid);
  // Tell the server to skip its cache too on a manual sync.
  if (forceRefresh) params.set("refresh", "true");

  const qs = params.toString() ? `?${params.toString()}` : "";
  const data = await request<{
    chats: Chat[];
    count: number;
    session_map?: SessionMap;
  }>(
    `/api/chats${qs}`,
    { method: "GET" },
    !isDemo // auth only for non-demo requests
  );

  const chats = data.chats ?? [];
  const sessionMap = data.session_map ?? [];
  writeChatsCache(cacheScope, chats, sessionMap);
  return { chats, sessionMap };
}

/** Fetch chats for the sample/demo dashboard — no login required. */
export async function getDemoChats(forceRefresh = false, sessionId?: string): Promise<ChatsResult> {
  return getChats({ demo: true, forceRefresh, sessionId });
}

function readSummaryCache(scope: string): ChatsSummaryResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SUMMARY_CACHE_PREFIX + scope);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CHATS_CACHE_TTL_MS) {
      sessionStorage.removeItem(SUMMARY_CACHE_PREFIX + scope);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSummaryCache(scope: string, data: ChatsSummaryResult): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SUMMARY_CACHE_PREFIX + scope, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {}
}

export async function getChatsSummary(options?: {
  demo?: boolean;
  forceRefresh?: boolean;
}): Promise<ChatsSummaryResult> {
  const isDemo = options?.demo ?? false;
  const forceRefresh = options?.forceRefresh ?? false;
  const scope = isDemo ? "demo" : getStoredUser()?.user_id ?? "me";

  if (!forceRefresh) {
    const cached = readSummaryCache(scope);
    if (cached) return cached;
  }

  const params = new URLSearchParams();
  if (isDemo) {
    params.set("demo", "true");
  } else {
    const userId = getStoredUser()?.user_id;
    if (userId) params.set("user_id", userId);
  }
  if (forceRefresh) params.set("refresh", "true");

  const qs = params.toString() ? `?${params.toString()}` : "";
  const data = await request<{
    sessions: SessionGroup[];
    session_map?: SessionMap;
  }>(
    `/api/chats/summary${qs}`,
    { method: "GET" },
    !isDemo
  );

  const result: ChatsSummaryResult = {
    sessions: data.sessions ?? [],
    sessionMap: data.session_map ?? [],
  };
  writeSummaryCache(scope, result);
  return result;
}

export async function getDemoChatsSummary(forceRefresh = false): Promise<ChatsSummaryResult> {
  return getChatsSummary({ demo: true, forceRefresh });
}

function readStatsCache(scope: string): ChatsStatsResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STATS_CACHE_PREFIX + scope);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CHATS_CACHE_TTL_MS) {
      sessionStorage.removeItem(STATS_CACHE_PREFIX + scope);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeStatsCache(scope: string, data: ChatsStatsResult): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STATS_CACHE_PREFIX + scope, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {}
}

export async function getChatsStats(options?: {
  demo?: boolean;
  forceRefresh?: boolean;
}): Promise<ChatsStatsResult> {
  const isDemo = options?.demo ?? false;
  const forceRefresh = options?.forceRefresh ?? false;
  const scope = isDemo ? "demo" : getStoredUser()?.user_id ?? "me";

  if (!forceRefresh) {
    const cached = readStatsCache(scope);
    if (cached) return cached;
  }

  const params = new URLSearchParams();
  if (isDemo) {
    params.set("demo", "true");
  } else {
    const userId = getStoredUser()?.user_id;
    if (userId) params.set("user_id", userId);
  }
  if (forceRefresh) params.set("refresh", "true");

  const qs = params.toString() ? `?${params.toString()}` : "";
  const data = await request<{
    stats: ChatsStatsResult;
  }>(
    `/api/chats/stats${qs}`,
    { method: "GET" },
    !isDemo
  );

  const result = data.stats ?? { total: 0, toolCalls: 0, distinctTools: 0 };
  writeStatsCache(scope, result);
  return result;
}

export async function getDemoChatsStats(forceRefresh = false): Promise<ChatsStatsResult> {
  return getChatsStats({ demo: true, forceRefresh });
}

/** DELETE /api/chats — bulk delete chat records. */
export async function deleteChats(records: Record<string, unknown>[], demo = false): Promise<void> {
  if (demo) throw new Error("Cannot delete in demo mode");
  await request(
    "/api/chats",
    {
      method: "DELETE",
      body: JSON.stringify({ records }),
    },
    true
  );
  clearChatsCache();
}

/**
 * POST /api/session/update — update session metadata (name and/or label).
 *
 * In demo mode it targets the shared viewer account (no auth), mirroring how
 * `/api/chats?demo=true` resolves its user. Only the keys passed in `body` are
 * changed server-side, so name and label edits don't clobber each other.
 */
async function postSessionUpdate(
  body: Record<string, unknown>,
  demo: boolean
): Promise<SessionMap> {
  const params = new URLSearchParams();
  if (demo) {
    params.set("demo", "true");
  } else {
    const userId = getStoredUser()?.user_id;
    if (userId) params.set("user_id", userId);
  }
  const qs = params.toString() ? `?${params.toString()}` : "";

  const data = await request<{ session_map: SessionMap }>(
    `/api/session/update${qs}`,
    { method: "POST", body: JSON.stringify(body) },
    !demo // auth only for non-demo requests
  );
  // Bust the cached chats so the change is reflected on next load.
  clearChatsCache();
  return data.session_map ?? [];
}

/** Tag a session id with a display name. */
export function updateSessionName(
  sessionId: string,
  name: string,
  demo = false
): Promise<SessionMap> {
  return postSessionUpdate({ session_id: sessionId, name }, demo);
}

/** Assign a color label (or "None") to a session id. */
export function updateSessionLabel(
  sessionId: string,
  label: SessionLabel,
  demo = false
): Promise<SessionMap> {
  return postSessionUpdate({ session_id: sessionId, label }, demo);
}

/** GET /api/profile — the authenticated user's details. */
export async function getProfile(): Promise<User> {
  const userId = getStoredUser()?.user_id;
  const params = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  return request<User>(`/api/profile${params}`, { method: "GET" }, true);
}

/** PUT /api/profile/password — update the authenticated user's password. */
export async function updatePassword(
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  const userId = getStoredUser()?.user_id;
  const params = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  await request(
    `/api/profile/password${params}`,
    {
      method: "PUT",
      body: JSON.stringify({
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    },
    true
  );
}

export async function getTurnTools(sessionId: string, entryIndex: number, demo = false): Promise<unknown[]> {
  const isDemo = demo ?? false;
  const params = new URLSearchParams();
  if (isDemo) params.set("demo", "true");
  params.set("session_id", sessionId);
  params.set("entry_index", String(entryIndex));

  const qs = params.toString() ? `?${params.toString()}` : "";
  const data = await request<{ tools: unknown[] }>(
    `/api/chats/tool${qs}`,
    { method: "GET" },
    !isDemo
  );
  return data.tools ?? [];
}
