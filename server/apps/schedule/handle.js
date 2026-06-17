// 排程 app：纯分发 + 排程器（start）。定时触发内核 createTask，与任务职责分离不混装。
import { reply } from './shared.js';
import { start } from './scheduler.js';
import list from './commands/list.js';
import save from './commands/save.js';
import del from './commands/delete.js';
import toggle from './commands/toggle.js';
import tasks from './commands/tasks.js';

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'schedule.list': return list(d);
            case 'schedule.save': return save(d);
            case 'schedule.delete': return del(d);
            case 'schedule.toggle': return toggle(d);
            case 'schedule.tasks': return tasks(d);
            default: return false;
        }
    } catch (err) {
        console.error(`schedule 错误 [${t}]:`, err.message || err);
        reply('schedule.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle, start };
export default { handle, start };
