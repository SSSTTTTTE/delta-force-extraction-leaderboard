import fs from "node:fs";
import path from "node:path";
import seedData from "../server/data.json" with { type: "json" };

const DATA_FILE = path.join(process.cwd(), "server", "data.json");
// Vercel 的部署文件系统是只读的；把当前运行实例的修改写到可写临时目录。
// 初始数据仍从仓库中的 data.json 读取，避免线上因 /var/task 路径不存在而提交失败。
const RUNTIME_DATA_FILE = path.join("/tmp", "kasa-leaderboard-data.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const HISTORY_CAP = 50;
const HISTORY_RECENT = 10;

function loadData() {
  for (const file of [RUNTIME_DATA_FILE, DATA_FILE]) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      return {
        totals: raw && typeof raw.totals === "object" && raw.totals !== null ? raw.totals : {},
        history: raw && typeof raw.history === "object" && raw.history !== null ? raw.history : {},
      };
    } catch {
      // 运行时文件可能尚未创建，继续读取仓库内的种子数据。
    }
  }
  return {
    totals: { ...(seedData.totals ?? {}) },
    history: Object.fromEntries(
      Object.entries(seedData.history ?? {}).map(([playerId, entries]) => [playerId, [...entries]]),
    ),
  };
}

function saveData(data) {
  fs.writeFileSync(RUNTIME_DATA_FILE, JSON.stringify(data, null, 2));
}

function buildResponse() {
  const { totals } = loadData();
  const entries = Object.entries(totals)
    .map(([playerId, value]) => ({ playerId, value }))
    .sort((a, b) => b.value - a.value)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
  return {
    title: "KASA电竞带出价值排行榜",
    updatedAt: new Date().toISOString(),
    entries,
  };
}

function getPath(req) {
  const queryPath = req.query?.path;
  if (Array.isArray(queryPath)) return queryPath;
  if (typeof queryPath === "string" && queryPath) return queryPath.split("/");
  return new URL(req.url ?? "/", "http://localhost").pathname.split("/").filter(Boolean).slice(1);
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept,x-admin-token");
  res.end(JSON.stringify(body));
}

function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return JSON.parse(req.body);
  return {};
}

function requireAdmin(req, res) {
  if (!ADMIN_PASSWORD || !ADMIN_TOKEN) {
    sendJson(res, 503, { error: "管理员登录未配置，请先设置 ADMIN_PASSWORD 和 ADMIN_TOKEN" });
    return false;
  }
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    sendJson(res, 401, { error: "未授权" });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  const route = getPath(req);
  if (route[0] !== "leaderboard" && route[0] !== "admin") {
    return sendJson(res, 404, { error: "not found" });
  }

  if (route[0] === "leaderboard" && req.method === "GET" && route.length === 1) {
    return sendJson(res, 200, buildResponse());
  }

  if (route[0] === "leaderboard" && req.method === "GET" && route[1] === "player" && route[2]) {
    const playerId = decodeURIComponent(route.slice(2).join("/"));
    const data = loadData();
    if (!(playerId in data.totals)) return sendJson(res, 404, { error: "玩家不存在" });
    return sendJson(res, 200, {
      playerId,
      total: data.totals[playerId],
      entries: (data.history[playerId] ?? []).slice(-HISTORY_RECENT),
    });
  }

  if (route[0] === "leaderboard" && req.method === "POST" && route[1] === "entries") {
    try {
      const body = bodyOf(req);
      const playerId = String(body.playerId ?? "").trim();
      const value = Number(body.value);
      if (!playerId) return sendJson(res, 400, { error: "playerId 不能为空" });
      if (!Number.isFinite(value) || value < 0) {
        return sendJson(res, 400, { error: "value 必须是非负数字" });
      }
      const data = loadData();
      data.totals[playerId] = (data.totals[playerId] ?? 0) + Math.round(value);
      const history = (data.history[playerId] ??= []);
      history.push({ value: Math.round(value), ts: new Date().toISOString() });
      if (history.length > HISTORY_CAP) data.history[playerId] = history.slice(-HISTORY_CAP);
      saveData(data);
      return sendJson(res, 200, buildResponse());
    } catch (error) {
      return sendJson(res, 400, { error: `请求解析失败: ${error.message}` });
    }
  }

  const adminPrefix = route[0] === "admin" ? 0 : 1;
  if (route[adminPrefix] !== "admin") return sendJson(res, 404, { error: "not found" });

  if (req.method === "POST" && route[adminPrefix + 1] === "login") {
    if (!ADMIN_PASSWORD || !ADMIN_TOKEN) {
      return sendJson(res, 503, { error: "管理员登录未配置，请先设置 ADMIN_PASSWORD 和 ADMIN_TOKEN" });
    }
    try {
      const body = bodyOf(req);
      return String(body.password) === ADMIN_PASSWORD
        ? sendJson(res, 200, { ok: true, token: ADMIN_TOKEN })
        : sendJson(res, 401, { error: "密码错误" });
    } catch (error) {
      return sendJson(res, 400, { error: `请求解析失败: ${error.message}` });
    }
  }

  if (!requireAdmin(req, res)) return;

  if (req.method === "GET" && route[adminPrefix + 1] === "players") {
    const data = loadData();
    const players = Object.entries(data.totals)
      .map(([playerId, total]) => ({
        playerId,
        total,
        history: (data.history[playerId] ?? []).map((entry, index) => ({ ...entry, index })),
      }))
      .sort((a, b) => b.total - a.total);
    return sendJson(res, 200, { players });
  }

  if (req.method === "POST" && route[adminPrefix + 1] === "adjust") {
    try {
      const body = bodyOf(req);
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
    } catch (error) {
      return sendJson(res, 400, { error: `请求解析失败: ${error.message}` });
    }
  }

  if (req.method === "POST" && route[adminPrefix + 1] === "delete-player") {
    try {
      const body = bodyOf(req);
      const playerId = String(body.playerId ?? "").trim();
      if (!playerId) return sendJson(res, 400, { error: "playerId 不能为空" });
      const data = loadData();
      if (!(playerId in data.totals) && !(playerId in data.history)) {
        return sendJson(res, 404, { error: "玩家不存在" });
      }
      delete data.totals[playerId];
      delete data.history[playerId];
      saveData(data);
      return sendJson(res, 200, { ok: true, playerId });
    } catch (error) {
      return sendJson(res, 400, { error: `删除玩家失败: ${error.message}` });
    }
  }

  if (req.method === "POST" && route[adminPrefix + 1] === "delete-entry") {
    try {
      const body = bodyOf(req);
      const playerId = String(body.playerId ?? "").trim();
      const index = Number(body.index);
      const data = loadData();
      const history = data.history[playerId];
      let targetIndex = index;
      if (
        history &&
        (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= history.length) &&
        typeof body.ts === "string"
      ) {
        targetIndex = history.findIndex(
          (entry) => entry.ts === body.ts && Number(entry.value) === Number(body.value),
        );
      }
      if (!history || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= history.length) {
        return sendJson(res, 404, { error: "记录不存在" });
      }
      const [removed] = history.splice(targetIndex, 1);
      data.totals[playerId] = Math.max(0, (data.totals[playerId] ?? 0) - removed.value);
      if (data.totals[playerId] === 0 && history.length === 0) {
        delete data.totals[playerId];
        delete data.history[playerId];
      }
      saveData(data);
      return sendJson(res, 200, { ok: true, removed, total: data.totals[playerId] ?? 0 });
    } catch (error) {
      return sendJson(res, 400, { error: `请求解析失败: ${error.message}` });
    }
  }

  return sendJson(res, 404, { error: "not found" });
}
