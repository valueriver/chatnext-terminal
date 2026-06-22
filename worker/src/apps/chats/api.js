// chats REST:对话历史 CRUD。直播(发送/流式)走 DO,不在这。
//   GET /apps/chats 列表 · POST 新建 · GET/PUT/DELETE /apps/chats/:id
import * as repo from './repository.js';

export default async function chatsApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') return Response.json({ chats: await repo.list(db) });
        if (request.method === 'POST') {
            const cid = crypto.randomUUID();
            await repo.create(db, { id: cid, title: (await request.json().catch(() => ({}))).title }, now);
            return Response.json({ chat: await repo.get(db, cid) });
        }
    } else {
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const beforeId = Number(url.searchParams.get('before')) || 0;
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
            const rows = await repo.messages(db, id, { beforeId, limit });
            const body = { messages: rows, hasMore: rows.length === limit };
            if (!beforeId) body.chat = await repo.get(db, id); // 初次加载才带会话信息
            return Response.json(body);
        }
        if (request.method === 'PUT') { await repo.rename(db, id, (await request.json().catch(() => ({}))).title, now); return Response.json({ ok: true }); }
        if (request.method === 'DELETE') { await repo.remove(db, id); return Response.json({ ok: true }); }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
