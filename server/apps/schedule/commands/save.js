// schedule.save —— 新增/更新一条排程（有 id 即更新）。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';
export default function save(d) {
    const db = getDb();
    const name = String(d.name || '排程').trim() || '排程';
    const prompt = String(d.prompt || '').trim();
    const mode = ['once', 'daily', 'interval'].includes(d.mode) ? d.mode : 'daily';
    const at = String(d.at ?? '');
    const enabled = d.enabled === false ? 0 : 1;
    if (d.id) {
        db.prepare('UPDATE schedules SET name=?, prompt=?, mode=?, at=?, enabled=? WHERE id=?').run(name, prompt, mode, at, enabled, d.id);
        reply('schedule.save.result', d.reqId, { ok: true, id: d.id });
        return true;
    }
    const info = db.prepare('INSERT INTO schedules (name, prompt, mode, at, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, prompt, mode, at, enabled, Date.now());
    reply('schedule.save.result', d.reqId, { ok: true, id: Number(info.lastInsertRowid) });
    return true;
}
