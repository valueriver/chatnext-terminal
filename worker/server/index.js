import { DurableObject } from "cloudflare:workers";

function socketId() {
    return crypto.randomUUID();
}

export class TerminalSessionManager extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        this.requiresPassword = true;
        this.authTokens = new Map();  // token -> expiresAt
        this.ctx.blockConcurrencyWhile(async () => {
            const v = await this.ctx.storage.get('requiresPassword');
            if (typeof v === 'boolean') this.requiresPassword = v;

            const tokens = await this.ctx.storage.get('authTokens');
            if (tokens && typeof tokens === 'object') {
                const now = Date.now();
                for (const [tok, exp] of Object.entries(tokens)) {
                    if (typeof exp === 'number' && exp > now) {
                        this.authTokens.set(tok, exp);
                    }
                }
            }
        });
    }

    async persistAuthTokens() {
        const obj = {};
        for (const [tok, exp] of this.authTokens.entries()) obj[tok] = exp;
        try { await this.ctx.storage.put('authTokens', obj); } catch {}
    }

    issueAuthToken() {
        const token = crypto.randomUUID().replace(/-/g, '')
            + crypto.randomUUID().replace(/-/g, '');
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;  // 30 天
        this.authTokens.set(token, expiresAt);
        this.persistAuthTokens();
        return token;
    }

    isTokenValid(token) {
        if (!token) return false;
        const exp = this.authTokens.get(token);
        if (!exp) return false;
        if (exp <= Date.now()) {
            this.authTokens.delete(token);
            this.persistAuthTokens();
            return false;
        }
        return true;
    }

    clearAllAuthTokens() {
        this.authTokens.clear();
        this.persistAuthTokens();
    }

    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname !== '/ws') {
            return new Response('Not Found', { status: 404 });
        }

        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('Expected Upgrade: websocket', { status: 426 });
        }

        const device = url.searchParams.get('device');
        if (device !== 'desktop' && device !== 'web') {
            return new Response('Missing or invalid device param', { status: 400 });
        }

        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        const id = socketId();

        // 免登录：web 客户端带有效 authToken 则直接放行
        const tokenParam = url.searchParams.get('authToken') || '';
        const preAuthed = device === 'web' && this.isTokenValid(tokenParam);
        const authenticated = device === 'desktop' || !this.requiresPassword || preAuthed;

        this.ctx.acceptWebSocket(server, [device]);
        server.serializeAttachment({ device, id, authenticated });

        try {
            server.send(JSON.stringify({
                type: 'connection.ready',
                to: device,
                data: {
                    clientId: id,
                    authenticated,
                    requiresPassword: this.requiresPassword,
                },
            }));
        } catch {}

        this.broadcastDeviceStatus();
        this.broadcastAuthState(server);

        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws, message) {
        let msg;
        try {
            msg = JSON.parse(message);
        } catch {
            return;
        }
        if (!msg?.type) return;

        const att = ws.deserializeAttachment() || {};

        if (msg.type === 'connection.ping') {
            ws.send(JSON.stringify({
                type: 'connection.pong',
                to: att.device,
                data: {},
            }));
            return;
        }

        if (att.device === 'desktop' && (
            msg.type === 'auth.mode'
            || msg.type === 'auth.grant'
            || msg.type === 'auth.reject'
            || msg.type === 'auth.close'
        )) {
            this.handleAuthControl(msg);
            return;
        }

        if (att.device === 'web' && !att.authenticated
            && msg.type !== 'auth.submit'
            && msg.type !== 'auth.request_challenge'
        ) {
            this.broadcastAuthState(ws, '请先输入访问密码');
            return;
        }

        msg.meta = {
            ...(msg.meta || {}),
            clientId: att.id,
            device: att.device,
        };
        this.route(msg);
    }

    async webSocketClose() {
        this.broadcastDeviceStatus();
    }

    async webSocketError() {
        this.broadcastDeviceStatus();
    }

    handleAuthControl(msg) {
        if (msg.type === 'auth.mode') {
            this.requiresPassword = Boolean(msg.data?.requiresPassword);
            this.ctx.storage.put('requiresPassword', this.requiresPassword).catch(() => {});
            for (const ws of this.ctx.getWebSockets('web')) {
                const att = ws.deserializeAttachment() || {};
                if (!this.requiresPassword) {
                    ws.serializeAttachment({ ...att, authenticated: true });
                } else if (!att.authenticated) {
                    ws.serializeAttachment({ ...att, authenticated: false });
                }
                this.broadcastAuthState(ws);
            }
            return;
        }

        const clientId = msg.data?.clientId;
        if (!clientId) return;
        const target = this.findWebSocket(clientId);
        if (!target) return;
        const att = target.deserializeAttachment() || {};

        if (msg.type === 'auth.grant') {
            target.serializeAttachment({ ...att, authenticated: true });

            // 单设备独占：踢掉其它已认证的 web
            for (const other of this.ctx.getWebSockets('web')) {
                if (other === target) continue;
                const oa = other.deserializeAttachment() || {};
                if (!oa.authenticated) continue;
                try {
                    other.serializeAttachment({ ...oa, authenticated: false });
                    other.send(JSON.stringify({
                        type: 'auth.state',
                        to: 'web',
                        data: {
                            authenticated: false,
                            requiresPassword: this.requiresPassword,
                            error: '已在另一台设备登录',
                            kicked: true,
                        },
                    }));
                } catch {}
                try { other.close(4001, 'superseded'); } catch {}
            }

            // 颁发免登录 token，30 天有效
            const sessionToken = this.issueAuthToken();
            try {
                target.send(JSON.stringify({
                    type: 'auth.state',
                    to: 'web',
                    data: {
                        authenticated: true,
                        requiresPassword: this.requiresPassword,
                        error: '',
                        sessionToken,
                    },
                }));
            } catch {}
            return;
        }

        if (msg.type === 'auth.reject') {
            target.serializeAttachment({ ...att, authenticated: false });
            this.broadcastAuthState(target, msg.data?.error || '密码错误');
            return;
        }

        if (msg.type === 'auth.close') {
            // 被锁：清掉所有免登录 token，强制全员重新密码
            this.clearAllAuthTokens();
            try {
                target.send(JSON.stringify({
                    type: 'auth.state',
                    to: 'web',
                    data: {
                        authenticated: false,
                        requiresPassword: this.requiresPassword,
                        error: msg.data?.error || '尝试过多，连接已关闭',
                        closed: true,
                    },
                }));
            } catch {}
            try { target.close(4003, 'too many auth attempts'); } catch {}
        }
    }

    findWebSocket(clientId) {
        for (const ws of this.ctx.getWebSockets('web')) {
            const att = ws.deserializeAttachment() || {};
            if (att.id === clientId) return ws;
        }
        return null;
    }

    route(msg) {
        const target = msg.to;
        let targets = [];

        if (target === 'all') {
            targets = this.ctx.getWebSockets();
        } else if (target === 'desktop' || target === 'web') {
            targets = this.ctx.getWebSockets(target);
            if (target === 'web') {
                targets = targets.filter((ws) => {
                    const att = ws.deserializeAttachment() || {};
                    return Boolean(att.authenticated);
                });
            }
        } else if (typeof target === 'string' && target.startsWith('web:')) {
            const ws = this.findWebSocket(target.slice(4));
            if (ws) targets = [ws];
        }

        if (!targets.length) return;
        const payload = JSON.stringify(msg);
        for (const ws of targets) {
            try {
                ws.send(payload);
            } catch {}
        }
    }

    broadcastAuthState(ws, error = '') {
        const att = ws.deserializeAttachment() || {};
        if (att.device !== 'web') return;
        try {
            ws.send(JSON.stringify({
                type: 'auth.state',
                to: 'web',
                data: {
                    authenticated: Boolean(att.authenticated),
                    requiresPassword: this.requiresPassword,
                    error,
                },
            }));
        } catch {}
    }

    broadcastDeviceStatus() {
        const payload = JSON.stringify({
            type: 'connection.devices',
            to: 'all',
            data: {
                devices: {
                    desktop: this.ctx.getWebSockets('desktop').length > 0 ? 'connected' : 'disconnected',
                    web: this.ctx.getWebSockets('web').length > 0 ? 'connected' : 'disconnected',
                },
            },
        });
        for (const ws of this.ctx.getWebSockets()) {
            try {
                ws.send(payload);
            } catch {}
        }
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/ws') {
            const sessionId = url.searchParams.get('session');
            if (!sessionId || sessionId === 'default') {
                return new Response('Missing session', { status: 400 });
            }
            const id = env.TERMINAL_SESSION_MANAGER.idFromName(sessionId);
            const stub = env.TERMINAL_SESSION_MANAGER.get(id);
            return stub.fetch(request);
        }

        return env.ASSETS.fetch(request);
    },
};
