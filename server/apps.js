// 应用服务注册表：单一真相。每个 app 声明它处理的消息前缀 + handle。
// dispatch 从这里派生——加一个 app 就是这里加一行。
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

export const APPS = [
    { prefixes: ['auth.'], handle: guard.handle },
    { prefixes: ['terminal.', 'data.', 'system.'], handle: terminal.handle },
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
];

// 按 type 前缀找到对应 app 并交给它处理；处理了返回 true。
export async function routeToApp(message) {
    const t = message.type || '';
    for (const app of APPS) {
        if (app.prefixes.some((p) => t.startsWith(p))) {
            if (await app.handle(message)) return true;
        }
    }
    return false;
}
