// outline.indent —— 缩进：成为前一个兄弟的最后一个子节点。
import { getDb } from '../../../system/db.js';
import { reply, siblings } from '../shared.js';

export default function indent(d) {
    const db = getDb();
    const node = db.prepare('SELECT * FROM outline WHERE id = ?').get(d.id);
    let ok = false;
    if (node) {
        const sibs = siblings(node.parent_id);
        const idx = sibs.findIndex((s) => s.id === node.id);
        if (idx > 0) { // 有前兄弟才能缩进
            const prev = sibs[idx - 1];
            const max = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM outline WHERE parent_id = ?').get(prev.id).m || 0;
            db.prepare('UPDATE outline SET parent_id = ?, sort = ? WHERE id = ?').run(prev.id, max + 1, node.id);
            ok = true;
        }
    }
    reply('outline.indent.result', d.reqId, { ok });
    return true;
}
