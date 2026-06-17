// 模型配置子能力：纯分发。
import { reply } from './shared.js';
import get from './commands/get.js';
import set from './commands/set.js';
async function handle(message) {
    const t = message.type; const d = message.data || {};
    try {
        switch (t) {
            case 'chat.model.get': return get(d);
            case 'chat.model.set': return set(d);
            default: return false;
        }
    } catch (err) {
        console.error(`模型配置错误 [${t}]:`, err.message || err);
        reply('chat.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}
export { handle };
export default { handle };
