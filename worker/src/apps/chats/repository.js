// chats / messages 表数据访问 —— 唯一碰 SQL 的地方。直播在 DO,历史读写在这。
export const list = async (db) =>
    (await db.prepare('SELECT id, title, created_at, updated_at FROM chats ORDER BY updated_at DESC').all()).results;

export const get = (db, id) =>
    db.prepare('SELECT id, title, created_at, updated_at FROM chats WHERE id = ?').bind(id).first();

export const create = (db, { id, title = '新对话' }, now) =>
    db.prepare('INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').bind(id, title, now, now).run();

export const rename = (db, id, title, now) =>
    db.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?').bind(String(title || ''), now, id).run();

export const remove = (db, id) => db.prepare('DELETE FROM chats WHERE id = ?').bind(id).run();

// 消息历史(含压缩前的全文;前端按 role/body 渲染)
export const messages = async (db, chatId) =>
    (await db.prepare('SELECT id, role, body, usage, created_at FROM messages WHERE chat_id = ? ORDER BY id ASC').bind(chatId).all()).results;
