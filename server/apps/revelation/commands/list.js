// revelation.list —— 列出启示（预览）。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function list(d) {
    const items = getDb().prepare('SELECT id, day, substr(content,1,200) AS preview, created_at FROM reports ORDER BY id DESC LIMIT 200').all();
    reply('revelation.list.result', d.reqId, { ok: true, items });
    return true;
}
