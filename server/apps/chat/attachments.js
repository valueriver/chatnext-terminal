// 聊天附件上传：前端把文件 data URL 经 attach.upload 上来，落盘后只回 {name, path}（地址）。
// 消息里只存地址，AI 就在本机、用 shell 自己读，不嵌内容。
import ws from '../../channel.js';
import { saveFile } from '../../system/storage.js';

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        if (t === 'attach.upload') {
            const saved = saveFile(d.dataUrl, d.name);
            if (!saved) { reply('attach.upload.result', d.reqId, { ok: false, error: '无效文件' }); return true; }
            reply('attach.upload.result', d.reqId, { ok: true, ...saved });
            return true;
        }
        return false;
    } catch (err) {
        console.error(`attach 错误 [${t}]:`, err.message || err);
        reply('attach.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

export { handle };
export default { handle };
