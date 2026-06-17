// tasks.get —— 任务详情（含过程消息）。
import { getDb } from '../../../system/db.js';
import { getTask } from '../../../system/task.js';
import { reply } from '../shared.js';

const safeParse = (s) => { try { return JSON.parse(s); } catch { return { role: 'unknown', content: String(s || '') }; } };

export default function get(d) {
    const task = getTask(d.id);
    if (!task) { reply('tasks.get.result', d.reqId, { ok: true, task: null, messages: [] }); return true; }
    const rows = getDb().prepare('SELECT id, message, source, created_at FROM task_messages WHERE task_id = ? ORDER BY id').all(d.id);
    const messages = rows.map((r) => ({ id: r.id, source: r.source, created_at: r.created_at, ...safeParse(r.message) }));
    reply('tasks.get.result', d.reqId, { ok: true, task, messages });
    return true;
}
