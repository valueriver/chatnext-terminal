// notes REST:GET /apps/notes 列表 · POST 新建 · GET/PUT/DELETE /apps/notes/:id
// 纯 CRUD,无独立业务规则 → 不造空 service,直接调 repository。
import { json, err, readJson } from '../../system/respond.js';
import * as repo from './repository.js';

export default async function notesApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') return json({ notes: await repo.list(db) });
        if (request.method === 'POST') return json({ note: await repo.create(db, await readJson(request), now) });
    } else {
        const nid = Number(id);
        if (request.method === 'GET') return json({ note: await repo.get(db, nid) });
        if (request.method === 'PUT') return json({ note: await repo.update(db, nid, await readJson(request), now) });
        if (request.method === 'DELETE') { await repo.remove(db, nid); return json({ ok: true }); }
    }
    return err('method not allowed', 405);
}
