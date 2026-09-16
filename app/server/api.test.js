import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";

const previousEnv = { ...process.env };
process.env.ADMIN_PASSWORD = "test-password";
process.env.ADMIN_TOKEN = "test-admin-token";
process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";

const get = mock.fn();
const put = mock.fn();
mock.module("@vercel/blob", { namedExports: { get, put } });
const { default: handler } = await import("../api/[...path].js");
const { default: playersHandler } = await import("../api/admin/players.js");

beforeEach(() => {
  get.mock.resetCalls();
  put.mock.resetCalls();
  get.mock.mockImplementation(async () => ({
    stream: new Response(JSON.stringify({ totals: { Alice: 10 }, history: { Alice: [] } })).body,
  }));
  put.mock.mockImplementation(async () => ({}));
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
  const routeHandler = path === "/api/admin/players" ? playersHandler : handler;
  await routeHandler({ url: path, method, body, headers: { "x-admin-token": token } }, res);
  return res;
}

test("admin players returns persisted data and disables response caching", async () => {
  const res = await request("/api/admin/players");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.players, [{ playerId: "Alice", total: 10, history: [] }]);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("suspended Blob returns structured 503 for all data reads", async () => {
  get.mock.mockImplementation(async () => { throw new Error("Vercel Blob: Failed to fetch blob: 403 Forbidden"); });
  for (const path of ["/api/admin/players", "/api/leaderboard", "/api/leaderboard/player/Alice"]) {
    const res = await request(path);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, "STORAGE_UNAVAILABLE");
    assert.match(res.body.error, /Vercel Blob/);
    assert.equal(res.headers["Cache-Control"], "no-store");
  }
  assert.equal(put.mock.callCount(), 0);
});

test("failed reads never overwrite existing Blob data with seed data", async () => {
  get.mock.mockImplementation(async () => { throw new Error("403 Forbidden"); });
  for (const path of ["/api/leaderboard/entries", "/api/admin/adjust", "/api/admin/rename", "/api/admin/delete-entry", "/api/admin/delete-player"]) {
    const res = await request(path, { method: "POST", body: { playerId: "Alice", value: 1, total: 11, newName: "Bob", index: 0 } });
    assert.equal(res.statusCode, 503, path);
    assert.equal(res.body.code, "STORAGE_UNAVAILABLE");
  }
  assert.equal(put.mock.callCount(), 0);
});

test("failed writes return 503 rather than reporting invalid user input or success", async () => {
  put.mock.mockImplementation(async () => { throw new Error("store suspended"); });
  const res = await request("/api/admin/adjust", { method: "POST", body: { playerId: "Alice", total: 20 } });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, "STORAGE_UNAVAILABLE");
});

test("invalid input and unauthorized requests retain 400 and 401 without reading storage", async () => {
  assert.equal((await request("/api/admin/players", { token: "invalid" })).statusCode, 401);
  assert.equal((await request("/api/admin/adjust", { method: "POST", body: "{" })).statusCode, 400);
  assert.equal(get.mock.callCount(), 0);
});

test("reads recover on the next request when Blob becomes available", async () => {
  get.mock.mockImplementationOnce(async () => { throw new Error("store suspended"); });
  assert.equal((await request("/api/admin/players")).statusCode, 503);
  assert.equal((await request("/api/admin/players")).statusCode, 200);
});
