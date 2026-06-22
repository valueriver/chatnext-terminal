export const list = async (db) => {
    const { results } = await db.prepare(
        `SELECT t.*, (SELECT status FROM task_runs WHERE task_id = t.id ORDER BY id DESC LIMIT 1) AS last_status
         FROM tasks t ORDER BY t.created_at DESC`,
    ).all();
    return results;
};

export const get = async (db, id) => {
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
    if (!task) return null;
    const { results: runs } = await db.prepare(
        'SELECT id, status, summary, chat_id, started_at, finished_at FROM task_runs WHERE task_id = ? ORDER BY id DESC LIMIT 20',
    ).bind(id).all();
    return { ...task, runs };
};

const normKind = (k) => (k === 'once' ? 'once' : 'cron');
const normRunAt = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };

export const create = async (db, body, now) => {
    const id = crypto.randomUUID();
    const kind = normKind(body.kind);
    await db.prepare(
        `INSERT INTO tasks (id, name, prompt, kind, cron, run_at, enabled, needs_device, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
        id,
        String(body.name || '').slice(0, 200),
        String(body.prompt || ''),
        kind,
        kind === 'cron' ? String(body.cron || '').slice(0, 100) : '',
        kind === 'once' ? normRunAt(body.run_at) : null,
        body.enabled === false ? 0 : 1,
        body.needs_device ? 1 : 0,
        now, now,
    ).run();
    return get(db, id);
};

export const update = async (db, id, body, now) => {
    const fields = [];
    const vals = [];
    const set = (col, v) => { fields.push(`${col} = ?`); vals.push(v); };
    if (body.name !== undefined) set('name', String(body.name).slice(0, 200));
    if (body.prompt !== undefined) set('prompt', String(body.prompt));
    if (body.kind !== undefined) set('kind', normKind(body.kind));
    if (body.cron !== undefined) set('cron', String(body.cron).slice(0, 100));
    if (body.run_at !== undefined) set('run_at', normRunAt(body.run_at));
    if (body.enabled !== undefined) set('enabled', body.enabled ? 1 : 0);
    if (body.needs_device !== undefined) set('needs_device', body.needs_device ? 1 : 0);
    if (fields.length) {
        set('updated_at', now);
        await db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).bind(...vals, id).run();
    }
    return get(db, id);
};

export const remove = (db, id) => db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
