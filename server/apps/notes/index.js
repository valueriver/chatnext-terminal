// 笔记：随手记录想法、片段，喂给 AI 了解你。数据落本机 roam.db 的 notes 表。
// WS 协议：notes.list / notes.save（有 id 即更新）/ notes.delete，结果经 ws.broadcast 回所有网页端。
import ws from '../../index.js';
import { getDb } from '../../system/core/db.js';

const PAGE = 20;

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

function listNotes(page = 1) {
    const d = getDb();
    const p = Math.max(1, Number(page) || 1);
    const offset = (p - 1) * PAGE;
    const items = d.prepare('SELECT id, content, tags, created_at FROM notes ORDER BY id DESC LIMIT ? OFFSET ?').all(PAGE, offset);
    const total = d.prepare('SELECT COUNT(*) AS n FROM notes').get().n || 0;
    return { items, total, page: p, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

function saveNote({ id, content, tags }) {
    const d = getDb();
    const now = Date.now();
    const text = String(content || '');
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
    if (id) {
        d.prepare('UPDATE notes SET content = ?, tags = ?, updated_at = ? WHERE id = ?').run(text, tagsJson, now, id);
        return { id };
    }
    const info = d.prepare('INSERT INTO notes (content, tags, created_at, updated_at) VALUES (?, ?, ?, ?)').run(text, tagsJson, now, now);
    return { id: Number(info.lastInsertRowid) };
}

function deleteNote(id) {
    const d = getDb();
    const info = d.prepare('DELETE FROM notes WHERE id = ?').run(id);
    return { ok: info.changes > 0 };
}

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'notes.list':
                reply('notes.list.result', d.reqId, { ok: true, ...listNotes(d.page) });
                return true;
            case 'notes.save':
                reply('notes.save.result', d.reqId, { ok: true, ...saveNote(d) });
                return true;
            case 'notes.delete':
                reply('notes.delete.result', d.reqId, { ...deleteNote(d.id) });
                return true;
            default:
                return false;
        }
    } catch (err) {
        console.error(`notes 错误 [${t}]:`, err.message || err);
        reply('notes.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
