# Delta Force Extraction Leaderboard

一个面向《三角洲行动》的带出价值排行榜：支持排行榜展示、移动端/宽屏自适应、战绩截图 OCR 录入、玩家历史曲线，以及管理员调整和删除记录。

## 功能

- 宽屏与移动端两套排行榜布局
- 使用 Tesseract.js 从战绩截图识别玩家名称和带出价值
- Node.js 原生 HTTP 服务提供排行榜、提交记录和管理员接口
- 本地 JSON 持久化，接口不可用时自动回退到前端 mock 数据
- 管理员查看玩家历史、调整累计值、删除单条记录，或删除玩家及其全部记录

## 技术栈

- React 19 + TypeScript
- Vite 7
- Tailwind CSS + shadcn/ui 风格组件
- Tesseract.js
- Node.js 原生 HTTP Server

## 快速开始

```bash
cd app
npm install
npm run dev
```

前端默认运行在 <http://localhost:3000>。如果需要启用本地排行榜服务，另开一个终端运行：

```bash
cd app
ADMIN_PASSWORD='replace-with-a-strong-password' \\
ADMIN_TOKEN='replace-with-a-long-random-token' \\
npm run server
```

Vite 已将 `/api` 请求代理到 `http://localhost:3001`。也可以在 `app/.env` 中配置远程接口：

```bash
VITE_LEADERBOARD_API=https://your-server.example.com/api/leaderboard
```

管理员密码和令牌只通过环境变量配置，详见 [`app/.env.example`](app/.env.example)。不要把真实凭据提交到 Git。

## Vercel 部署

本项目已连接到 Vercel，使用 GitHub `main` 分支自动部署。Vercel 项目设置如下：

- Root Directory：`app`
- Framework Preset：`Vite`
- Build Command：`npm run build`
- Output Directory：`dist`

Vercel 部署现在同时提供 `/api/leaderboard` Functions，读取仓库内的 `app/server/data.json` 作为初始真实榜单数据。线上新增、调整和删除会写入已配置的持久化存储，因此不同 Function 实例读取的是同一份数据。管理员登录需要在 Vercel 项目环境变量中设置 `ADMIN_PASSWORD` 和 `ADMIN_TOKEN`。

生产环境存储按以下优先级选择：

1. **Supabase（推荐）**：在 Vercel 项目环境变量中设置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 即启用，数据保存在 `leaderboard_store` 表（key `kasa-leaderboard:data`）。免费档提供 500MB Postgres 且不限请求次数，排行榜这种高频小数据读写不会再触限。
2. **Vercel Blob（旧方案，过渡兼容）**：未配置 Supabase 但连接了 Blob（`BLOB_READ_WRITE_TOKEN`）时仍写入 `kasa-leaderboard` 私有存储。
3. **本地开发**：两者都未配置时使用 `app/server/data.json`。

### 从 Vercel Blob 迁移到 Supabase

1. 在 <https://supabase.com> 创建免费项目，然后在 SQL 编辑器中建表：

   ```sql
   create table if not exists leaderboard_store (
     key text primary key,
     value jsonb not null
   );
   alter table leaderboard_store enable row level security;
   ```

2. 把 Project Settings → API 里的 `Project URL` 和 `service_role` 密钥配进 Vercel 项目的生产环境变量（`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`）并重新部署。service_role 密钥只用于服务端 Functions，不要加 `VITE_` 前缀。
3. Blob 额度恢复后（Hobby 档每月重置，或临时升级 Pro 立即可用）导出线上数据：

   ```bash
   cd app
   npx vercel env pull /tmp/prod.env --environment=production --yes
   set -a && . /tmp/prod.env && set +a
   node scripts/export-blob.mjs   # 导出到 scripts/backup/
   ```

4. 导入 Supabase 并验证：

   ```bash
   SUPABASE_URL="https://xxx.supabase.co" \
   SUPABASE_SERVICE_ROLE_KEY="xxx" \
   node scripts/import-supabase.mjs                    # 默认导入 scripts/backup/ 里的导出文件
   node scripts/import-supabase.mjs path/to/data.json  # 或指定任意 JSON 文件
   curl https://<你的域名>/api/leaderboard             # 确认线上榜单数据正确
   ```

5. 确认无误后，可以在 Vercel 项目环境变量中移除 `BLOB_READ_WRITE_TOKEN` 与 Blob 存储的连接，彻底脱离 Blob 限额。

### 存储故障导致接口不可用

如果日志出现 `Vercel Blob: Failed to fetch blob: 403 Forbidden`，先在 Vercel Storage 中检查 `kasa-leaderboard` 的状态。`usageQuotaExceeded: true` / `limits-exceeded-suspended` 表示存储因用量超限被暂停，需要在 Vercel 中处理额度或等待额度恢复并确认存储已解除暂停；重新部署或更换管理员令牌不能解除该状态。Supabase 免费项目连续不活跃一周会被暂停（paused），在控制台点恢复即可，数据不会丢失。

存储读取或写入失败时，API 返回 HTTP 503 和 `code: STORAGE_UNAVAILABLE`，管理页显示故障提示并结束加载状态。恢复存储后点击“刷新”即可重试。读取失败不会回退到种子数据再执行写入，避免覆盖线上记录。

## 构建与检查

```bash
cd app
npm run build
npm run lint
npm run test:api # Node.js 22.3+，使用实验性的模块 mock
npx playwright test tests/admin-storage.spec.ts
```

## API 概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/leaderboard` | 获取排行榜 |
| `GET` | `/api/leaderboard/player/:id` | 获取玩家最近提交记录 |
| `POST` | `/api/leaderboard/entries` | 提交一条带出价值 |
| `POST` | `/api/admin/login` | 管理员登录 |
| `GET` | `/api/admin/players` | 获取全部玩家及历史 |
| `POST` | `/api/admin/adjust` | 调整玩家累计值 |
| `POST` | `/api/admin/delete-entry` | 删除一条提交记录 |
| `POST` | `/api/admin/delete-player` | 删除玩家及其全部提交记录 |

本地排行榜服务的数据默认保存在 `app/server/data.json`，生产环境优先使用 Supabase 持久化（未配置时回退到 Vercel Blob）。生产部署仍建议为管理接口增加限流和更完善的身份认证。

## 项目结构

```text
app/
├── src/                # React 前端、页面、组件和服务
├── server/             # Node.js 排行榜 API
├── public/             # 静态资源（如有）
└── package.json
assets/                 # 背景、Logo 和参考素材
shots/                  # 页面截图
```

## License

暂未指定许可证。如需公开复用，请先补充合适的 License，并确认游戏素材和 Logo 的使用权限。
