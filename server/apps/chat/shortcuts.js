// 快捷指令：聊天输入框「+」面板里的常用语，点一下填进输入框。落本机 roam.db 的 shortcuts 表。
// 设置页增删改 + 排序。WS：shortcuts.list / shortcuts.save / shortcuts.delete / shortcuts.reorder。
import ws from '../../channel.js';
import { getDb } from '../../system/db.js';

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

function listShortcuts() {
    const items = getDb().prepare('SELECT id, text, sort FROM shortcuts ORDER BY sort, id').all();
    return { items };
}

function saveShortcut({ id, text }) {
    const db = getDb();
    const t = String(text || '').trim();
    if (!t) return { error: '空指令' };
    if (id) {
        db.prepare('UPDATE shortcuts SET text = ? WHERE id = ?').run(t, id);
        return { id };
    }
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM shortcuts').get().m || 0;
    const info = db.prepare('INSERT INTO shortcuts (text, sort, created_at) VALUES (?, ?, ?)').run(t, maxSort + 1, Date.now());
    return { id: Number(info.lastInsertRowid) };
}

function deleteShortcut(id) {
    const info = getDb().prepare('DELETE FROM shortcuts WHERE id = ?').run(id);
    return { ok: info.changes > 0 };
}

// ids 为新顺序的完整 id 数组；按下标写 sort。
function reorderShortcuts(ids) {
    const db = getDb();
    const list = Array.isArray(ids) ? ids : [];
    const upd = db.prepare('UPDATE shortcuts SET sort = ? WHERE id = ?');
    db.exec('BEGIN');
    try {
        list.forEach((id, i) => upd.run(i + 1, id));
        db.exec('COMMIT');
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
    return { ok: true };
}

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'shortcuts.list':
                reply('shortcuts.list.result', d.reqId, { ok: true, ...listShortcuts() });
                return true;
            case 'shortcuts.save':
                reply('shortcuts.save.result', d.reqId, { ok: true, ...saveShortcut(d) });
                return true;
            case 'shortcuts.delete':
                reply('shortcuts.delete.result', d.reqId, { ...deleteShortcut(d.id) });
                return true;
            case 'shortcuts.reorder':
                reply('shortcuts.reorder.result', d.reqId, { ...reorderShortcuts(d.ids) });
                return true;
            default:
                return false;
        }
    } catch (err) {
        console.error(`shortcuts 错误 [${t}]:`, err.message || err);
        reply('shortcuts.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
