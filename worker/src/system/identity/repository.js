// devices 表数据访问 —— 唯一碰 SQL 的地方。
export const list = (db) =>
    db.all('SELECT id, name, capabilities, last_seen, created_at FROM devices ORDER BY created_at');

export const get = (db, id) =>
    db.first('SELECT id, name, secret_hash, capabilities, last_seen, created_at FROM devices WHERE id = ?', id);

export const upsert = (db, { id, name = '', secretHash = '', capabilities = [] }, now) =>
    db.run(
        `INSERT INTO devices (id, name, secret_hash, capabilities, last_seen, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, capabilities = excluded.capabilities`,
        id, String(name), String(secretHash), JSON.stringify(capabilities || []), now, now,
    );

export const touch = (db, id, now) =>
    db.run('UPDATE devices SET last_seen = ? WHERE id = ?', now, id);

export const remove = (db, id) => db.run('DELETE FROM devices WHERE id = ?', id);
