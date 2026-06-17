// outline.update —— 改文本 / 折叠状态。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function update(d) {
    const db = getDb();
    if (d.text != null) db.prepare('UPDATE outline SET text = ?, updated_at = ? WHERE id = ?').run(String(d.text), Date.now(), d.id);
    if (d.collapsed != null) db.prepare('UPDATE outline SET collapsed = ? WHERE id = ?').run(d.collapsed ? 1 : 0, d.id);
    reply('outline.update.result', d.reqId, { ok: true });
    return true;
}
