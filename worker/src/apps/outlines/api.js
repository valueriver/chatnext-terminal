// outlines REST:
//   GET    /apps/outlines        → 全树
//   POST   /apps/outlines        → 新建 {parentId, afterId, text} → {id}
//   PUT    /apps/outlines/:id     → {text}|{collapsed} 改;或 {op:'indent'|'outdent'|'move',dir}
//   DELETE /apps/outlines/:id     → 删子树
import { json, err, readJson } from '../../system/respond.js';
import * as service from './service.js';

export default async function outlinesApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') return json({ nodes: await service.tree(db) });
        if (request.method === 'POST') return json(await service.create(db, await readJson(request), now));
    } else {
        const nid = Number(id);
        if (request.method === 'PUT') {
            const body = await readJson(request);
            if (body.op === 'indent') return json(await service.indent(db, nid));
            if (body.op === 'outdent') return json(await service.outdent(db, nid));
            if (body.op === 'move') return json(await service.move(db, nid, Number(body.dir) || 1));
            await service.update(db, nid, body, now);
            return json({ ok: true });
        }
        if (request.method === 'DELETE') return json({ removed: await service.remove(db, nid) });
    }
    return err('method not allowed', 405);
}
