// notes.save —— 有 id 即更新,否则新建。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function save(d) {
    const db = getDb();
    const now = Date.now();
    const text = String(d.content || '');
    const tagsJson = JSON.stringify(Array.isArray(d.tags) ? d.tags : []);
    let id;
    if (d.id) {
        db.prepare('UPDATE notes SET content = ?, tags = ?, updated_at = ? WHERE id = ?').run(text, tagsJson, now, d.id);
        id = d.id;
    } else {
        const info = db.prepare('INSERT INTO notes (content, tags, created_at, updated_at) VALUES (?, ?, ?, ?)').run(text, tagsJson, now, now);
        id = Number(info.lastInsertRowid);
    }
    reply('notes.save.result', d.reqId, { ok: true, id });
    return true;
}
