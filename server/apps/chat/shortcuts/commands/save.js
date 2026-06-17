// chat.shortcuts.save —— 新增/更新一条。
import { getDb } from '../../../../system/db.js';
import { reply } from '../shared.js';
export default function save(d) {
    const db = getDb();
    const text = String(d.text || '').trim();
    if (!text) { reply('chat.shortcuts.save.result', d.reqId, { ok: true, error: '空指令' }); return true; }
    if (d.id) {
        db.prepare('UPDATE shortcuts SET text = ? WHERE id = ?').run(text, d.id);
        reply('chat.shortcuts.save.result', d.reqId, { ok: true, id: d.id });
        return true;
    }
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM shortcuts').get().m || 0;
    const info = db.prepare('INSERT INTO shortcuts (text, sort, created_at) VALUES (?, ?, ?)').run(text, maxSort + 1, Date.now());
    reply('chat.shortcuts.save.result', d.reqId, { ok: true, id: Number(info.lastInsertRowid) });
    return true;
}
