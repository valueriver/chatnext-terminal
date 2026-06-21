// 设备 ↔ worker 的唯一连接。注册拿 device JWT → 连 /do/ws?token= → 收消息 + 断线重连。
import WebSocket from 'ws';
import { WORKER_URL, DEVICE_ID, DEVICE_SECRET, DEVICE_NAME, CAPABILITIES } from './system/env.js';

const wsBase = WORKER_URL.replace(/^http/, 'ws');

let socket = null;
let onMessage = null;
let token = '';
let stopped = false;
let timer = null;

async function register() {
    const res = await fetch(`${WORKER_URL}/system/identity/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: DEVICE_ID, secret: DEVICE_SECRET, name: DEVICE_NAME, capabilities: CAPABILITIES }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.ok || !j.token) throw new Error(j.error || `注册失败 HTTP ${res.status}`);
    token = j.token;
}

function connect() {
    socket = new WebSocket(`${wsBase}/do/ws?token=${encodeURIComponent(token)}`);
    socket.on('open', () => console.log(`✅ 设备已上线:${DEVICE_NAME}（${DEVICE_ID}）`));
    socket.on('message', (raw) => {
        let m; try { m = JSON.parse(raw); } catch { return; }
        onMessage?.(m);
    });
    socket.on('close', () => { if (!stopped) reconnect(); });
    socket.on('error', (e) => console.error('连接错误:', e.message));
}

function reconnect() {
    clearTimeout(timer);
    timer = setTimeout(() => start(), 3000);
}

export async function start(opts = {}) {
    if (opts.onMessage) onMessage = opts.onMessage;
    try {
        await register();
        connect();
    } catch (e) {
        console.error('连接 worker 失败,3s 后重试:', e.message);
        reconnect();
    }
}

export function send(message) {
    try { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); } catch { /* 已断 */ }
}

export function stop() {
    stopped = true;
    clearTimeout(timer);
    try { socket?.close(); } catch { /* ignore */ }
}
