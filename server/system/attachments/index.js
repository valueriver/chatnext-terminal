// 附件：文件落本机 ~/.roam/files/，消息只存 {name, path}(地址)。
// 不嵌内容、不走视觉——AI 就在本机，发它路径，它用 shell 自己读。
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import ws from '../ws/index.js';
import { ROOT } from '../core/db.js';

const FILE_DIR = path.join(ROOT, 'files');

function ensureDir() { fs.mkdirSync(FILE_DIR, { recursive: true }); }

// data URL + 原始文件名 → 落盘，返回 {name, path, size}。非法返回 null。
function saveFile(dataUrl, originalName) {
    const m = /^data:([\w./+-]+);base64,(.+)$/s.exec(String(dataUrl || ''));
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    const safeName = path.basename(String(originalName || '')).replace(/[/\\]/g, '_') || 'file';
    const ext = path.extname(safeName);
    ensureDir();
    const stored = `${randomUUID()}${ext}`;
    const abs = path.join(FILE_DIR, stored);
    fs.writeFileSync(abs, buf);
    return { name: safeName, path: abs, size: buf.length };
}

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

export { saveFile, handle };
export default { handle };
