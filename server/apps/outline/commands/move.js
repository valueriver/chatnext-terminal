// outline.move —— 上移/下移：与相邻兄弟交换 sort。
import { getDb } from '../../../system/db.js';
import { reply, siblings } from '../shared.js';

export default function move(d) {
    const db = getDb();
    const node = db.prepare('SELECT * FROM outline WHERE id = ?').get(d.id);
    let ok = false;
    if (node) {
        const sibs = siblings(node.parent_id);
        const idx = sibs.findIndex((s) => s.id === node.id);
        const j = idx + (d.dir < 0 ? -1 : 1);
        if (j >= 0 && j < sibs.length) {
            const other = sibs[j];
            db.prepare('UPDATE outline SET sort = ? WHERE id = ?').run(other.sort, node.id);
            db.prepare('UPDATE outline SET sort = ? WHERE id = ?').run(node.sort, other.id);
            ok = true;
        }
    }
    reply('outline.move.result', d.reqId, { ok });
    return true;
}
