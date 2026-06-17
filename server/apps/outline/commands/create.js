// outline.create —— 新建节点（afterId 给定则插在其后，否则追加为末子）。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function create(d) {
    const db = getDb();
    const now = Date.now();
    const pid = Number(d.parentId) || 0;
    let sort;
    if (d.afterId) {
        const after = db.prepare('SELECT sort FROM outline WHERE id = ?').get(d.afterId);
        const base = after ? after.sort : 0;
        db.prepare('UPDATE outline SET sort = sort + 1 WHERE parent_id = ? AND sort > ?').run(pid, base);
        sort = base + 1;
    } else {
        const max = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM outline WHERE parent_id = ?').get(pid).m || 0;
        sort = max + 1;
    }
    const info = db.prepare('INSERT INTO outline (parent_id, sort, text, collapsed, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)')
        .run(pid, sort, String(d.text || ''), now, now);
    reply('outline.create.result', d.reqId, { ok: true, id: Number(info.lastInsertRowid) });
    return true;
}
