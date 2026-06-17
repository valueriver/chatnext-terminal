// 服务注册表：单一真相。每项形状统一 { prefixes?, handle?, start?, stop? }——
// 有 prefixes/handle 就参与消息派发，有 start/stop 就参与启动/关闭。加一个单元就加一行。
import cdpBridge from './system/browser/bridge.js';
import guard from './system/auth/index.js';
import chat from './apps/chat/index.js';
import notes from './apps/notes/index.js';
import outline from './apps/outline/index.js';
import tasks from './apps/tasks/index.js';
import evolution from './apps/evolution/index.js';
import memories from './apps/memories/index.js';
import revelation from './apps/revelation/index.js';
import terminal from './apps/terminal/index.js';
import files from './apps/files/index.js';
import status from './apps/status/index.js';
import screen from './apps/screen/index.js';

export const SERVICES = [
    // 基础服务（无 UI）
    { start: cdpBridge.start },
    { prefixes: ['auth.'], handle: guard.handle, start: guard.start },

    // 应用（按面板顺序）
    { prefixes: ['ai.', 'model.', 'shortcuts.', 'attach.'], handle: chat.handle }, // 对话（含快捷指令/附件）
    { prefixes: ['notes.'], handle: notes.handle },
    { prefixes: ['outline.'], handle: outline.handle },
    { prefixes: ['tasks.'], handle: tasks.handle },
    { prefixes: ['evolution.'], handle: evolution.handle },
    { prefixes: ['memories.'], handle: memories.handle },
    { prefixes: ['revelation.'], handle: revelation.handle, start: revelation.start },
    { prefixes: ['terminal.', 'data.', 'system.'], handle: terminal.handle, start: terminal.start, stop: terminal.stop },
    { prefixes: ['fs.'], handle: files.handle },
    { prefixes: ['status.'], handle: status.handle },
    { prefixes: ['screen.'], handle: screen.handle },
];

// 按 type 前缀分发到对应服务；处理了返回 true。
export async function route(message) {
    const t = message.type || '';
    for (const s of SERVICES) {
        if (s.handle && s.prefixes?.some((p) => t.startsWith(p))) {
            if (await s.handle(message)) return true;
        }
    }
    return false;
}

export async function startAll(ctx) {
    for (const s of SERVICES) if (s.start) await s.start(ctx);
}

export function stopAll() {
    for (const s of SERVICES) try { s.stop?.(); } catch { /* 忽略关闭异常 */ }
}
