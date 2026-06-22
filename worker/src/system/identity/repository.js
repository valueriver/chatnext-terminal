// 单设备配对信息 —— 存在 settings KV 里(不再有 devices 表)。
// 唯一一台设备:device_name / device_secret_hash / device_capabilities / device_last_seen。
import { settings } from '../settings.js';

const K = {
    name: 'device_name',
    secret: 'device_secret_hash',
    caps: 'device_capabilities',
    seen: 'device_last_seen',
};

const safeParse = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };

// 返回配对的设备;未配对返回 null。
export async function get(db) {
    const s = settings(db);
    const secretHash = await s.get(K.secret, '');
    const name = await s.get(K.name, '');
    if (!secretHash && !name) return null;
    return {
        name,
        secret_hash: secretHash,
        capabilities: safeParse(await s.get(K.caps, '[]')),
        last_seen: Number(await s.get(K.seen, '')) || null,
    };
}

export async function upsert(db, { name = '', secretHash = '', capabilities = [] }, now) {
    const s = settings(db);
    await s.set(K.name, String(name));
    await s.set(K.secret, String(secretHash));
    await s.set(K.caps, JSON.stringify(capabilities || []));
    await s.set(K.seen, String(now || ''));
}

export async function touch(db, now) {
    await settings(db).set(K.seen, String(now));
}

export async function remove(db) {
    const s = settings(db);
    await s.set(K.name, '');
    await s.set(K.secret, '');
    await s.set(K.caps, '[]');
    await s.set(K.seen, '');
}
