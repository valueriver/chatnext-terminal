// outline 共享：回包 + 兄弟查询。
import ws from '../../channel.js';
import { getDb } from '../../system/db.js';

export function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

// 同一 parent 下的兄弟，按 sort 排序（parent_id 用 0 代表顶层）。
export function siblings(parentId) {
    return getDb().prepare('SELECT * FROM outline WHERE parent_id = ? ORDER BY sort, id').all(parentId || 0);
}
