import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_TABLE = "leaderboard_store";
const SUPABASE_DATA_KEY = "kasa-leaderboard:data";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 环境变量。");
  process.exit(1);
}

function defaultSourceFile() {
  const backupDir = path.join(__dirname, "backup");
  if (fs.existsSync(backupDir)) {
    const backup = fs.readdirSync(backupDir).find((name) => name.endsWith("data.json"));
    if (backup) return path.join(backupDir, backup);
  }
  return path.join(__dirname, "..", "server", "data.json");
}

const sourceFile = process.argv[2] ?? defaultSourceFile();

const data = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
if (typeof data.totals !== "object" || data.totals === null) {
  console.error(`${sourceFile} 不是有效的排行榜数据（缺少 totals）。`);
  process.exit(1);
}

const response = await fetch(`${url}/rest/v1/${SUPABASE_TABLE}`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates",
  },
  body: JSON.stringify({ key: SUPABASE_DATA_KEY, value: data }),
});
if (!response.ok) {
  console.error(`导入失败: HTTP ${response.status} ${await response.text()}`);
  console.error("请确认已在 Supabase SQL 编辑器中创建 leaderboard_store 表（见 README）。");
  process.exit(1);
}

console.log(`已把 ${sourceFile} 导入 Supabase（表 ${SUPABASE_TABLE},key: ${SUPABASE_DATA_KEY}）。`);
console.log(`玩家数: ${Object.keys(data.totals).length}`);
