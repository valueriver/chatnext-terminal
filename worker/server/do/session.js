// OneSession：每个 session 一个 Durable Object，按 session 隔离地中继 desktop ↔ web。
// 只做连接生命周期与消息分发；鉴权见 auth.js，路由见 routing.js。
import { DurableObject } from 'cloudflare:workers';
import { loadAuthState, isTokenValid, handleAuthControl, broadcastAuthState } from './auth.js';
import { socketId, route, broadcastDeviceStatus } from './routing.js';

export class OneSession extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        this.requiresPassword = true;
        this.authTokens = new Map(); // token -> expiresAt
        this.ctx.blockConcurrencyWhile(() => loadAuthState(this));
    }

    async fetch(request) {
        const url = new URL(request.url);
        if (!url.pathname.endsWith('/ws')) return new Response('Not Found', { status: 404 });
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected Upgrade: websocket', { status: 426 });

        const device = url.searchParams.get('device');
        if (device !== 'desktop' && device !== 'web') return new Response('Missing or invalid device param', { status: 400 });

        const [client, server] = Object.values(new WebSocketPair());
        const id = socketId();

        // 免登录：web 客户端带有效 authToken 则直接放行
        const tokenParam = url.searchParams.get('authToken') || '';
        const preAuthed = device === 'web' && isTokenValid(this, tokenParam);
        const authenticated = device === 'desktop' || !this.requiresPassword || preAuthed;

        this.ctx.acceptWebSocket(server, [device]);
        server.serializeAttachment({ device, id, authenticated });

        try {
            server.send(JSON.stringify({
                type: 'connection.ready',
                to: device,
                data: { clientId: id, authenticated, requiresPassword: this.requiresPassword },
            }));
        } catch { /* 连接已断 */ }

        broadcastDeviceStatus(this);
        broadcastAuthState(this, server);
        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws, message) {
        let msg;
        try { msg = JSON.parse(message); } catch { return; }
        if (!msg?.type) return;

        const att = ws.deserializeAttachment() || {};

        if (msg.type === 'connection.ping') {
            ws.send(JSON.stringify({ type: 'connection.pong', to: att.device, data: {} }));
            return;
        }

        // 桌面端的鉴权控制
        if (att.device === 'desktop' && (msg.type === 'auth.mode' || msg.type === 'auth.grant' || msg.type === 'auth.reject' || msg.type === 'auth.close')) {
            handleAuthControl(this, msg);
            return;
        }

        // 未认证的 web：除提交密码/请求挑战外，一律挡回
        if (att.device === 'web' && !att.authenticated && msg.type !== 'auth.submit' && msg.type !== 'auth.request_challenge') {
            broadcastAuthState(this, ws, '请先输入访问密码');
            return;
        }

        msg.meta = { ...(msg.meta || {}), clientId: att.id, device: att.device };
        route(this, msg);
    }

    async webSocketClose() { broadcastDeviceStatus(this); }
    async webSocketError() { broadcastDeviceStatus(this); }
}
