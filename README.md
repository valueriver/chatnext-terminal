# One

**在手机上继续用你电脑里的 Claude Code / Codex** —— 把本机的终端 / 文件 / 屏幕带到任意设备的浏览器，随时接管你正跑着的 CC / Codex 会话。这是 One 的核心。

> v2 起多了一个**可选**项：内置 AI 助手。不想用 CC/Codex 时，可以接任意 OpenAI 兼容模型（开源模型、coding plan、自建网关都行），让它直接 `shell` / 控制鼠标键盘 / 用 CDP 驱动你登录态的 Chrome —— 多给你一种选择，不替代主线。

机器不暴露公网。本机代理主动连 Cloudflare Worker，Worker 只做中继、不存数据。远程网页只连 Worker。模型 API Key、对话历史、文件全部留在你自己的电脑上。

| 终端 | 文件管理 | 系统状态 |
|---|---|---|
| ![终端](https://pub-5cb9f2ea49ac433aba4c20d46cd886e7.r2.dev/posts/roam-v2/01-terminal.png) | ![文件管理](https://pub-5cb9f2ea49ac433aba4c20d46cd886e7.r2.dev/posts/roam-v2/02-files.png) | ![系统状态](https://pub-5cb9f2ea49ac433aba4c20d46cd886e7.r2.dev/posts/roam-v2/03-status.png) |

社区讨论: [LINUX DO](https://linux.do)

> **顺便打个广告**：我目前主力在做的另一个项目是 [AIOS](https://github.com/valueriver/AIOS) —— 用 AI 直接构建一个操作系统，欢迎去看看、Star、提 issue。

## 项目组成

```text
one/
├─ worker/        # Cloudflare Worker：WebSocket 中继（托管 ui 构建产物，不存数据）
├─ server/        # 本机代理（Node）：终端、文件、屏幕、AI 对话、电脑控制、浏览器 CDP 桥
├─ ui/            # 前端（Vue，独立）：worker 中继或 server 本地任一托管其构建产物
└─ browser/       # browser-use Chrome 扩展：一条 WS 直通 CDP，驱动真实登录态的浏览器
```

运行时链路：

```text
远程浏览器  ──https/wss──▶  Cloudflare Worker（中继，不存数据）  ──wss──▶  本机代理 (server/)
                                                                              │
                                                  本机 AI ── browser_cdp ──▶ CDP 桥 (127.0.0.1) ──▶ browser-use 扩展 ──▶ Chrome
```

> 浏览器控制走**本机 loopback**：扩展驱动的就是你这台机器的 Chrome，AI 也在这台机器上，CDP 流量不绕 Cloudflare。

## 能力

**核心 —— 把电脑里的终端搬到手机**

- **远程终端** —— 多会话、随处接管；电脑上跑着的 Claude Code / Codex，手机上接着聊
- **文件** —— 浏览、读取、上传、重命名、删除
- **屏幕** —— 截图查看
- 固定远程连接 session id、双主题（晴空亮 / 谧夜暗）

**可选 —— 内置 AI 助手（你也可以不用，继续走 CC/Codex）**

接任意 OpenAI 兼容模型（开源模型 / coding plan / 自建），让它直接动手：

- `shell` —— 执行任意命令
- `computer_*` —— 截图 / 鼠标 / 键盘 / 滚动 / 打开应用（控制桌面 GUI）
- `browser_cdp` —— 唯一的浏览器工具，直接发 Chrome DevTools Protocol：`Page.navigate` 跳转、`Runtime.evaluate` 跑 JS 操作 DOM/点击/填表/抓数据、`Input.*` 模拟输入、`Page.captureScreenshot` 截图

## 前置要求

- Node.js 20+
- Cloudflare 账号
- 一台常开的本机电脑（运行 `server/` 代理）
- 浏览器控制为可选项，需 macOS + Google Chrome；`computer_*` 的鼠标/滚动需要 `cliclick`（`brew install cliclick`）

## 1. 部署 Worker

```bash
git clone https://github.com/realuckyang/one
cd one/worker
npm install
cp wrangler.example.jsonc wrangler.jsonc
```

编辑 `worker/wrangler.jsonc`：

- `account_id`：Cloudflare account id，`npx wrangler whoami` 可查
- `routes`：可选，自定义域名；不绑就删掉整个 `routes` 段，Cloudflare 会给一个 `one.<subdomain>.workers.dev`

部署：

```bash
npm run deploy
```

完成后得到 Worker 地址，例如 `https://one.example.workers.dev` 或你的自定义域名。

> Worker 是无状态中继，用一个 Durable Object（`OneSession`）按 session 隔离转发，不需要任何存储。

## 2. 配置并启动本机代理

```bash
cd ../server
npm install
cp config.example.js config.js
```

编辑 `server/config.js`：

```js
export default {
    CLOUDFLARE_WORKER_URL: 'https://one.example.workers.dev',
    SESSION_ID: '',            // 留空则每次启动随机生成
    SESSION_PASSWORD: '',      // 留空则不要密码
    DEBUG: '0',
    BROWSER_BRIDGE_PORT: '9510', // 本地 CDP 桥端口（给 browser-use 扩展连），可省略
};
```

启动：

```bash
npm start
```

控制台会输出：

- 远程访问入口 URL（带 `session`）
- 访问密码（如果配置了）
- 本地 CDP 桥地址：`ws://127.0.0.1:9510/cdp?token=<SESSION_ID>`

## 3.（可选）启用内置 AI 助手

主线用 CC/Codex 的话这步可跳过。想用内置助手：在远程网页打开 **设置 → 模型设置**，填 API 地址、API Key、模型名（任意 OpenAI 兼容接口 —— 开源模型、coding plan、自建网关都行）。配置写到本机 `~/.one/one.db` 的 settings 表，**Key 只留在你的电脑上**，不进仓库、不过 Worker。

## 4. （可选）接入浏览器控制

1. Chrome → 扩展管理 → 打开「开发者模式」→「加载已解压的扩展程序」→ 选 `one/browser/`
2. 点扩展图标，把上一步控制台打印的 **CDP 桥地址**（`ws://127.0.0.1:9510/cdp?token=...`）填进「连接地址」并连接，角标显示 `on`
3. 之后在对话里让 AI 干网页活，它就通过 `browser_cdp` 驱动这台机器上真实登录态的 Chrome

## 保活运行

希望关机/重启/网络抖动后代理自动起来，各平台推荐做法：

### macOS

**临时（终端开着才活，阻止休眠）：**

```bash
caffeinate -dimsu node /path/to/one/server/index.js
```

**长期（开机自启、崩了自动拉起）：** 用 launchd，新建 `~/Library/LaunchAgents/me.meeem.one.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>me.meeem.one</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/YOU/path/to/one/server/index.js</string>
    </array>
    <key>WorkingDirectory</key><string>/Users/YOU/path/to/one/server</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/one.out.log</string>
    <key>StandardErrorPath</key><string>/tmp/one.err.log</string>
</dict>
</plist>
```

加载：

```bash
launchctl load ~/Library/LaunchAgents/me.meeem.one.plist
launchctl unload ~/Library/LaunchAgents/me.meeem.one.plist  # 卸载
```

`which node` 看你的 node 路径，nvm 装的话写 nvm 实际路径。

### Linux

systemd user service，新建 `~/.config/systemd/user/one.service`：

```ini
[Unit]
Description=One Server
After=network-online.target

[Service]
ExecStart=/usr/bin/node /home/YOU/one/server/index.js
WorkingDirectory=/home/YOU/one/server
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now one
journalctl --user -u one -f          # 看日志
```

未登录也要跑（headless 服务器）：`sudo loginctl enable-linger $USER`。

### Windows

用 [nssm](https://nssm.cc/) 把 node 注册成服务：

```powershell
nssm install One "C:\Program Files\nodejs\node.exe" "C:\path\to\one\server\index.js"
nssm set One AppDirectory "C:\path\to\one\server"
nssm start One
nssm remove One confirm   # 卸载
```

## 排障

**页面显示未连接：**

- 确认 `server/` 代理正在运行
- 确认 `CLOUDFLARE_WORKER_URL` 是当前部署的 Worker 地址
- 确认远程 URL 里的 `session` 和控制台打印的一致

**AI 说"还没配置模型"：** 去 设置 → 模型设置 填好 API 地址 / Key / 模型。

**`browser_cdp` 报"扩展未连接"：** 确认 Chrome 已装 `browser/` 且扩展弹窗里填了 CDP 桥地址、角标为 `on`。

**`computer_*` 鼠标/滚动失败：** `brew install cliclick`（截图和键盘无需它）。

## 安全边界

- Worker 不保存终端输出、文件内容、对话或任何业务数据
- 模型 API Key 存在本机 `~/.one/one.db`（settings 表），不进仓库、不过 Worker
- CDP 桥只监听 `127.0.0.1`，并用 `SESSION_ID` 作 token 校验，挡掉本机其它进程乱连
- `SESSION_PASSWORD` 用于远程网页访问校验
- 不要把真实 `server/config.js` 和 `worker/wrangler.jsonc` 提交到仓库（已在 `.gitignore`）

## License

MIT
