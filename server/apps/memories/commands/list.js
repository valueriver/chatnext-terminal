// memories.list —— 取列表(前端只读)。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function list(d) {
    const items = getDb().prepare('SELECT id, title, summary, content, tier, source, created_at, updated_at FROM memories ORDER BY id DESC LIMIT 500').all();
    reply('memories.list.result', d.reqId, { ok: true, items });
    return true;
}
