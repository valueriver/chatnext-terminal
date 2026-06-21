// outlines REST:
//   GET    /apps/outlines        → 全树
//   POST   /apps/outlines        → 新建 {parentId, afterId, text} → {id}
//   PUT    /apps/outlines/:id     → {text}|{collapsed} 改;或 {op:'indent'|'outdent'|'move',dir}
//   DELETE /apps/outlines/:id     → 删子树
import * as service from './service.js';

export default async function outlinesApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') return Response.json({ nodes: await service.tree(db) });
        if (request.method === 'POST') return Response.json(await service.create(db, await request.json().catch(() => ({})), now));
    } else {
        const nid = Number(id);
        if (request.method === 'PUT') {
            const body = await request.json().catch(() => ({}));
            if (body.op === 'indent') return Response.json(await service.indent(db, nid));
            if (body.op === 'outdent') return Response.json(await service.outdent(db, nid));
            if (body.op === 'move') return Response.json(await service.move(db, nid, Number(body.dir) || 1));
            await service.update(db, nid, body, now);
            return Response.json({ ok: true });
        }
        if (request.method === 'DELETE') return Response.json({ removed: await service.remove(db, nid) });
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
