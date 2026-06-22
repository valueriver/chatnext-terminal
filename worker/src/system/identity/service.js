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

// 单设备:配对/更新这台设备 + 声明能力,换 device JWT。
// 已配对过需密钥匹配;首次配对即设密钥(bootstrap)。换新机器需先在设置解绑。
export async function registerDevice(ctx, { name = '', secret: deviceSecret = '', capabilities = [] }) {
    const existing = await repo.get(ctx.db);
    const incomingHash = deviceSecret ? await sha256(deviceSecret) : '';
    if (existing?.secret_hash && existing.secret_hash !== incomingHash) {
        return { ok: false, error: '设备密钥不匹配(已配对其它设备,先在设置里解绑)' };
    }
    await repo.upsert(ctx.db, { name, secretHash: incomingHash || existing?.secret_hash || '', capabilities }, Date.now());
    const token = await signJwt({ role: 'device' }, secret(ctx));
    return { ok: true, token };
}

// 返回这台配对设备(在线状态活在 DO,这里只反映配对与否)。未配对 → null。
export async function listDevices(ctx) {
    return { device: await repo.get(ctx.db) };
}
