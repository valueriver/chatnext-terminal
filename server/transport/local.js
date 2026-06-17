// local transport：没配 CLOUDFLARE_WORKER_URL 时，server 自己当服务端。
// 起 http 挂前端（ui/dist）+ WS server，浏览器直连本机，不经 Worker。本地免密放行。
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { LOCAL_PORT } from '../system/env.js';

const DIST = fileURLToPath(new URL('../../ui/dist', import.meta.url));
const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.map': 'application/json',
};
const mimeOf = (f) => MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';

function lanIPs() {
    const ips = [];
    for (const list of Object.values(os.networkInterfaces())) {
        for (const n of list || []) if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    }
    return ips;
}

// 静态资源 + SPA 回退（找不到文件就回 index.html，交给前端路由）
function serveStatic(req, res) {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const file = path.join(DIST, p);
    if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
        if (err) {
            fs.readFile(path.join(DIST, 'index.html'), (e2, html) => {
                if (e2) { res.writeHead(404); res.end('ui/dist 未构建：先到 ui/ 跑 npm run build'); return; }
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
            });
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeOf(file) });
        res.end(data);
    });
}

export function createLocal({ onMessage }) {
    const clients = new Map(); // clientId -> ws
    let server = null;
    let wss = null;

    function send(message) {
        const to = message.to;
        const payload = JSON.stringify(message);
        const trySend = (ws) => { try { ws.send(payload); } catch { /* 已断 */ } };
        if (to === 'web' || to === 'all') {
            for (const ws of clients.values()) trySend(ws);
        } else if (typeof to === 'string' && to.startsWith('web:')) {
            const ws = clients.get(to.slice(4));
            if (ws) trySend(ws);
        }
        // to === 'desktop' / 'server'：本机自己，无需外发
    }

    function onConnection(ws) {
        const id = randomUUID();
        clients.set(id, ws);
        // 本地免密：连上即认证通过
        try { ws.send(JSON.stringify({ type: 'connection.ready', to: 'web', data: { clientId: id, authenticated: true, requiresPassword: false } })); } catch {}
        // 触发一次设备状态，让 server 把终端快照推给新连入的网页
        onMessage?.({ type: 'connection.devices', data: { devices: { desktop: 'connected', web: 'connected' } } });

        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }
            if (msg.type === 'connection.ping') { try { ws.send(JSON.stringify({ type: 'connection.pong', to: 'web', data: {} })); } catch {} return; }
            msg.meta = { ...(msg.meta || {}), clientId: id, device: 'web' };
            onMessage?.(msg);
        });
        ws.on('close', () => { clients.delete(id); });
        ws.on('error', () => { clients.delete(id); });
    }

    function start() {
        server = http.createServer(serveStatic);
        wss = new WebSocketServer({ noServer: true });
        wss.on('connection', onConnection);
        server.on('upgrade', (req, socket, head) => {
            const { pathname } = new URL(req.url, 'http://x');
            if (pathname === '/ws') wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
            else socket.destroy();
        });
        server.listen(Number(LOCAL_PORT), '0.0.0.0', () => {
            console.log('');
            console.log('✅ Roam 本地直连已就绪（免密）');
            console.log(`   本机:   http://localhost:${LOCAL_PORT}`);
            for (const ip of lanIPs()) console.log(`   局域网: http://${ip}:${LOCAL_PORT}`);
            console.log('   ⚠️ 本地模式不校验密码，请只在可信网络使用');
            console.log('');
        });
    }

    return {
        name: 'local',
        start,
        send,
        stop() { try { for (const ws of clients.values()) ws.close(); } catch {} server?.close(); },
    };
}
