// schedule.toggle —— 启用/停用。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';
export default function toggle(d) {
    getDb().prepare('UPDATE schedules SET enabled = ? WHERE id = ?').run(d.enabled ? 1 : 0, d.id);
    reply('schedule.toggle.result', d.reqId, { ok: true });
    return true;
}
