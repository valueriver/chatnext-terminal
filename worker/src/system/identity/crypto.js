// 鉴权原语(Web Crypto):SHA-256 哈希 + 标准 JWT(HS256)签发/校验。
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (bytes) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlDecode = (seg) => {
    const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const encodeSegment = (obj) => b64url(enc.encode(JSON.stringify(obj)));
const decodeSegment = (seg) => JSON.parse(dec.decode(b64urlDecode(seg)));

const toHex = (buf) =>
    Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256(text) {
    return toHex(await crypto.subtle.digest('SHA-256', enc.encode(String(text))));
}

async function hmac(data, secret) {
    const key = await crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

const nowSec = () => Math.floor(Date.now() / 1000);
const DEFAULT_EXP = 30 * 24 * 3600; // 30 天

// 签发 JWT(HS256)。payload 自带业务字段(role / id 等),自动加 iat / exp。
export async function signJwt(payload, secret, { expSec = DEFAULT_EXP } = {}) {
    const head = encodeSegment({ alg: 'HS256', typ: 'JWT' });
    const body = encodeSegment({ ...payload, iat: nowSec(), exp: nowSec() + expSec });
    const sig = await hmac(`${head}.${body}`, secret);
    return `${head}.${body}.${sig}`;
}

// 校验 JWT:验签 + 验 exp。通过返回 payload,否则 null。
export async function verifyJwt(token, secret) {
    const [head, body, sig] = String(token || '').split('.');
    if (!head || !body || !sig) return null;
    if (sig !== await hmac(`${head}.${body}`, secret)) return null;
    let payload; try { payload = decodeSegment(body); } catch { return null; }
    if (payload.exp && nowSec() > payload.exp) return null;
    return payload;
}
