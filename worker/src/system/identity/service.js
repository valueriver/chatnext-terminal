// 身份逻辑:访问口令校验 + 设备注册/列表。单用户,无账户概念。
// 鉴权:统一 Bearer JWT(HS256,secret 取自 env.AUTH_SECRET)。无状态,本地验签,不依赖本机。
//   - 网页端:口令 → web JWT
//   - 设备:  注册密钥 → device JWT(payload 带 id)
//   两者同款 JWT;HTTP 走 Authorization 头、WS 走 ?token=(见 index.js / do/index.js)。
import { settings } from '../settings.js';
import { sha256, signJwt, verifyJwt } from './crypto.js';
import * as repo from './repository.js';

export const secret = (ctx) => ctx.env.AUTH_SECRET || 'dev-insecure-secret';
export const verify = (ctx, token) => verifyJwt(token, secret(ctx));

// 首次引导:是否已设密码(决定前端去 /setup 还是 /guard)
export async function state(ctx) {
    const has = Boolean(await settings(ctx.db).get('pass_hash', ''));
    return { hasPassword: has };
}

// 首次设置密码(仅在未初始化时允许),设完直接发 token。
export async function setup(ctx, { password = '' }) {
    const s = settings(ctx.db);
    if (await s.get('pass_hash', '')) return { ok: false, error: '已初始化,请直接登录' };
    if (!String(password).trim()) return { ok: false, error: '请设置一个密码' };
    await s.set('pass_hash', await sha256(password));
    const token = await signJwt({ role: 'web' }, secret(ctx));
    return { ok: true, token };
}

// 网页端:口令换 JWT
export async function login(ctx, { password = '' }) {
    const stored = await settings(ctx.db).get('pass_hash', '');
    // 未设置口令 = 不校验(首次/可信网络),直接发 token
    if (stored && (await sha256(password)) !== stored) {
        return { ok: false, error: '口令错误' };
    }
    const token = await signJwt({ role: 'web' }, secret(ctx));
    return { ok: true, token };
}

// 设备:注册/更新自己 + 声明能力,换 device JWT。
// 已注册过的设备需密钥匹配;首次注册即设密钥(bootstrap)。
export async function registerDevice(ctx, { id, name = '', secret: deviceSecret = '', capabilities = [] }) {
    if (!id) return { ok: false, error: '缺少设备 id' };
    const existing = await repo.get(ctx.db, id);
    const incomingHash = deviceSecret ? await sha256(deviceSecret) : '';
    if (existing?.secret_hash && existing.secret_hash !== incomingHash) {
        return { ok: false, error: '设备密钥不匹配' };
    }
    await repo.upsert(ctx.db, { id, name, secretHash: incomingHash || existing?.secret_hash || '', capabilities }, Date.now());
    const token = await signJwt({ role: 'device', id }, secret(ctx));
    return { ok: true, token };
}

export async function listDevices(ctx) {
    const rows = await repo.list(ctx.db);
    return { devices: rows.map((d) => ({ ...d, capabilities: safeParse(d.capabilities) })) };
}

const safeParse = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
