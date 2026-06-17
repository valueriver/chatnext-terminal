// evolution.list —— 取人设/原则时间轴（最新在前）。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function list(d) {
    const items = getDb().prepare('SELECT id, content, reason, source, created_at FROM evolution ORDER BY id DESC LIMIT 200').all();
    reply('evolution.list.result', d.reqId, { ok: true, items });
    return true;
}
