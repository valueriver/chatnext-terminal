// 模型配置：读/写设置里的模型参数（设置页用）。
import ws from '../../channel.js';
import { readConfig, writeConfig, publicView } from '../../system/ai/config.js';

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'chat.model.get':
                reply('chat.model.get.result', d.reqId, { config: publicView(await readConfig()) });
                return true;
            case 'chat.model.set':
                reply('chat.model.set.result', d.reqId, { ok: true, config: publicView(await writeConfig(d.config || {})) });
                return true;
            default:
                return false;
        }
    } catch (err) {
        console.error(`模型配置错误 [${t}]:`, err.message || err);
        reply('chat.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
