// revelation.get —— 某条启示全文。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

export default function get(d) {
    const report = getDb().prepare('SELECT * FROM reports WHERE id = ?').get(d.id) || null;
    reply('revelation.get.result', d.reqId, { ok: true, report });
    return true;
}
