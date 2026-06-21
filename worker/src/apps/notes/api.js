// notes REST:GET /apps/notes 列表 · POST 新建 · GET/PUT/DELETE /apps/notes/:id
// 纯 CRUD,无独立业务规则 → 不造空 service,直接调 repository。
import * as repo from './repository.js';

export default async function notesApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') return Response.json({ notes: await repo.list(db) });
        if (request.method === 'POST') return Response.json({ note: await repo.create(db, await request.json().catch(() => ({})), now) });
    } else {
        const nid = Number(id);
        if (request.method === 'GET') return Response.json({ note: await repo.get(db, nid) });
        if (request.method === 'PUT') return Response.json({ note: await repo.update(db, nid, await request.json().catch(() => ({})), now) });
        if (request.method === 'DELETE') { await repo.remove(db, nid); return Response.json({ ok: true }); }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
