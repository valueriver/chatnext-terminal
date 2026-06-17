// 大纲：树形无限嵌套（WorkFlowy 式），整理内心图景。邻接表落本机 roam.db 的 outline 表。
// WS：outline.list / create / update / delete / indent / outdent / move / toggle。
// 全树取出在前端组树；个人大纲规模小，足够。
import ws from '../../channel.js';
import { getDb } from '../../system/core/db.js';

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

// parent_id 用 0 代表顶层（sqlite 里 NULL 比较麻烦，统一用 0）。
function siblings(db, parentId) {
    return db.prepare('SELECT * FROM outline WHERE parent_id = ? ORDER BY sort, id').all(parentId || 0);
}

function listAll() {
    const items = getDb().prepare('SELECT id, parent_id, sort, text, collapsed FROM outline ORDER BY parent_id, sort, id').all();
    return { items };
}

function createNode({ parentId = 0, afterId = 0, text = '' }) {
    const db = getDb();
    const now = Date.now();
    const pid = Number(parentId) || 0;
    let sort;
    if (afterId) {
        const after = db.prepare('SELECT sort FROM outline WHERE id = ?').get(afterId);
        const base = after ? after.sort : 0;
        db.prepare('UPDATE outline SET sort = sort + 1 WHERE parent_id = ? AND sort > ?').run(pid, base);
        sort = base + 1;
    } else {
        const max = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM outline WHERE parent_id = ?').get(pid).m || 0;
        sort = max + 1;
    }
    const info = db.prepare('INSERT INTO outline (parent_id, sort, text, collapsed, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)')
        .run(pid, sort, String(text || ''), now, now);
    return { id: Number(info.lastInsertRowid) };
}

function updateNode({ id, text, collapsed }) {
    const db = getDb();
    if (text != null) db.prepare('UPDATE outline SET text = ?, updated_at = ? WHERE id = ?').run(String(text), Date.now(), id);
    if (collapsed != null) db.prepare('UPDATE outline SET collapsed = ? WHERE id = ?').run(collapsed ? 1 : 0, id);
    return { ok: true };
}

// 级联删整棵子树
function deleteNode(id) {
    const db = getDb();
    const ids = [];
    const stack = [Number(id)];
    while (stack.length) {
        const cur = stack.pop();
        ids.push(cur);
        for (const c of db.prepare('SELECT id FROM outline WHERE parent_id = ?').all(cur)) stack.push(c.id);
    }
    const del = db.prepare('DELETE FROM outline WHERE id = ?');
    db.exec('BEGIN');
    try { ids.forEach((x) => del.run(x)); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
    return { ok: true };
}

// 缩进：成为前一个兄弟的最后一个子节点
function indentNode(id) {
    const db = getDb();
    const node = db.prepare('SELECT * FROM outline WHERE id = ?').get(id);
    if (!node) return { ok: false };
    const sibs = siblings(db, node.parent_id);
    const idx = sibs.findIndex((s) => s.id === node.id);
    if (idx <= 0) return { ok: false }; // 没有前兄弟，不能缩进
    const prev = sibs[idx - 1];
    const max = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM outline WHERE parent_id = ?').get(prev.id).m || 0;
    db.prepare('UPDATE outline SET parent_id = ?, sort = ? WHERE id = ?').run(prev.id, max + 1, node.id);
    return { ok: true };
}

// 反缩进：提升到父节点之后，成为祖父的子节点
function outdentNode(id) {
    const db = getDb();
    const node = db.prepare('SELECT * FROM outline WHERE id = ?').get(id);
    if (!node || !node.parent_id) return { ok: false }; // 已在顶层
    const parent = db.prepare('SELECT * FROM outline WHERE id = ?').get(node.parent_id);
    const grand = parent ? (parent.parent_id || 0) : 0;
    const base = parent ? parent.sort : 0;
    db.prepare('UPDATE outline SET sort = sort + 1 WHERE parent_id = ? AND sort > ?').run(grand, base);
    db.prepare('UPDATE outline SET parent_id = ?, sort = ? WHERE id = ?').run(grand, base + 1, node.id);
    return { ok: true };
}

// 上移/下移：与相邻兄弟交换 sort
function moveNode({ id, dir }) {
    const db = getDb();
    const node = db.prepare('SELECT * FROM outline WHERE id = ?').get(id);
    if (!node) return { ok: false };
    const sibs = siblings(db, node.parent_id);
    const idx = sibs.findIndex((s) => s.id === node.id);
    const j = idx + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= sibs.length) return { ok: false };
    const other = sibs[j];
    db.prepare('UPDATE outline SET sort = ? WHERE id = ?').run(other.sort, node.id);
    db.prepare('UPDATE outline SET sort = ? WHERE id = ?').run(node.sort, other.id);
    return { ok: true };
}

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'outline.list': reply('outline.list.result', d.reqId, { ok: true, ...listAll() }); return true;
            case 'outline.create': reply('outline.create.result', d.reqId, { ok: true, ...createNode(d) }); return true;
            case 'outline.update': reply('outline.update.result', d.reqId, { ...updateNode(d) }); return true;
            case 'outline.delete': reply('outline.delete.result', d.reqId, { ...deleteNode(d.id) }); return true;
            case 'outline.indent': reply('outline.indent.result', d.reqId, { ...indentNode(d.id) }); return true;
            case 'outline.outdent': reply('outline.outdent.result', d.reqId, { ...outdentNode(d.id) }); return true;
            case 'outline.move': reply('outline.move.result', d.reqId, { ...moveNode(d) }); return true;
            default: return false;
        }
    } catch (err) {
        console.error(`outline 错误 [${t}]:`, err.message || err);
        reply('outline.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
