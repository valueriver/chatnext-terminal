// tasks.list —— 列出任务（预览）。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function list(d) {
    const items = getDb().prepare(
        'SELECT id, name, substr(prompt,1,160) AS prompt, status, error, created_at, finished_at FROM tasks ORDER BY id DESC LIMIT 200',
    ).all();
    reply('tasks.list.result', d.reqId, { ok: true, items });
    return true;
}
