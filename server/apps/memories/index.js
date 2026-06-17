// 记忆：AI 对用户的长期认知。落本机 roam.db 的 memories 表（三层 tier）。
// 由 AI 通过 sql 工具写入，前端只读 + 删除。
// WS 协议：memories.list / memories.delete，结果经 ws.broadcast 回所有网页端。
import ws from '../../index.js';
import { getDb } from '../../system/core/db.js';

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

function listMemories() {
    const items = getDb().prepare('SELECT id, title, summary, content, tier, source, created_at, updated_at FROM memories ORDER BY id DESC LIMIT 500').all();
    return { items };
}

function deleteMemory(id) {
    const info = getDb().prepare('DELETE FROM memories WHERE id = ?').run(id);
    return { ok: info.changes > 0 };
}

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'memories.list':
                reply('memories.list.result', d.reqId, { ok: true, ...listMemories() });
                return true;
            case 'memories.delete':
                reply('memories.delete.result', d.reqId, { ...deleteMemory(d.id) });
                return true;
            default:
                return false;
        }
    } catch (err) {
        console.error(`memories 错误 [${t}]:`, err.message || err);
        reply('memories.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
