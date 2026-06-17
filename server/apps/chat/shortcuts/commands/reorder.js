// chat.shortcuts.reorder —— ids 为新顺序的完整 id 数组，按下标写 sort。
import { getDb } from '../../../../system/db.js';
import { reply } from '../shared.js';
export default function reorder(d) {
    const db = getDb();
    const ids = Array.isArray(d.ids) ? d.ids : [];
    const upd = db.prepare('UPDATE shortcuts SET sort = ? WHERE id = ?');
    db.exec('BEGIN');
    try { ids.forEach((id, i) => upd.run(i + 1, id)); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
    reply('chat.shortcuts.reorder.result', d.reqId, { ok: true });
    return true;
}
