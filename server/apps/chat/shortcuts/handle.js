// 快捷指令子能力：纯分发。
import { reply } from './shared.js';
import list from './commands/list.js';
import save from './commands/save.js';
import del from './commands/delete.js';
import reorder from './commands/reorder.js';
async function handle(message) {
    const t = message.type; const d = message.data || {};
    try {
        switch (t) {
            case 'chat.shortcuts.list': return list(d);
            case 'chat.shortcuts.save': return save(d);
            case 'chat.shortcuts.delete': return del(d);
            case 'chat.shortcuts.reorder': return reorder(d);
            default: return false;
        }
    } catch (err) {
        console.error(`shortcuts 错误 [${t}]:`, err.message || err);
        reply('chat.shortcuts.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}
export { handle };
export default { handle };
