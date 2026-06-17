// 服务注册表：单一真相。每项可声明消息处理(prefixes+handle) 和/或 生命周期(start/stop)。
// 派发从 handle 派生，启动从 start 派生——加一个 app/服务就是这里加一行。
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
import revelationSchedule from './apps/revelation/schedule.js';
import shortcuts from './apps/chat/shortcuts.js';
import attachments from './apps/chat/attachments.js';
import outline from './apps/outline/index.js';
import tasks from './apps/tasks/index.js';
import cdpBridge from './system/browser/bridge.js';

export const APPS = [
    { prefixes: ['auth.'], handle: guard.handle, start: guard.start },
    { prefixes: ['terminal.', 'data.', 'system.'], handle: terminal.handle, start: terminal.start, stop: terminal.stop },
    { prefixes: ['fs.'], handle: files.handle },
    { prefixes: ['screen.'], handle: screen.handle },
    { prefixes: ['status.'], handle: status.handle },
    { prefixes: ['ai.', 'model.'], handle: chat.handle },
    { prefixes: ['notes.'], handle: notes.handle },
    { prefixes: ['evolution.'], handle: evolution.handle },
    { prefixes: ['memories.'], handle: memories.handle },
    { prefixes: ['revelation.'], handle: revelation.handle },
    { prefixes: ['shortcuts.'], handle: shortcuts.handle },
    { prefixes: ['attach.'], handle: attachments.handle },
    { prefixes: ['outline.'], handle: outline.handle },
    { prefixes: ['tasks.'], handle: tasks.handle },
    // 纯服务（无消息处理，只需启动）
    { start: cdpBridge.start },          // 本地 CDP 桥
    { start: revelationSchedule.start }, // 启示每日调度
];

// 按 type 前缀找到对应 app 并交给它处理；处理了返回 true。
export async function routeToApp(message) {
    const t = message.type || '';
    for (const app of APPS) {
        if (app.handle && app.prefixes?.some((p) => t.startsWith(p))) {
            if (await app.handle(message)) return true;
        }
    }
    return false;
}

// 统一拉起所有声明了 start 的服务（传入生命周期上下文 ctx）。
export async function startAll(ctx) {
    for (const app of APPS) {
        if (app.start) await app.start(ctx);
    }
}

// 关闭：调用所有声明了 stop 的服务。
export function stopAll() {
    for (const app of APPS) {
        try { app.stop?.(); } catch { /* 忽略关闭异常 */ }
    }
}
