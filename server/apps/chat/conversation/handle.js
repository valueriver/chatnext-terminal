// 对话子能力的纯分发层。
import { reply } from './shared.js';
import list from './commands/list.js';
import create from './commands/create.js';
import get from './commands/get.js';
import rename from './commands/rename.js';
import del from './commands/delete.js';
import send from './commands/send.js';
import abort from './commands/abort.js';

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'chat.list': return list(d);
            case 'chat.create': return create(d);
            case 'chat.get': return get(d);
            case 'chat.rename': return rename(d);
            case 'chat.delete': return del(d);
            case 'chat.send': return send(d);
            case 'chat.abort': return abort(d);
            default: return false;
        }
    } catch (err) {
        console.error(`对话错误 [${t}]:`, err.message || err);
        reply('chat.error', d.reqId, { ok: false, error: err.message || String(err), chatId: d.chatId });
        return true;
    }
}
export { handle };
export default { handle };
