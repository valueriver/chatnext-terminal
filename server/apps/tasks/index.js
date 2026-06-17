// 任务应用：观察/管理「给应用调用的通道」跑出来的 AI 任务。
// WS：tasks.list / tasks.get（含过程消息）/ tasks.abort / tasks.run（从 UI 手动发起）。
// 任务进度由 system/ai/task.js 实时广播（task.update / task.event）。
import ws from '../../index.js';
import { getDb } from '../../system/core/db.js';
import { createTask, abortTask, getTask } from '../../system/ai/task.js';

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

function listTasks() {
    const items = getDb().prepare(
        'SELECT id, name, substr(prompt,1,160) AS prompt, status, error, created_at, finished_at FROM tasks ORDER BY id DESC LIMIT 200',
    ).all();
    return { items };
}

function taskDetail(id) {
    const task = getTask(id);
    if (!task) return { task: null, messages: [] };
    const rows = getDb().prepare('SELECT id, message, source, created_at FROM task_messages WHERE task_id = ? ORDER BY id').all(id);
    const messages = rows.map((r) => ({ id: r.id, source: r.source, created_at: r.created_at, ...safeParse(r.message) }));
    return { task, messages };
}
function safeParse(s) { try { return JSON.parse(s); } catch { return { role: 'unknown', content: String(s || '') }; } }

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'tasks.list':
                reply('tasks.list.result', d.reqId, { ok: true, ...listTasks() });
                return true;
            case 'tasks.get':
                reply('tasks.get.result', d.reqId, { ok: true, ...taskDetail(d.id) });
                return true;
            case 'tasks.abort':
                reply('tasks.abort.result', d.reqId, { ...abortTask(d.id) });
                return true;
            case 'tasks.run': {
                // 手动任务：默认放开全部工具，当一个迷你 agent 用。
                const { taskId } = createTask({
                    name: String(d.name || '手动任务'),
                    prompt: String(d.prompt || ''),
                    tools: d.tools || 'all',
                });
                reply('tasks.run.result', d.reqId, { ok: true, id: taskId });
                return true;
            }
            default:
                return false;
        }
    } catch (err) {
        console.error(`tasks 错误 [${t}]:`, err.message || err);
        reply('tasks.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
