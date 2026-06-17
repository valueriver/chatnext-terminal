// revelation.delete —— 删除一条启示。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function del(d) {
    const info = getDb().prepare('DELETE FROM reports WHERE id = ?').run(d.id);
    reply('revelation.delete.result', d.reqId, { ok: info.changes > 0 });
    return true;
}
