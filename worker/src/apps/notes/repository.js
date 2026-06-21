// notes 表数据访问 —— 唯一碰 SQL 的地方。
const COLS = 'id, content, tags, color, pinned, created_at, updated_at';
const MAX_CONTENT = 100000; // 单条笔记内容上限,防异常超大写入
const text = (v) => String(v ?? '').slice(0, MAX_CONTENT);

export const list = async (db, { limit = 60, offset = 0 } = {}) =>
    (await db.prepare(`SELECT ${COLS} FROM notes ORDER BY pinned DESC, id DESC LIMIT ? OFFSET ?`).bind(limit, offset).all()).results;

export const get = (db, id) =>
    db.prepare(`SELECT ${COLS} FROM notes WHERE id = ?`).bind(id).first();

export async function create(db, { content = '', tags = [], color = 'yellow', pinned = 0 }, now) {
    const r = await db.prepare(
        'INSERT INTO notes (content, tags, color, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(text(content), JSON.stringify(tags || []), String(color), pinned ? 1 : 0, now, now).run();
    return get(db, Number(r.meta.last_row_id));
}

export async function update(db, id, patch, now) {
    const cur = await get(db, id);
    if (!cur) return null;
    const content = patch.content ?? cur.content;
    const tags = patch.tags ?? JSON.parse(cur.tags || '[]');
    const color = patch.color ?? cur.color;
    const pinned = patch.pinned == null ? cur.pinned : (patch.pinned ? 1 : 0);
    await db.prepare(
        'UPDATE notes SET content = ?, tags = ?, color = ?, pinned = ?, updated_at = ? WHERE id = ?',
    ).bind(text(content), JSON.stringify(tags || []), String(color), pinned, now, id).run();
    return get(db, id);
}

export const remove = (db, id) => db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
