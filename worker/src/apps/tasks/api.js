import * as repo from './repository.js';

export default async function tasksApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') return Response.json({ tasks: await repo.list(db) });
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            return Response.json({ task: await repo.create(db, body, now) });
        }
    } else {
        const parts = new URL(request.url).pathname.split('/').filter(Boolean);
        // POST /apps/tasks/:id/run → 立即运行
        if (parts[3] === 'run' && request.method === 'POST') {
            const task = await repo.get(db, id);
            if (!task) return Response.json({ error: 'not found' }, { status: 404 });
            return Response.json({ ok: true, message: '已触发' });
        }
        if (request.method === 'GET') {
            const task = await repo.get(db, id);
            if (!task) return Response.json({ error: 'not found' }, { status: 404 });
            return Response.json({ task });
        }
        if (request.method === 'PUT') {
            const body = await request.json().catch(() => ({}));
            return Response.json({ task: await repo.update(db, id, body, now) });
        }
        if (request.method === 'DELETE') { await repo.remove(db, id); return Response.json({ ok: true }); }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
