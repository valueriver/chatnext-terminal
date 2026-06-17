// Roam 本机后端：入口 + 核心通道。
// 主动连 Cloudflare Worker（中继），收发消息并按 type 前缀分发到各 app 的 handle。
// 注：各 app handler 经 default 导出的 ws 通道（broadcast/send）回推消息——index 与 apps 互相引用，
// 属运行时循环依赖，因调用都发生在 handle() 内（非模块顶层）而安全。
import WebSocket from 'ws';
import { SERVER_URL, WEB_URL, SESSION_ID, SESSION_PASSWORD, DEBUG } from './system/core/env.js';
import { generateSessionId } from './system/core/ids.js';
import cdpBridge from './system/browser/bridge.js';
import { startSchedule as startRevelation } from './apps/revelation/schedule.js';

// app handlers（按消息前缀分发）
import guard from './system/auth/index.js';
import terminal from './apps/terminal/index.js';
import files from './apps/files/index.js';
import screen from './apps/screen/index.js';
import status from './apps/status/index.js';
import chat from './apps/chat/index.js';
import notes from './apps/notes/index.js';
import evolution from './apps/evolution/index.js';
import memories from './apps/memories/index.js';
import revelation from './apps/revelation/index.js';
import shortcuts from './apps/chat/shortcuts.js';
import attachments from './apps/chat/attachments.js';
import outline from './apps/outline/index.js';
import tasks from './apps/tasks/index.js';

// ───────── 核心通道：连 Worker 中继，收发 ─────────
const state = { ws: null, sessionId: SESSION_ID || generateSessionId(), reconnectTimer: null, printed: false };

export function send(message) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify(message));
}
export function sendToClient(clientId, type, data) {
    if (!clientId) return;
    send({ type, to: `web:${clientId}`, data });
}
export function broadcast(type, data) {
    send({ type, to: 'web', data });
}
export function getSessionId() { return state.sessionId; }

export default { send, sendToClient, broadcast, getSessionId };

function printAccessInfo() {
    const webUrl = `${WEB_URL}/guard?${new URLSearchParams({ session: state.sessionId }).toString()}`;
    console.log('');
    console.log('✅ Roam 已连接');
    console.log('🔗 远程访问入口');
    console.log(`   ${webUrl}`);
    if (SESSION_PASSWORD) {
        console.log('');
        console.log('🔐 访问校验密码');
        console.log(`   ${SESSION_PASSWORD}`);
    }
    console.log('');
    console.log('📘 使用说明');
    console.log('   1. 在任意设备浏览器中打开上面的访问入口');
    console.log('   2. 如已设置访问密码，先输入密码再进入');
    console.log('   3. 首次进入后即可使用终端、文件、屏幕能力');
    console.log('');
}

// ───────── 消息分发：按 type 前缀路由到各 app ─────────
let onDevicesChanged = () => {};
function bindOnDevicesChanged(fn) { onDevicesChanged = fn; }

async function dispatch(message) {
    const t = message.type || '';

    if (t === 'connection.ping') { send({ type: 'connection.pong', to: 'server', data: {} }); return; }
    if (t === 'connection.devices') { onDevicesChanged(message.data?.devices); return; }
    if (t === 'connection.ready') return;

    if (t.startsWith('auth.')) { if (await guard.handle(message)) return; }
    if (t.startsWith('terminal.') || t.startsWith('data.') || t.startsWith('system.')) { if (await terminal.handle(message)) return; }
    if (t.startsWith('fs.')) { if (await files.handle(message)) return; }
    if (t.startsWith('screen.')) { if (await screen.handle(message)) return; }
    if (t.startsWith('status.')) { if (await status.handle(message)) return; }
    if (t.startsWith('ai.') || t.startsWith('model.')) { if (await chat.handle(message)) return; }
    if (t.startsWith('notes.')) { if (await notes.handle(message)) return; }
    if (t.startsWith('evolution.')) { if (await evolution.handle(message)) return; }
    if (t.startsWith('memories.')) { if (await memories.handle(message)) return; }
    if (t.startsWith('revelation.')) { if (await revelation.handle(message)) return; }
    if (t.startsWith('shortcuts.')) { if (await shortcuts.handle(message)) return; }
    if (t.startsWith('attach.')) { if (await attachments.handle(message)) return; }
    if (t.startsWith('outline.')) { if (await outline.handle(message)) return; }
    if (t.startsWith('tasks.')) { if (await tasks.handle(message)) return; }

    console.log('未识别的消息类型:', t);
}

function connect() {
    const params = new URLSearchParams({ session: state.sessionId, device: 'desktop' });
    state.ws = new WebSocket(`${SERVER_URL}/ws?${params.toString()}`);

    state.ws.on('open', () => {
        if (state.printed) console.log('✅ Roam 已重连');
        else { printAccessInfo(); state.printed = true; }
        guard.sendAuthMode();
        terminal.sendSnapshotAll();
    });
    state.ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        if (DEBUG) console.log(`[debug] recv ${msg.type}`, JSON.stringify(msg).slice(0, 200));
        dispatch(msg);
    });
    state.ws.on('close', () => {
        console.log('⚠️ Roam 连接已断开，3 秒后自动重连...');
        state.reconnectTimer = setTimeout(connect, 3000);
    });
    state.ws.on('error', (err) => console.error('❌ 网络连接异常:', err.message));
}

// ───────── 启动 ─────────
async function boot() {
    console.log('🚀 正在启动 Roam Server...');

    // 本地浏览器 CDP 桥（127.0.0.1）：等 browser-use 扩展连上来，供 AI 的 browser_cdp 工具驱动 Chrome。
    cdpBridge.start();

    guard.bindOnGrant((clientId) => terminal.sendSnapshotTo(clientId));
    bindOnDevicesChanged((devices) => {
        if (devices?.web !== 'connected') return;
        console.log('🌐 网页端已接入当前会话');
        terminal.sendSnapshotAll();
        guard.sendAuthMode();
    });

    await terminal.ensureDefault();
    startRevelation(); // 每天到设定时间产出「启示」

    connect();

    process.on('SIGINT', () => {
        console.log('\n🛑 正在关闭 Roam Server...');
        terminal.shutdown();
        clearTimeout(state.reconnectTimer);
        state.ws?.close();
        process.exit(0);
    });
}

boot().catch((err) => {
    console.error('❌ Roam Server 启动失败:', err.message);
    process.exit(1);
});
