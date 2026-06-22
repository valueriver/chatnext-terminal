import * as repo from './repository.js';

export default async function notesApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();
    const url = new URL(request.url);

    if (!id) {
        if (request.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit')) || 60, 200);
            const offset = Number(url.searchParams.get('offset')) || 0;
            return Response.json({ notes: await repo.list(db, { limit, offset }) });
        }
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            return Response.json({ note: await repo.create(db, body, now) });
        }
    } else {
        if (request.method === 'GET') return Response.json({ note: await repo.get(db, id) });
        if (request.method === 'PUT') {
            const body = await request.json().catch(() => ({}));
            return Response.json({ note: await repo.update(db, id, body, now) });
        }
        if (request.method === 'DELETE') { await repo.remove(db, id); return Response.json({ ok: true }); }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
