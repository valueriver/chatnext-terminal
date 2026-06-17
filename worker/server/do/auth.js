// 鉴权：访问密码开关 + 免登录 token + 桌面端的授权控制。self = RoamSession 实例。
import { findWebSocket } from './routing.js';

const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 天

export async function loadAuthState(self) {
    const v = await self.ctx.storage.get('requiresPassword');
    if (typeof v === 'boolean') self.requiresPassword = v;

    const tokens = await self.ctx.storage.get('authTokens');
    if (tokens && typeof tokens === 'object') {
        const now = Date.now();
        for (const [tok, exp] of Object.entries(tokens)) {
            if (typeof exp === 'number' && exp > now) self.authTokens.set(tok, exp);
        }
    }
}

async function persist(self) {
    const obj = {};
    for (const [tok, exp] of self.authTokens.entries()) obj[tok] = exp;
    try { await self.ctx.storage.put('authTokens', obj); } catch { /* 忽略持久化失败 */ }
}

export function issueAuthToken(self) {
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    self.authTokens.set(token, Date.now() + TOKEN_TTL);
    persist(self);
    return token;
}

export function isTokenValid(self, token) {
    if (!token) return false;
    const exp = self.authTokens.get(token);
    if (!exp) return false;
    if (exp <= Date.now()) {
        self.authTokens.delete(token);
        persist(self);
        return false;
    }
    return true;
}

export function clearAllAuthTokens(self) {
    self.authTokens.clear();
    persist(self);
}

export function broadcastAuthState(self, ws, error = '') {
    const att = ws.deserializeAttachment() || {};
    if (att.device !== 'web') return;
    try {
        ws.send(JSON.stringify({
            type: 'auth.state',
            to: 'web',
            data: { authenticated: Boolean(att.authenticated), requiresPassword: self.requiresPassword, error },
        }));
    } catch { /* 连接已断 */ }
}

// 桌面端的授权控制：auth.mode（密码开关）/ grant / reject / close
export function handleAuthControl(self, msg) {
    if (msg.type === 'auth.mode') {
        self.requiresPassword = Boolean(msg.data?.requiresPassword);
        self.ctx.storage.put('requiresPassword', self.requiresPassword).catch(() => {});
        for (const ws of self.ctx.getWebSockets('web')) {
            const att = ws.deserializeAttachment() || {};
            if (!self.requiresPassword) ws.serializeAttachment({ ...att, authenticated: true });
            else if (!att.authenticated) ws.serializeAttachment({ ...att, authenticated: false });
            broadcastAuthState(self, ws);
        }
        return;
    }

    const clientId = msg.data?.clientId;
    if (!clientId) return;
    const target = findWebSocket(self, clientId);
    if (!target) return;
    const att = target.deserializeAttachment() || {};

    if (msg.type === 'auth.grant') {
        target.serializeAttachment({ ...att, authenticated: true });

        // 单设备独占：踢掉其它已认证的 web
        for (const other of self.ctx.getWebSockets('web')) {
            if (other === target) continue;
            const oa = other.deserializeAttachment() || {};
            if (!oa.authenticated) continue;
            try {
                other.serializeAttachment({ ...oa, authenticated: false });
                other.send(JSON.stringify({
                    type: 'auth.state',
                    to: 'web',
                    data: { authenticated: false, requiresPassword: self.requiresPassword, error: '已在另一台设备登录', kicked: true },
                }));
            } catch { /* 连接已断 */ }
            try { other.close(4001, 'superseded'); } catch { /* 已关闭 */ }
        }

        const sessionToken = issueAuthToken(self);
        try {
            target.send(JSON.stringify({
                type: 'auth.state',
                to: 'web',
                data: { authenticated: true, requiresPassword: self.requiresPassword, error: '', sessionToken },
            }));
        } catch { /* 连接已断 */ }
        return;
    }

    if (msg.type === 'auth.reject') {
        target.serializeAttachment({ ...att, authenticated: false });
        broadcastAuthState(self, target, msg.data?.error || '密码错误');
        return;
    }

    if (msg.type === 'auth.close') {
        // 被锁：清掉所有免登录 token，强制全员重新输密码
        clearAllAuthTokens(self);
        try {
            target.send(JSON.stringify({
                type: 'auth.state',
                to: 'web',
                data: { authenticated: false, requiresPassword: self.requiresPassword, error: msg.data?.error || '尝试过多，连接已关闭', closed: true },
            }));
        } catch { /* 连接已断 */ }
        try { target.close(4003, 'too many auth attempts'); } catch { /* 已关闭 */ }
    }
}
