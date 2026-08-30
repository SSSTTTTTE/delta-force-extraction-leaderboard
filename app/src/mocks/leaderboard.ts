import type { LeaderboardResponse } from "@/types/leaderboard";

/**
 * 本地 mock 数据 —— 与当前页面展示一致。
 * 接入真实接口后此文件仅作为接口不可用时的兜底数据。
 */
export const MOCK_LEADERBOARD: LeaderboardResponse = {
  title: "KASA电竞带出价值排行榜",
  updatedAt: "2024-06-20T12:00:00+08:00",
  entries: [
    { rank: 1, playerId: "ApexHunter", value: 358745920 },
    { rank: 2, playerId: "EchoKnight", value: 286450680 },
    { rank: 3, playerId: "ShadowWalker", value: 242198540 },
    { rank: 4, playerId: "ZeroMercy", value: 196875230 },
    { rank: 5, playerId: "GhostRider", value: 178564110 },
    { rank: 6, playerId: "IronViper", value: 154328760 },
    { rank: 7, playerId: "NightStalker", value: 132887420 },
    { rank: 8, playerId: "DesertFox", value: 118765300 },
    { rank: 9, playerId: "BlueFalcon", value: 102443880 },
    { rank: 10, playerId: "LightBringer", value: 88331420 },
    { rank: 11, playerId: "SneakyCat", value: 76540210 },
    { rank: 12, playerId: "LoneWolf", value: 64223770 },
    { rank: 13, playerId: "RapidFire", value: 53889160 },
    { rank: 14, playerId: "SilentStorm", value: 42112300 },
    { rank: 15, playerId: "WindChaser", value: 31556780 },
  ],
};
