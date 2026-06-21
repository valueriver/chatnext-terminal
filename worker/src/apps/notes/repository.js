// notes 表数据访问 —— 唯一碰 SQL 的地方。
const COLS = 'id, content, tags, color, pinned, created_at, updated_at';

export const list = (db) =>
    db.all(`SELECT ${COLS} FROM notes ORDER BY pinned DESC, id DESC`);

export const get = (db, id) =>
    db.first(`SELECT ${COLS} FROM notes WHERE id = ?`, id);

export async function create(db, { content = '', tags = [], color = 'yellow', pinned = 0 }, now) {
    const r = await db.run(
        'INSERT INTO notes (content, tags, color, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        String(content), JSON.stringify(tags || []), String(color), pinned ? 1 : 0, now, now,
    );
    return get(db, Number(r.meta.last_row_id));
}

export async function update(db, id, patch, now) {
    const cur = await get(db, id);
    if (!cur) return null;
    const content = patch.content ?? cur.content;
    const tags = patch.tags ?? JSON.parse(cur.tags || '[]');
    const color = patch.color ?? cur.color;
    const pinned = patch.pinned == null ? cur.pinned : (patch.pinned ? 1 : 0);
    await db.run(
        'UPDATE notes SET content = ?, tags = ?, color = ?, pinned = ?, updated_at = ? WHERE id = ?',
        String(content), JSON.stringify(tags || []), String(color), pinned, now, id,
    );
    return get(db, id);
}

export const remove = (db, id) => db.run('DELETE FROM notes WHERE id = ?', id);
