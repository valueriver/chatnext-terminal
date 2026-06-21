// chats / messages 表数据访问 —— 唯一碰 SQL 的地方。直播在 DO,历史读写在这。
export const list = (db) =>
    db.all('SELECT id, title, created_at, updated_at FROM chats ORDER BY updated_at DESC');

export const get = (db, id) =>
    db.first('SELECT id, title, created_at, updated_at FROM chats WHERE id = ?', id);

export const create = (db, { id, title = '新对话' }, now) =>
    db.run('INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)', id, title, now, now);

export const rename = (db, id, title, now) =>
    db.run('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?', String(title || ''), now, id);

export const remove = (db, id) => db.run('DELETE FROM chats WHERE id = ?', id);

// 消息历史(含压缩前的全文;前端按 role/body 渲染)
export const messages = (db, chatId) =>
    db.all('SELECT id, role, body, usage, created_at FROM messages WHERE chat_id = ? ORDER BY id ASC', chatId);
