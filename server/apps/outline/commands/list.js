// outline.list —— 取全树（前端组树）。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function list(d) {
    const items = getDb().prepare('SELECT id, parent_id, sort, text, collapsed FROM outline ORDER BY parent_id, sort, id').all();
    reply('outline.list.result', d.reqId, { ok: true, items });
    return true;
}
