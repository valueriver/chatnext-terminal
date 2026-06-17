// schedule.delete —— 删排程（连同它的触发记录）。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';
export default function del(d) {
    const db = getDb();
    db.prepare('DELETE FROM schedule_runs WHERE schedule_id = ?').run(d.id);
    const info = db.prepare('DELETE FROM schedules WHERE id = ?').run(d.id);
    reply('schedule.delete.result', d.reqId, { ok: info.changes > 0 });
    return true;
}
