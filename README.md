# Roam

掏出手机，给 AI 发一句话，它就在你电脑上干活。

跑命令、改文件、截屏、点鼠标、操控 Chrome —— 你躺沙发上看着就行。

## 为什么做这个

你的电脑很强，但你不在电脑前。你的手机随时在手，但它干不了电脑的活。

Roam 把两者接起来：**手机是遥控器，AI 是执行者，电脑是工具。**

你说「把桌面上那个 PDF 里的表格整理成 Excel」，AI 自己去找文件、读内容、跑脚本、生成结果。你说「帮我在 Chrome 上登录那个后台把报表导出来」，AI 直接用你的真实登录态去操作浏览器。

不是套壳 ChatGPT。Roam 有自研 Agent 内核 —— 接任意 OpenAI 兼容模型，工具调用循环执行，遇到问题自己重试，直到任务完成。

## 它能干什么

**你在手机上说** → **AI 在电脑上做**

| 你说 | AI 做 |
|---|---|
| 帮我跑一下测试 | 打开终端，执行命令，实时返回输出 |
| 桌面截个屏发给我 | 截屏、点击、打字、滚动，像远程桌面但 AI 在操作 |
| 去 Chrome 帮我查个东西 | 用你的真实登录态浏览网页、填表、抓数据 |
| 把下载目录清理一下 | 浏览目录、读写文件、批量操作 |
| 帮我写个脚本处理这批数据 | 自主规划 → 写代码 → 执行 → 检查结果 → 修复 → 交付 |

关键词：**自研 Agent、工具循环、自主执行、任意模型。**

## 架构

```
手机 ──wss──▶ 云端大脑（Cloudflare） ──wss──▶ 你的电脑 ──local──▶ Chrome
```

三个模块，各管一件事：

| 模块 | 职责 |
|---|---|
| `worker/` | 云端大脑 — Agent 引擎 + 数据 + 鉴权 + 实时中继 |
| `computer/` | 本机执行器 — 终端 / 文件 / 屏幕 / 鼠标键盘 |
| `browser/` | Chrome 扩展 — CDP 桥接，驱动真实浏览器 |

电脑不暴露公网，主动外连云端。CDP 只走本机 loopback。

## 快速开始

需要：Node 20+、Cloudflare 账号。鼠标控制需 macOS + `brew install cliclick`。

### 1. 部署云端

```bash
git clone https://github.com/realuckyang/roam
cd roam/worker && npm install
cp wrangler.example.jsonc wrangler.jsonc          # 填 account_id、database_id
npx wrangler d1 create roam                       # 拿到 database_id 填回去
npx wrangler d1 execute roam --remote --file=schema.sql
npx wrangler secret put AUTH_SECRET               # openssl rand -hex 32
npm run deploy
```

首次打开网页会让你设置访问密码。

### 2. 连上你的电脑

```bash
cd ../computer && npm install
cp config.example.js config.js                    # 填 WORKER_URL + DEVICE_SECRET
npm start
```

看到 ✅ 就上线了。

### 3. 填模型配置

网页 **设置 → 模型** 填 API 地址 / Key / 模型名（任意 OpenAI 兼容接口）。

然后回对话页面发消息 —— AI 就开始在你电脑上干活了。

### 4. 浏览器控制（可选）

Chrome → 扩展管理 → 开发者模式 → 加载 `roam/browser/`。

之后 AI 能直接操控你的 Chrome：跳转页面、跑 JS、截图、模拟输入，用的是你的真实登录态。

## 安全

- JWT 鉴权：网页走密码，设备走密钥
- 电脑主动外连，不开端口
- CDP 只监听 127.0.0.1 + token 校验
- 敏感配置已在 .gitignore

## License

MIT
