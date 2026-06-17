// 进化：AI 自我演化的人设/原则时间轴。落本机 roam.db 的 evolution 表。
// 由 AI 通过 sql 工具写入（最新一版即生效的系统提示词），前端只读 + 删除。
// WS 协议：evolution.list / evolution.delete，结果经 ws.broadcast 回所有网页端。
import ws from '../../system/ws/index.js';
import { getDb } from '../../system/core/db.js';

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

function listEvolution() {
    const items = getDb().prepare('SELECT id, content, reason, source, created_at FROM evolution ORDER BY id DESC LIMIT 200').all();
    return { items };
}

function deleteEvolution(id) {
    const info = getDb().prepare('DELETE FROM evolution WHERE id = ?').run(id);
    return { ok: info.changes > 0 };
}

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'evolution.list':
                reply('evolution.list.result', d.reqId, { ok: true, ...listEvolution() });
                return true;
            case 'evolution.delete':
                reply('evolution.delete.result', d.reqId, { ...deleteEvolution(d.id) });
                return true;
            default:
                return false;
        }
    } catch (err) {
        console.error(`evolution 错误 [${t}]:`, err.message || err);
        reply('evolution.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
