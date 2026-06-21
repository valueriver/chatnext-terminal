// outlines 表数据访问 —— 唯一碰 SQL 的地方。root 用 NULL;前端用 0 表示 root,api 处归一。
const norm = (p) => (p ? Number(p) : null);

export const all = (db) =>
    db.all('SELECT id, parent_id, sort, text, collapsed, done FROM outlines ORDER BY parent_id, sort, id');

export const get = (db, id) =>
    db.first('SELECT id, parent_id, sort, text, collapsed, done FROM outlines WHERE id = ?', id);

export const siblings = (db, parentId) =>
    db.all('SELECT id, sort FROM outlines WHERE parent_id IS ? ORDER BY sort, id', norm(parentId));

export const maxSort = async (db, parentId) =>
    (await db.first('SELECT COALESCE(MAX(sort), 0) AS m FROM outlines WHERE parent_id IS ?', norm(parentId)))?.m || 0;

export const shiftAfter = (db, parentId, base) =>
    db.run('UPDATE outlines SET sort = sort + 1 WHERE parent_id IS ? AND sort > ?', norm(parentId), base);

export async function insert(db, parentId, sort, text, now) {
    const r = await db.run(
        'INSERT INTO outlines (parent_id, sort, text, collapsed, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
        norm(parentId), sort, String(text || ''), now, now,
    );
    return Number(r.meta.last_row_id);
}

export const setParentSort = (db, id, parentId, sort) =>
    db.run('UPDATE outlines SET parent_id = ?, sort = ? WHERE id = ?', norm(parentId), sort, id);

export const setSort = (db, id, sort) =>
    db.run('UPDATE outlines SET sort = ? WHERE id = ?', sort, id);

export const setText = (db, id, text, now) =>
    db.run('UPDATE outlines SET text = ?, updated_at = ? WHERE id = ?', String(text), now, id);

export const setCollapsed = (db, id, collapsed) =>
    db.run('UPDATE outlines SET collapsed = ? WHERE id = ?', collapsed ? 1 : 0, id);

export const setDone = (db, id, done) =>
    db.run('UPDATE outlines SET done = ? WHERE id = ?', done ? 1 : 0, id);

// 级联删整棵子树
export async function removeSubtree(db, id) {
    const ids = [];
    const stack = [Number(id)];
    while (stack.length) {
        const cur = stack.pop();
        ids.push(cur);
        for (const k of await db.all('SELECT id FROM outlines WHERE parent_id IS ?', cur)) stack.push(k.id);
    }
    const ph = ids.map(() => '?').join(',');
    await db.run(`DELETE FROM outlines WHERE id IN (${ph})`, ...ids);
    return ids.length;
}
