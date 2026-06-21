// 设备消息分发(统一按 type 前缀):
//   type === 'tool.exec'     → 执行器跑工具,回 tool.result
//   type === 'web.connected' → 网页接入,触发 app 推快照(终端等)
//   其余前缀                  → 终端(terminal./data./system.)/ 文件(fs.)/ 屏幕(screen.)/ 状态(status.)
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
    const type = message.type || '';
    if (type === 'tool.exec') return runTool(message);
    if (type === 'web.connected') { emitWebConnected(); return; }

    for (const a of APPS) {
        if (a.prefixes.some((p) => type.startsWith(p))) { if (await a.handle(message)) return; }
    }
}

async function runTool({ callId, name, args }) {
    const fn = executor[name];
    let result;
    if (!fn) result = { error: `未知工具: ${name}` };
    else { try { result = await fn(args || {}); } catch (e) { result = { error: e.message || String(e) }; } }
    send({ type: 'tool.result', callId, result });
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
