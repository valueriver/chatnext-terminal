// chats REST:对话历史 CRUD。直播(发送/流式)走 DO,不在这。
//   GET /apps/chats 列表 · POST 新建 · GET/PUT/DELETE /apps/chats/:id
import { json, err, readJson } from '../../system/respond.js';
import * as repo from './repository.js';

export default async function chatsApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') return json({ chats: await repo.list(db) });
        if (request.method === 'POST') {
            const cid = crypto.randomUUID();
            await repo.create(db, { id: cid, title: (await readJson(request)).title }, now);
            return json({ chat: await repo.get(db, cid) });
        }
    } else {
        if (request.method === 'GET') return json({ chat: await repo.get(db, id), messages: await repo.messages(db, id) });
        if (request.method === 'PUT') { await repo.rename(db, id, (await readJson(request)).title, now); return json({ ok: true }); }
        if (request.method === 'DELETE') { await repo.remove(db, id); return json({ ok: true }); }
    }
    return err('method not allowed', 405);
}
