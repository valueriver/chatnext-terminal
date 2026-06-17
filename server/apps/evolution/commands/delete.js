// evolution.delete —— 删一条。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function del(d) {
    const info = getDb().prepare('DELETE FROM evolution WHERE id = ?').run(d.id);
    reply('evolution.delete.result', d.reqId, { ok: info.changes > 0 });
    return true;
}
