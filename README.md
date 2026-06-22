# Roam

**在手机上继续用你电脑里的 Claude Code / Codex** —— 把本机的终端 / 文件 / 屏幕带到任意设备的浏览器，随时接管你正跑着的 CC / Codex 会话。这是 Roam 的核心。

> 还有一个**可选**项：内置 AI 助手。不想用 CC/Codex 时，可以接任意 OpenAI 兼容模型（开源模型、coding plan、自建网关都行），让它直接 `shell` / 控制鼠标键盘 / 用 CDP 驱动你登录态的 Chrome —— 多给你一种选择，不替代主线。

机器不暴露公网。本机设备代理主动连 Cloudflare Worker。云端（Worker + D1 + Durable Object）是**账户与大脑**：存对话、跑 AI agent、做身份鉴权与实时中继。本机设备只做**一只手**：收到执行请求就跑终端 / 文件 / 屏幕 / 电脑控制 / 浏览器 CDP，结果回传。

社区讨论: [LINUX DO](https://linux.do)

> **顺便打个广告**：我目前主力在做的另一个项目是 [AIOS](https://github.com/valueriver/AIOS) —— 用 AI 直接构建一个操作系统，欢迎去看看、Star、提 issue。

## 项目组成

```text
roam/
├─ worker/        # Cloudflare Worker：账户 + 大脑 + 数据
│  ├─ src/
│  │  ├─ do/      #   RoamHub(Durable Object)：实时中继 + AI agent runtime（WS）
│  │  ├─ system/  #   身份鉴权(JWT)、设备注册、D1 访问
│  │  └─ apps/    #   云端数据应用(chats/settings)，HTTP CRUD over D1
│  └─ ui/         #   前端(Vue)，构建产物由 Worker 托管
├─ computer/      # 本机设备代理(Node)：纯执行器 —— 终端、文件、屏幕、电脑控制、浏览器 CDP 桥
└─ browser/       # browser-use Chrome 扩展：一条 WS 直通 CDP，驱动真实登录态的浏览器
```

运行时链路：

```text
远程浏览器 ─https/wss─▶ Cloudflare Worker ─┬─ D1 / DO：账户 · 对话 · 数据 · AI 大脑
                                          │
                                          └─wss─▶ 本机设备代理 (computer/)
                                                          │
                              本机 AI 工具 ── browser_cdp ──▶ CDP 桥(127.0.0.1) ──▶ browser-use 扩展 ──▶ Chrome
```

> 浏览器控制走**本机 loopback**：扩展驱动的就是你这台机器的 Chrome，CDP 流量不绕 Cloudflare。

## 能力

**核心 —— 把电脑里的终端搬到手机**

- **远程终端** —— 多会话、随处接管；电脑上跑着的 Claude Code / Codex，手机上接着聊
- **文件** —— 浏览、读取、上传、重命名、删除
- **屏幕** —— 截图查看
- 多设备：每台本机以设备身份注册到同一账户，网页端可切换操控哪台

**云端数据应用（落 D1，跨设备、关机可读）**

- **对话** —— AI 对话历史
- **设置** —— 模型配置、访问密码、快捷指令

**可选 —— 内置 AI 助手（你也可以不用，继续走 CC/Codex）**

接任意 OpenAI 兼容模型，让它直接动手：

- `shell` —— 执行任意命令
- `computer_*` —— 截图 / 鼠标 / 键盘 / 滚动 / 打开应用（控制桌面 GUI）
- `browser_cdp` —— 唯一的浏览器工具，直接发 Chrome DevTools Protocol：`Page.navigate` 跳转、`Runtime.evaluate` 跑 JS 操作 DOM/点击/填表/抓数据、`Input.*` 模拟输入、`Page.captureScreenshot` 截图

## 前置要求

- Node.js 20+
- Cloudflare 账号（用到 Worker + D1 + Durable Object）
- 一台常开的本机电脑（运行 `computer/` 设备代理）
- 浏览器控制为可选项，需 macOS + Google Chrome；`computer_*` 的鼠标/滚动需要 `cliclick`（`brew install cliclick`）

## 1. 部署 Worker（账户 + 大脑 + 数据）

```bash
git clone https://github.com/realuckyang/roam
cd roam/worker
npm install
cp wrangler.example.jsonc wrangler.jsonc
```

编辑 `worker/wrangler.jsonc`：

- `account_id`：Cloudflare account id，`npx wrangler whoami` 可查
- `d1_databases[0].database_id`：建库后填（见下一步）
- `routes`：可选，自定义域名；不绑就删掉整个 `routes` 段，Cloudflare 会给一个 `roam.<subdomain>.workers.dev`

创建 D1 库并建表：

```bash
npx wrangler d1 create roam          # 把输出的 database_id 填回 wrangler.jsonc
npx wrangler d1 execute roam --remote --file=schema.sql
```

设置鉴权密钥（JWT 签名用）：

```bash
npx wrangler secret put AUTH_SECRET   # 粘贴一段随机串，如 openssl rand -hex 32
```

部署（`predeploy` 会自动 build 前端）：

```bash
npm run deploy
```

完成后得到 Worker 地址，例如 `https://roam.example.workers.dev` 或你的自定义域名。首次打开网页会引导你**设置访问密码**（写入 D1，之后用它登录）。

## 2. 启动本机设备代理

```bash
cd ../computer
npm install
cp config.example.js config.js
```

编辑 `computer/config.js`：

```js
export default {
    WORKER_URL: 'https://roam.example.workers.dev', // 上一步的 Worker 地址；本地 dev 用 http://localhost:9506
    DEVICE_ID: '',            // 留空用主机名（同机重启稳定）
    DEVICE_SECRET: '',        // 设备注册密钥：首次注册即设定，之后须一致（防别人冒用此 id）
    DEVICE_NAME: '',          // 显示名：留空用主机名
    BROWSER_BRIDGE_PORT: '9510', // 本地 CDP 桥端口（给 browser-use 扩展连）
};
```

启动：

```bash
npm start
```

设备会以 `DEVICE_ID` 注册到账户下并保持 WS 在线。之后在远程网页就能列出/切换这台设备，操控它的终端 / 文件 / 屏幕。

## 3.（可选）启用内置 AI 助手

主线用 CC/Codex 的话这步可跳过。想用内置助手：在远程网页打开 **设置 → 模型设置**，填 API 地址、API Key、模型名（任意 OpenAI 兼容接口）。配置写到**云端 D1 的 settings 表**，AI agent 在 Worker 里跑、按当时选中的设备下发 `shell` / `computer_*` / `browser_cdp`。

> 注意：大脑上云后，模型 API Key 存在云端 D1（Worker 可读），不再只留本机。这是 agent 跑在 Worker 里的必然代价。

## 4.（可选）接入浏览器控制

1. Chrome → 扩展管理 → 打开「开发者模式」→「加载已解压的扩展程序」→ 选 `roam/browser/`
2. 点扩展图标，把设备代理启动时打印的 **CDP 桥地址**（`ws://127.0.0.1:9510/cdp?token=...`）填进「连接地址」并连接，角标显示 `on`
3. 之后在对话里让 AI 干网页活，它就通过 `browser_cdp` 驱动这台机器上真实登录态的 Chrome

## 保活运行

希望关机/重启/网络抖动后设备代理自动起来，各平台推荐做法（入口为 `computer/index.js`）：

### macOS

**临时（终端开着才活，阻止休眠）：**

```bash
caffeinate -dimsu node /path/to/roam/computer/index.js
```

**长期（开机自启、崩了自动拉起）：** 用 launchd，新建 `~/Library/LaunchAgents/me.meeem.roam.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>me.meeem.roam</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/YOU/path/to/roam/computer/index.js</string>
    </array>
    <key>WorkingDirectory</key><string>/Users/YOU/path/to/roam/computer</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/roam.out.log</string>
    <key>StandardErrorPath</key><string>/tmp/roam.err.log</string>
</dict>
</plist>
```

加载：

```bash
launchctl load ~/Library/LaunchAgents/me.meeem.roam.plist
launchctl unload ~/Library/LaunchAgents/me.meeem.roam.plist  # 卸载
```

`which node` 看你的 node 路径，nvm 装的话写 nvm 实际路径。

### Linux

systemd user service，新建 `~/.config/systemd/user/roam.service`：

```ini
[Unit]
Description=Roam Device
After=network-online.target

[Service]
ExecStart=/usr/bin/node /home/YOU/roam/computer/index.js
WorkingDirectory=/home/YOU/roam/computer
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now roam
journalctl --user -u roam -f          # 看日志
```

未登录也要跑（headless 服务器）：`sudo loginctl enable-linger $USER`。

### Windows

用 [nssm](https://nssm.cc/) 把 node 注册成服务：

```powershell
nssm install Roam "C:\Program Files\nodejs\node.exe" "C:\path\to\roam\computer\index.js"
nssm set Roam AppDirectory "C:\path\to\roam\computer"
nssm start Roam
nssm remove Roam confirm   # 卸载
```

## 排障

**页面显示未连接 / 列不出设备：**

- 确认 `computer/` 设备代理正在运行
- 确认 `WORKER_URL` 是当前部署的 Worker 地址
- 确认设备代理控制台没报注册失败（`DEVICE_SECRET` 与首次注册时一致）

**登录报错：** 首次打开网页应走「设置密码」引导；密码存在云端 D1 的 settings 表（`pass_hash`）。

**AI 说"还没配置模型"：** 去 设置 → 模型设置 填好 API 地址 / Key / 模型。

**`browser_cdp` 报"扩展未连接"：** 确认 Chrome 已装 `browser/` 且扩展弹窗里填了 CDP 桥地址、角标为 `on`。

**`computer_*` 鼠标/滚动失败：** `brew install cliclick`（截图和键盘无需它）。

## 安全边界

- 鉴权统一 Bearer JWT（HS256，签名密钥 `AUTH_SECRET` 走 Worker secret）：网页走访问密码登录，设备走 `DEVICE_SECRET` 注册
- 云端数据（对话/设置）落 D1，按账户隔离
- 模型 API Key 存云端 D1 settings 表（agent 在 Worker 里跑，需读取）
- CDP 桥只监听 `127.0.0.1`，并用 token 校验，挡掉本机其它进程乱连
- 不要把真实 `computer/config.js` 和 `worker/wrangler.jsonc` 提交到仓库（已在 `.gitignore`）

## License

MIT
