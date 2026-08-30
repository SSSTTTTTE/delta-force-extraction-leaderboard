import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 排行榜后端：累计每个玩家的带出价值，并保留每次提交的历史。
 *
 *   GET  /api/leaderboard              -> LeaderboardResponse（见 src/types/leaderboard.ts）
 *   GET  /api/leaderboard/player/<id>  -> 该玩家最近 10 次提交明细 { playerId, total, entries }
 *   POST /api/leaderboard/entries      -> 提交一条战绩 { playerId, value }，累计后返回最新榜单
 *
 * 管理接口（需请求头 x-admin-token，通过 /api/admin/login 获取）：
 *   POST /api/admin/login         { password }
 *   GET  /api/admin/players       全部玩家的总值与完整提交历史
 *   POST /api/admin/adjust        { playerId, total } 调整某人的累计总值
 *   POST /api/admin/delete-entry  { playerId, index } 删除某次提交记录并扣减对应总值
 *
 * 数据持久化在 server/data.json。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");
const PORT = Number(process.env.PORT) || 3001;

/** 管理员密码与令牌通过环境变量注入，避免把凭据提交到代码仓库。 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

/** 每个玩家最多保留的历史条数 */
const HISTORY_CAP = 50;
/** 详情接口返回的最近条数 */
const HISTORY_RECENT = 10;

function loadData() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      totals:
        raw && typeof raw.totals === "object" && raw.totals !== null ? raw.totals : {},
      history:
        raw && typeof raw.history === "object" && raw.history !== null ? raw.history : {},
    };
  } catch {
    /* 文件不存在或损坏时从空数据开始 */
    return { totals: {}, history: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function buildResponse() {
  const { totals } = loadData();
  const entries = Object.entries(totals)
    .map(([playerId, value]) => ({ playerId, value }))
    .sort((a, b) => b.value - a.value)
    .map((e, i) => ({ rank: i + 1, ...e }));
  return {
    title: "KASA电竞带出价值排行榜",
    updatedAt: new Date().toISOString(),
    entries,
  };
}

function buildPlayerResponse(playerId) {
  const { totals, history } = loadData();
  if (!(playerId in totals)) return null;
  const entries = (history[playerId] ?? []).slice(-HISTORY_RECENT);
  return { playerId, total: totals[playerId], entries };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  if (req.method === "GET" && url.pathname === "/api/leaderboard") {
    return sendJson(res, 200, buildResponse());
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/leaderboard/player/")) {
    const playerId = decodeURIComponent(url.pathname.slice("/api/leaderboard/player/".length));
    const body = buildPlayerResponse(playerId);
    if (!body) return sendJson(res, 404, { error: "玩家不存在" });
    return sendJson(res, 200, body);
  }

  if (req.method === "POST" && url.pathname === "/api/leaderboard/entries") {
    try {
      const body = JSON.parse(await readBody(req));
      const playerId = String(body.playerId ?? "").trim();
      const value = Number(body.value);
      if (!playerId) return sendJson(res, 400, { error: "playerId 不能为空" });
      if (!Number.isFinite(value) || value < 0) {
        return sendJson(res, 400, { error: "value 必须是非负数字" });
      }
      const data = loadData();
      data.totals[playerId] = (data.totals[playerId] ?? 0) + Math.round(value);
      const list = (data.history[playerId] ??= []);
      list.push({ value: Math.round(value), ts: new Date().toISOString() });
      if (list.length > HISTORY_CAP) data.history[playerId] = list.slice(-HISTORY_CAP);
      saveData(data);
      return sendJson(res, 200, buildResponse());
    } catch (err) {
      return sendJson(res, 400, { error: `请求解析失败: ${err.message}` });
    }
  }

  /* ---------- 管理接口 ---------- */

  if (url.pathname.startsWith("/api/admin/")) {
    // 登录接口本身不需要令牌
    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      if (!ADMIN_PASSWORD || !ADMIN_TOKEN) {
        return sendJson(res, 503, { error: "管理员登录未配置，请先设置 ADMIN_PASSWORD 和 ADMIN_TOKEN" });
      }
      try {
        const body = JSON.parse(await readBody(req));
        if (String(body.password) === ADMIN_PASSWORD) {
          return sendJson(res, 200, { ok: true, token: ADMIN_TOKEN });
        }
        return sendJson(res, 401, { error: "密码错误" });
      } catch (err) {
        return sendJson(res, 400, { error: `请求解析失败: ${err.message}` });
      }
    }

    if (req.headers["x-admin-token"] !== ADMIN_TOKEN) {
      return sendJson(res, 401, { error: "未授权" });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/players") {
      const data = loadData();
      const players = Object.entries(data.totals)
        .map(([playerId, total]) => ({
          playerId,
          total,
          history: (data.history[playerId] ?? []).map((e, i) => ({ ...e, index: i })),
        }))
        .sort((a, b) => b.total - a.total);
      return sendJson(res, 200, { players });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/adjust") {
      try {
        const body = JSON.parse(await readBody(req));
        const playerId = String(body.playerId ?? "").trim();
        const total = Number(body.total);
        if (!playerId) return sendJson(res, 400, { error: "playerId 不能为空" });
        if (!Number.isFinite(total) || total < 0) {
          return sendJson(res, 400, { error: "total 必须是非负数字" });
        }
        const data = loadData();
        if (!(playerId in data.totals)) return sendJson(res, 404, { error: "玩家不存在" });
        data.totals[playerId] = Math.round(total);
        saveData(data);
        return sendJson(res, 200, { ok: true, total: data.totals[playerId] });
      } catch (err) {
        return sendJson(res, 400, { error: `请求解析失败: ${err.message}` });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/admin/delete-entry") {
      try {
        const body = JSON.parse(await readBody(req));
        const playerId = String(body.playerId ?? "").trim();
        const index = Number(body.index);
        const data = loadData();
        const list = data.history[playerId];
        if (!list || !Number.isInteger(index) || index < 0 || index >= list.length) {
          return sendJson(res, 404, { error: "记录不存在" });
        }
        const [removed] = list.splice(index, 1);
        data.totals[playerId] = Math.max(0, (data.totals[playerId] ?? 0) - removed.value);
        // 总值与历史都清空时移除该玩家
        if (data.totals[playerId] === 0 && list.length === 0) {
          delete data.totals[playerId];
          delete data.history[playerId];
        }
        saveData(data);
        return sendJson(res, 200, { ok: true, removed, total: data.totals[playerId] ?? 0 });
      } catch (err) {
        return sendJson(res, 400, { error: `请求解析失败: ${err.message}` });
      }
    }

    return sendJson(res, 404, { error: "not found" });
  }

  return sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`[leaderboard-server] listening on http://localhost:${PORT}`);
});
