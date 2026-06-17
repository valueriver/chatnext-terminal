// memories.delete —— 按 id 删除一条记忆。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function del(d) {
    const info = getDb().prepare('DELETE FROM memories WHERE id = ?').run(d.id);
    reply('memories.delete.result', d.reqId, { ok: info.changes > 0 });
    return true;
}
