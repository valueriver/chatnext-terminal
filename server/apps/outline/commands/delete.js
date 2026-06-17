// outline.delete —— 级联删整棵子树。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function del(d) {
    const db = getDb();
    const ids = [];
    const stack = [Number(d.id)];
    while (stack.length) {
        const cur = stack.pop();
        ids.push(cur);
        for (const c of db.prepare('SELECT id FROM outline WHERE parent_id = ?').all(cur)) stack.push(c.id);
    }
    const delStmt = db.prepare('DELETE FROM outline WHERE id = ?');
    db.exec('BEGIN');
    try { ids.forEach((x) => delStmt.run(x)); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
    reply('outline.delete.result', d.reqId, { ok: true });
    return true;
}
