// 笔记 app 的纯分发层:按事件类型 switch 到 commands,每个命令一文件。
import { reply } from './shared.js';
import list from './commands/list.js';
import save from './commands/save.js';
import del from './commands/delete.js';

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'notes.list': return list(d);
            case 'notes.save': return save(d);
            case 'notes.delete': return del(d);
            default: return false;
        }
    } catch (err) {
        console.error(`notes 错误 [${t}]:`, err.message || err);
        reply('notes.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
