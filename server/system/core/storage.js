// 本机文件落盘：data URL → ~/.roam/files/，返回 {name, path, size}。截图、聊天附件等都用它。
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { ROOT } from './db.js';

const FILE_DIR = path.join(ROOT, 'files');

export function saveFile(dataUrl, originalName) {
    const m = /^data:([\w./+-]+);base64,(.+)$/s.exec(String(dataUrl || ''));
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    const safeName = path.basename(String(originalName || '')).replace(/[/\\]/g, '_') || 'file';
    const ext = path.extname(safeName);
    fs.mkdirSync(FILE_DIR, { recursive: true });
    const stored = `${randomUUID()}${ext}`;
    const abs = path.join(FILE_DIR, stored);
    fs.writeFileSync(abs, buf);
    return { name: safeName, path: abs, size: buf.length };
}
