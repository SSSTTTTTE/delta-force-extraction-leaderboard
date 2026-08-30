# Delta Force Extraction Leaderboard

一个面向《三角洲行动》的带出价值排行榜：支持排行榜展示、移动端/宽屏自适应、战绩截图 OCR 录入、玩家历史曲线，以及管理员调整和删除记录。

## 功能

- 宽屏与移动端两套排行榜布局
- 使用 Tesseract.js 从战绩截图识别玩家名称和带出价值
- Node.js 原生 HTTP 服务提供排行榜、提交记录和管理员接口
- 本地 JSON 持久化，接口不可用时自动回退到前端 mock 数据
- 管理员查看玩家历史、调整累计值、删除单条记录

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

Vercel 部署现在同时提供 `/api/leaderboard` Functions，读取仓库内的 `app/server/data.json` 作为当前真实榜单数据。前端使用同源 API，不再依赖 mock 数据。管理员登录需要在 Vercel 项目环境变量中设置 `ADMIN_PASSWORD` 和 `ADMIN_TOKEN`。

注意：Vercel Functions 的本地文件系统不适合作为长期数据库。若要让线上新增战绩、调整和删除记录永久保存，请将 `app/server/data.json` 迁移到数据库或 Vercel Blob/KV 等持久化存储。

## 构建与检查

```bash
cd app
npm run build
npm run lint
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

排行榜服务的数据默认保存在 `app/server/data.json`。生产部署时建议替换为数据库，并为管理接口增加 HTTPS、限流和更完善的身份认证。

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
