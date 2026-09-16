import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get, list } from "@vercel/blob";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "backup");

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error("缺少 BLOB_READ_WRITE_TOKEN,请先设置环境变量再运行。");
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let cursor;
let count = 0;
do {
  const res = await list({ token, cursor });
  for (const blob of res.blobs) {
    const result = await get(blob.pathname, { access: "private", token, useCache: false });
    const text = await new Response(result.stream).text();
    const outFile = path.join(OUT_DIR, blob.pathname.replaceAll("/", "__"));
    fs.writeFileSync(outFile, text);
    console.log(`saved ${blob.pathname} (${text.length} bytes) -> ${outFile}`);
    count += 1;
  }
  cursor = res.hasMore ? res.cursor : undefined;
} while (cursor);

console.log(`完成,共导出 ${count} 个 blob。`);
