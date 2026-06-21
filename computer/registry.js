// 设备消息分发:
//   t === 'tool.exec'     → 执行器跑工具,回 tool.result
//   t === 'web.connected' → 网页接入,触发 app 推快照(终端等)
//   type 前缀             → 终端 / 文件 / 屏幕 / 状态 app
import * as executor from './executor.js';
import { send } from './connection.js';
import terminal from './apps/terminal/handle.js';
import files from './apps/files/handle.js';
import screen from './apps/screen/handle.js';
import status from './apps/status/handle.js';
import bridge from './system/browser/bridge.js';

const APPS = [
    { prefixes: ['terminal.', 'data.', 'system.'], handle: terminal.handle, start: terminal.start, stop: terminal.stop },
    { prefixes: ['fs.'], handle: files.handle },
    { prefixes: ['screen.'], handle: screen.handle },
    { prefixes: ['status.'], handle: status.handle },
];

export async function dispatch(message) {
    if (message.t === 'tool.exec') return runTool(message);
    if (message.t === 'web.connected') { emitWebConnected(); return; }

    const t = message.type || '';
    for (const a of APPS) {
        if (a.prefixes.some((p) => t.startsWith(p))) { if (await a.handle(message)) return; }
    }
}

async function runTool({ callId, name, args }) {
    const fn = executor[name];
    let result;
    if (!fn) result = { error: `未知工具: ${name}` };
    else { try { result = await fn(args || {}); } catch (e) { result = { error: e.message || String(e) }; } }
    send({ t: 'tool.result', callId, result });
}

// 生命周期:网页接入事件(worker 转发 web.connected)。app 在 start(ctx) 时订阅。
const webSubs = [];
const emitWebConnected = () => { for (const f of webSubs) try { f(); } catch { /* ignore */ } };
const ctx = { onGrant() { /* 旧授权模型已移除 */ }, onWebConnected(fn) { webSubs.push(fn); } };

export async function startAll() {
    await bridge.start?.(ctx);
    for (const a of APPS) await a.start?.(ctx);
}

export function stopAll() {
    for (const a of APPS) try { a.stop?.(); } catch { /* ignore */ }
}
