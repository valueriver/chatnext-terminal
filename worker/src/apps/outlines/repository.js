// outlines 表数据访问 —— 唯一碰 SQL 的地方。root 用 NULL;前端用 0 表示 root,api 处归一。
const norm = (p) => (p ? Number(p) : null);

export const all = async (db) =>
    (await db.prepare('SELECT id, parent_id, sort, text, collapsed, done FROM outlines ORDER BY parent_id, sort, id').all()).results;

export const get = (db, id) =>
    db.prepare('SELECT id, parent_id, sort, text, collapsed, done FROM outlines WHERE id = ?').bind(id).first();

export const siblings = async (db, parentId) =>
    (await db.prepare('SELECT id, sort FROM outlines WHERE parent_id IS ? ORDER BY sort, id').bind(norm(parentId)).all()).results;

export const maxSort = async (db, parentId) =>
    (await db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM outlines WHERE parent_id IS ?').bind(norm(parentId)).first())?.m || 0;

export const shiftAfter = (db, parentId, base) =>
    db.prepare('UPDATE outlines SET sort = sort + 1 WHERE parent_id IS ? AND sort > ?').bind(norm(parentId), base).run();

export async function insert(db, parentId, sort, text, now) {
    const r = await db.prepare(
        'INSERT INTO outlines (parent_id, sort, text, collapsed, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
    ).bind(norm(parentId), sort, String(text || ''), now, now).run();
    return Number(r.meta.last_row_id);
}

export const setParentSort = (db, id, parentId, sort) =>
    db.prepare('UPDATE outlines SET parent_id = ?, sort = ? WHERE id = ?').bind(norm(parentId), sort, id).run();

export const setSort = (db, id, sort) =>
    db.prepare('UPDATE outlines SET sort = ? WHERE id = ?').bind(sort, id).run();

export const setText = (db, id, text, now) =>
    db.prepare('UPDATE outlines SET text = ?, updated_at = ? WHERE id = ?').bind(String(text), now, id).run();

export const setCollapsed = (db, id, collapsed) =>
    db.prepare('UPDATE outlines SET collapsed = ? WHERE id = ?').bind(collapsed ? 1 : 0, id).run();

export const setDone = (db, id, done) =>
    db.prepare('UPDATE outlines SET done = ? WHERE id = ?').bind(done ? 1 : 0, id).run();

// 级联删整棵子树
export async function removeSubtree(db, id) {
    const ids = [];
    const stack = [Number(id)];
    while (stack.length) {
        const cur = stack.pop();
        ids.push(cur);
        const { results } = await db.prepare('SELECT id FROM outlines WHERE parent_id IS ?').bind(cur).all();
        for (const k of results) stack.push(k.id);
    }
    const ph = ids.map(() => '?').join(',');
    await db.prepare(`DELETE FROM outlines WHERE id IN (${ph})`).bind(...ids).run();
    return ids.length;
}
