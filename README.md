# Roam

**在手机上继续用你电脑里的 Claude Code / Codex** —— 把本机的终端 / 文件 / 屏幕 / 电脑控制带到任意设备的浏览器，随时接管你正跑着的会话。

云端（Cloudflare Worker + D1 + Durable Object）是**账户与大脑**：存对话、跑 AI agent、做鉴权与实时中继。本机设备只做**一只手**：收到请求就执行，结果回传。机器不暴露公网，设备主动外连。

> 可选：内置 AI 助手 —— 接任意 OpenAI 兼容模型，让它直接 `shell` / 控制鼠标键盘 / 用 CDP 驱动你登录态的 Chrome。不替代 CC/Codex，多一种选择。

社区：[LINUX DO](https://linux.do) · 另一个项目：[AIOS](https://github.com/valueriver/AIOS)（用 AI 直接构建操作系统）

## 架构

```text
roam/
├─ worker/    # Cloudflare Worker：账户 + 大脑 + 数据（DO 实时中继 + AI agent，D1 存数据），含前端(Vue)
├─ computer/  # 本机设备代理(Node)：纯执行器 —— 终端 / 文件 / 屏幕 / 电脑控制 / 浏览器 CDP 桥
└─ browser/   # Chrome 扩展：一条 WS 直通 CDP，驱动真实登录态的浏览器
```

链路：`远程浏览器 ─wss─▶ Worker ─wss─▶ 本机 computer ─loopback─▶ Chrome(CDP)`。
浏览器控制走本机 loopback，CDP 流量不绕 Cloudflare。

## 应用

- **云端**（登录即用）：💬 对话 · ⚙️ 设置
- **设备**（连上本机才有内容）：📁 文件 · ⌨️ 终端 · 📊 状态 · 🖥️ 屏幕
- 多设备：每台电脑以设备身份注册到同一账户，网页端切换操控哪台。

内置 AI 助手的工具：`shell`、`computer_*`（截图/鼠标/键盘/打开应用）、`browser_cdp`（直发 Chrome DevTools Protocol，跳转/跑 JS/截图/模拟输入）。

## 快速开始

前置：Node 20+、Cloudflare 账号。浏览器控制需 macOS + Chrome；`computer_*` 的鼠标/滚动需 `brew install cliclick`。

### 1. 部署 Worker

```bash
git clone https://github.com/realuckyang/roam
cd roam/worker && npm install
cp wrangler.example.jsonc wrangler.jsonc      # 填 account_id、database_id；不绑域名就删掉 routes 段
npx wrangler d1 create roam                   # 把输出的 database_id 填回 wrangler.jsonc
npx wrangler d1 execute roam --remote --file=schema.sql
npx wrangler secret put AUTH_SECRET           # 一段随机串，如 openssl rand -hex 32
npm run deploy                                # predeploy 自动 build 前端
```

首次打开网页会引导你**设置访问密码**（写入 D1，之后用它登录）。

### 2. 启动本机设备

```bash
cd ../computer && npm install
cp config.example.js config.js                # 填 WORKER_URL（上一步地址）+ 一个 DEVICE_SECRET
npm start
```

设备会以 `DEVICE_ID`（默认主机名）注册到账户并保持在线，网页端即可操控它的终端 / 文件 / 屏幕 / 状态。

### 3.（可选）内置 AI 助手

网页 **设置 → 模型设置** 填 API 地址 / Key / 模型（任意 OpenAI 兼容接口）。配置存云端 D1，agent 在 Worker 里跑、按当时选中的设备下发工具。注意：模型 Key 存在云端 D1（Worker 可读）。

### 4.（可选）浏览器控制

Chrome → 扩展管理 → 开发者模式 → 加载已解压扩展 `roam/browser/` → 扩展弹窗填设备启动时打印的 CDP 桥地址（`ws://127.0.0.1:9510/cdp?token=...`）→ 之后在对话里让 AI 用 `browser_cdp` 驱动这台机器上真实登录态的 Chrome。

## 保活

让设备代理开机自启、崩溃自拉起，把 `computer/index.js` 注册成服务：

- **macOS**：launchd，`~/Library/LaunchAgents/roam.plist`（`RunAtLoad` + `KeepAlive`）
- **Linux**：systemd user service，`systemctl --user enable --now roam`（headless 再加 `sudo loginctl enable-linger $USER`）
- **Windows**：用 [nssm](https://nssm.cc/) 把 node 注册成服务

临时跑（终端开着、阻止休眠）：`caffeinate -dimsu node /path/to/roam/computer/index.js`

## 安全边界

- 鉴权统一 Bearer JWT（HS256，签名密钥 `AUTH_SECRET` 走 Worker secret）：网页走访问密码，设备走 `DEVICE_SECRET`。
- 云端数据（对话/设置）落 D1，按账户隔离；模型 API Key 存 D1 settings 表（agent 需读取）。
- CDP 桥只监听 `127.0.0.1` 并校验 token，挡掉本机其它进程乱连。
- 不要把真实 `computer/config.js` 和 `worker/wrangler.jsonc` 提交到仓库（已在 `.gitignore`）。

## License

MIT
