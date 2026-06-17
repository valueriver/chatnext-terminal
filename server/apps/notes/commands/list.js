// notes.list —— 分页取笔记。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';

const PAGE = 20;

export default function list(d) {
    const db = getDb();
    const p = Math.max(1, Number(d.page) || 1);
    const offset = (p - 1) * PAGE;
    const items = db.prepare('SELECT id, content, tags, created_at FROM notes ORDER BY id DESC LIMIT ? OFFSET ?').all(PAGE, offset);
    const total = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n || 0;
    reply('notes.list.result', d.reqId, { ok: true, items, total, page: p, pages: Math.max(1, Math.ceil(total / PAGE)) });
    return true;
}
