// chats / messages 表数据访问 —— 唯一碰 SQL 的地方。直播在 DO,历史读写在这。
const title = (t) => (String(t ?? '').trim().slice(0, 200)) || '新对话'; // 标题:强转字符串 + 截断 + 兜底

export const list = async (db) =>
    (await db.prepare('SELECT id, title, created_at, updated_at FROM chats ORDER BY updated_at DESC').all()).results;

export const get = (db, id) =>
    db.prepare('SELECT id, title, created_at, updated_at FROM chats WHERE id = ?').bind(id).first();

export const create = (db, { id, title: t }, now) =>
    db.prepare('INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').bind(id, title(t), now, now).run();

export const rename = (db, id, t, now) =>
    db.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?').bind(title(t), now, id).run();

export const remove = (db, id) => db.prepare('DELETE FROM chats WHERE id = ?').bind(id).run();

// 消息历史(分页:取最新 limit 条;beforeId>0 则取该 id 之前更旧的一页)。返回正序(id 升序)。
export const messages = async (db, chatId, { beforeId = 0, limit = 50 } = {}) => {
    const { results } = beforeId > 0
        ? await db.prepare('SELECT id, role, body, usage, created_at FROM messages WHERE chat_id = ? AND id < ? ORDER BY id DESC LIMIT ?').bind(chatId, beforeId, limit).all()
        : await db.prepare('SELECT id, role, body, usage, created_at FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?').bind(chatId, limit).all();
    return results.reverse();
};
