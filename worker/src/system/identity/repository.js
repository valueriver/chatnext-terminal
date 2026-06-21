// devices 表数据访问 —— 唯一碰 SQL 的地方。
export const list = async (db) =>
    (await db.prepare('SELECT id, name, capabilities, last_seen, created_at FROM devices ORDER BY created_at').all()).results;

export const get = (db, id) =>
    db.prepare('SELECT id, name, secret_hash, capabilities, last_seen, created_at FROM devices WHERE id = ?').bind(id).first();

export const upsert = (db, { id, name = '', secretHash = '', capabilities = [] }, now) =>
    db.prepare(
        `INSERT INTO devices (id, name, secret_hash, capabilities, last_seen, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, capabilities = excluded.capabilities`,
    ).bind(id, String(name), String(secretHash), JSON.stringify(capabilities || []), now, now).run();

export const touch = (db, id, now) =>
    db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').bind(now, id).run();

export const remove = (db, id) => db.prepare('DELETE FROM devices WHERE id = ?').bind(id).run();
