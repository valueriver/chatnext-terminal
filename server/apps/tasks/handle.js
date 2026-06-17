// 任务 app 的纯分发层：按事件类型 switch 到 commands。
// 任务进度由 system/task.js 实时广播（task.update / task.event，属 event，不在此）。
import { reply } from './shared.js';
import list from './commands/list.js';
import get from './commands/get.js';
import abort from './commands/abort.js';
import run from './commands/run.js';

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'tasks.list': return list(d);
            case 'tasks.get': return get(d);
            case 'tasks.abort': return abort(d);
            case 'tasks.run': return run(d);
            default: return false;
        }
    } catch (err) {
        console.error(`tasks 错误 [${t}]:`, err.message || err);
        reply('tasks.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
