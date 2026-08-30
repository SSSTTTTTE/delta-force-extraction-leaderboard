import type { AdminPlayer, LeaderboardResponse, PlayerHistoryResponse } from "@/types/leaderboard";
import { MOCK_LEADERBOARD } from "@/mocks/leaderboard";

/**
 * 排行榜数据服务。
 *
 * 接入真实数据：在 `app/.env` 中配置
 *   VITE_LEADERBOARD_API=https://your-server.com/api/leaderboard
 * 接口需返回 LeaderboardResponse 结构（见 src/types/leaderboard.ts）：
 *   {
 *     "title": "KASA电竞带出价值排行榜",
 *     "period": "2024.05.20 - 2024.06.20",        // 可选
 *     "updatedAt": "2024-06-20T12:00:00+08:00",
 *     "entries": [{ "rank": 1, "playerId": "ApexHunter", "value": 358745920 }, ...]
 *   }
 * 未配置或请求失败时自动回退到本地 mock 数据。
 */

const API_URL =
  (import.meta.env.VITE_LEADERBOARD_API as string | undefined) ?? "/api/leaderboard";

/** 千分位格式化：358745920 -> "358,745,920" */
export function formatValue(v: number): string {
  return v.toLocaleString("en-US");
}

async function fetchFromApi(url: string): Promise<LeaderboardResponse> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`leaderboard api responded ${res.status}`);
  }
  const data = (await res.json()) as LeaderboardResponse;
  if (!Array.isArray(data.entries)) {
    throw new Error("leaderboard api: invalid payload shape");
  }
  return data;
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return fallback;
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  try {
    return await fetchFromApi(API_URL);
  } catch (err) {
    console.warn("[leaderboard] 接口请求失败，使用本地兜底数据：", err);
    return MOCK_LEADERBOARD;
  }
}

/** 提交一条战绩：playerId 的带出价值会被服务端累计，返回最新榜单 */
export async function submitEntry(
  playerId: string,
  value: number,
): Promise<LeaderboardResponse> {
  const res = await fetch(`${API_URL}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ playerId, value }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(errorMessage(body, `提交失败（${res.status}）`));
  }
  return (await res.json()) as LeaderboardResponse;
}

/** 获取玩家最近若干次提交明细（用于上涨曲线） */
export async function fetchPlayerHistory(
  playerId: string,
): Promise<PlayerHistoryResponse> {
  const res = await fetch(`${API_URL}/player/${encodeURIComponent(playerId)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`获取玩家历史失败（${res.status}）`);
  }
  return (await res.json()) as PlayerHistoryResponse;
}

/* ---------- 管理接口 ---------- */

const ADMIN_TOKEN_KEY = "kasa_admin_token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function adminLogin(password: string): Promise<void> {
  const res = await fetch(`${API_URL.replace(/\/leaderboard$/, "")}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(errorMessage(body, `登录失败（${res.status}）`));
  }
  const body = (await res.json()) as { token: string };
  sessionStorage.setItem(ADMIN_TOKEN_KEY, body.token);
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = API_URL.replace(/\/leaderboard$/, "");
  const res = await fetch(`${base}/admin${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-admin-token": getAdminToken() ?? "",
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 401) clearAdminToken();
    throw new Error(errorMessage(body, `请求失败（${res.status}）`));
  }
  return (await res.json()) as T;
}

export function adminFetchPlayers(): Promise<{ players: AdminPlayer[] }> {
  return adminFetch("/players");
}

export function adminAdjust(playerId: string, total: number): Promise<{ ok: true }> {
  return adminFetch("/adjust", { method: "POST", body: JSON.stringify({ playerId, total }) });
}

export function adminDeleteEntry(
  playerId: string,
  index: number,
  entry?: { value: number; ts: string },
): Promise<{ ok: true; total: number }> {
  return adminFetch("/delete-entry", {
    method: "POST",
    body: JSON.stringify({ playerId, index, ...entry }),
  });
}

export function adminDeletePlayer(playerId: string): Promise<{ ok: true; playerId: string }> {
  return adminFetch("/delete-player", { method: "POST", body: JSON.stringify({ playerId }) });
}
