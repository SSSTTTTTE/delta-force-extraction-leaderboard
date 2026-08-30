/** 排行榜条目 */
export interface LeaderboardEntry {
  /** 名次，从 1 开始 */
  rank: number;
  /** 选手 ID */
  playerId: string;
  /** 带出总价值（原始数值，前端负责千分位格式化） */
  value: number;
}

/** 排行榜接口响应 */
export interface LeaderboardResponse {
  /** 榜单标题 */
  title: string;
  /** 统计周期，可选；不传则不展示 */
  period?: string;
  /** 数据更新时间，ISO 8601 字符串 */
  updatedAt: string;
  /** 榜单条目，按名次升序 */
  entries: LeaderboardEntry[];
}

/** 一次提交记录 */
export interface PlayerHistoryEntry {
  /** 本次带出价值（增量） */
  value: number;
  /** 提交时间，ISO 8601 字符串 */
  ts: string;
}

/** 玩家历史接口响应 */
export interface PlayerHistoryResponse {
  playerId: string;
  /** 累计带出总价值 */
  total: number;
  /** 最近若干次提交，按时间升序 */
  entries: PlayerHistoryEntry[];
}

/** 管理页的玩家记录（含完整历史，index 为历史数组下标） */
export interface AdminPlayer {
  playerId: string;
  total: number;
  history: { value: number; ts: string; index: number }[];
}
