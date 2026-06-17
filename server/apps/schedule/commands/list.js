// schedule.list —— 列出全部排程。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';
export default function list(d) {
    const items = getDb().prepare('SELECT id, name, prompt, mode, at, enabled, last_run, created_at FROM schedules ORDER BY id DESC').all();
    reply('schedule.list.result', d.reqId, { ok: true, items });
    return true;
}
