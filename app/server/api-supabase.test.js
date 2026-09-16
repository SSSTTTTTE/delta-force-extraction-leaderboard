import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";

const previousEnv = { ...process.env };
process.env.ADMIN_PASSWORD = "test-password";
process.env.ADMIN_TOKEN = "test-admin-token";
process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const store = new Map();
const fetchMock = mock.method(globalThis, "fetch", async (url, init = {}) => {
  const target = new URL(url);
  if (!target.pathname.endsWith("/rest/v1/leaderboard_store")) {
    return Response.json({ message: "not found" }, { status: 404 });
  }
  if (!init.method || init.method === "GET") {
    const key = decodeURIComponent(target.searchParams.get("key") ?? "").replace(/^eq\./, "");
    return Response.json(store.has(key) ? [{ value: JSON.parse(store.get(key)) }] : []);
  }
  if (init.method === "POST") {
    const row = JSON.parse(init.body);
    store.set(row.key, JSON.stringify(row.value));
    return new Response(null, { status: 201 });
  }
  return Response.json({ message: "method not allowed" }, { status: 405 });
});

const { default: handler } = await import("../api/[...path].js");

beforeEach(() => {
  store.clear();
  fetchMock.mock.resetCalls();
});

after(() => {
  process.env = previousEnv;
  mock.restoreAll();
});

async function request(path, { method = "GET", body, token = "test-admin-token" } = {}) {
  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
  await handler({ url: path, method, body, headers: { "x-admin-token": token } }, res);
  return res;
}

test("supabase storage persists entries across requests", async () => {
  store.set("kasa-leaderboard:data", JSON.stringify({ totals: {}, history: {} }));
  const created = await request("/api/leaderboard/entries", {
    method: "POST",
    body: { playerId: "Alice", value: 7 },
  });
  assert.equal(created.statusCode, 200);
  assert.deepEqual(created.body.entries, [{ rank: 1, playerId: "Alice", value: 7 }]);

  const player = await request("/api/leaderboard/player/Alice");
  assert.equal(player.statusCode, 200);
  assert.equal(player.body.total, 7);
  assert.equal(player.body.entries.length, 1);
});

test("empty supabase table falls back to seed data", async () => {
  const res = await request("/api/leaderboard");
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.entries.length > 0);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("supabase failure returns structured 503 and never writes", async () => {
  fetchMock.mock.mockImplementation(async () => {
    throw new Error("project paused");
  });
  const res = await request("/api/leaderboard");
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, "STORAGE_UNAVAILABLE");
  assert.match(res.body.error, /Supabase/);
});
