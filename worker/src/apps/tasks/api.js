// tasks REST:GET /apps/tasks 列表 · POST 新建 · GET/PUT/DELETE /apps/tasks/:id
// 立即运行:POST /apps/tasks/:id/run → 转发给 DO(agent 住那里),不阻塞。
import * as repo from './repository.js';

export default async function tasksApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();
    const runNow = new URL(request.url).pathname.endsWith('/run');

    if (!id) {
        if (request.method === 'GET') return Response.json({ tasks: await repo.list(db) });
        if (request.method === 'POST') return Response.json({ task: await repo.create(db, await request.json().catch(() => ({})), now) });
    } else if (runNow && request.method === 'POST') {
        // 转发给唯一 DO 实例,让它复用 agent 立即跑这条任务
        ctx.env.HUB.get(ctx.env.HUB.idFromName('one')).fetch(
            new Request('https://do/run-task', { method: 'POST', body: JSON.stringify({ taskId: id }) }),
        ).catch(() => {});
        return Response.json({ ok: true });
    } else {
        if (request.method === 'GET') return Response.json({ task: await repo.get(db, id) });
        if (request.method === 'PUT') return Response.json({ task: await repo.update(db, id, await request.json().catch(() => ({})), now) });
        if (request.method === 'DELETE') { await repo.remove(db, id); return Response.json({ ok: true }); }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
