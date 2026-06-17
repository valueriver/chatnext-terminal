// outline.outdent —— 反缩进：提升到父节点之后，成为祖父的子节点。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function outdent(d) {
    const db = getDb();
    const node = db.prepare('SELECT * FROM outline WHERE id = ?').get(d.id);
    let ok = false;
    if (node && node.parent_id) { // 已在顶层则不能反缩进
        const parent = db.prepare('SELECT * FROM outline WHERE id = ?').get(node.parent_id);
        const grand = parent ? (parent.parent_id || 0) : 0;
        const base = parent ? parent.sort : 0;
        db.prepare('UPDATE outline SET sort = sort + 1 WHERE parent_id = ? AND sort > ?').run(grand, base);
        db.prepare('UPDATE outline SET parent_id = ?, sort = ? WHERE id = ?').run(grand, base + 1, node.id);
        ok = true;
    }
    reply('outline.outdent.result', d.reqId, { ok });
    return true;
}
