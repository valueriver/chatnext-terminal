// 设备侧 chat app:接收网页端上传的聊天附件,落到本机 ~/.one/files,回 path 供 agent 用 shell 读。
import { promises as fsp } from 'fs';
import os from 'os';
import path from 'path';
import ws from '../../channel.js';

const DIR = path.join(os.homedir(), '.one', 'files');

async function handle(message) {
    const { type, data = {} } = message;
    if (type !== 'chat.attach.upload') return false;

    const { name = 'file', dataUrl = '', reqId } = data;
    try {
        const b64 = String(dataUrl).split(',')[1] || '';
        const buf = Buffer.from(b64, 'base64');
        await fsp.mkdir(DIR, { recursive: true });
        const safe = String(name).replace(/[/\\]/g, '_');
        const dest = path.join(DIR, `${Date.now()}-${safe}`);
        await fsp.writeFile(dest, buf);
        ws.broadcast('chat.attach.upload.result', { reqId, ok: true, name: safe, path: dest, size: buf.length });
    } catch (e) {
        ws.broadcast('chat.attach.upload.result', { reqId, ok: false, error: e.message || String(e) });
    }
    return true;
}

export default { handle };
