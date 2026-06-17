// 大纲 app 的纯分发层：按事件类型 switch 到 commands，每个命令一文件。
import { reply } from './shared.js';
import list from './commands/list.js';
import create from './commands/create.js';
import update from './commands/update.js';
import del from './commands/delete.js';
import indent from './commands/indent.js';
import outdent from './commands/outdent.js';
import move from './commands/move.js';

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'outline.list': return list(d);
            case 'outline.create': return create(d);
            case 'outline.update': return update(d);
            case 'outline.delete': return del(d);
            case 'outline.indent': return indent(d);
            case 'outline.outdent': return outdent(d);
            case 'outline.move': return move(d);
            default: return false;
        }
    } catch (err) {
        console.error(`outline 错误 [${t}]:`, err.message || err);
        reply('outline.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
