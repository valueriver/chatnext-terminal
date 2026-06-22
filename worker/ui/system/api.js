// HTTP 客户端:统一 Bearer JWT。token 存 localStorage。
// REST 约定:GET 读,POST 建,PUT 改,DELETE 删。
import { useToastStore } from '@/system/stores/toast';

const TOKEN_KEY = 'one_token';

// 统一错误提示:很多调用处会 .catch 吞掉,这里先弹个 toast 保证用户有感知。
function toastError(msg) {
    try { useToastStore().show(msg, 2600); } catch { /* pinia 未就绪 */ }
}

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

// 退出登录 / token 失效:清 token 并硬跳登录页(整页重置,避免残留状态)
export function logout() {
    setToken('');
    try { window.location.assign('/guard'); } catch { /* ignore */ }
}

async function request(method, path, body) {
    let res;
    try {
        res = await fetch(path, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getToken()}`,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch (e) {
        toastError('网络错误,请检查连接');
        throw e;
    }
    if (res.status === 401) { logout(); throw new Error('未授权,请重新登录'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data.error || `请求失败(${res.status})`;
        toastError(msg);
        throw new Error(msg);
    }
    return data;
}

export const api = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body || {}),
    put: (path, body) => request('PUT', path, body || {}),
    del: (path) => request('DELETE', path),
};

// 是否已初始化(设过密码)。公开,无需 token。
export async function getState() {
    const res = await fetch('/system/identity/state');
    return res.json().catch(() => ({ hasPassword: true }));
}

// 首次设置密码 → 拿 token
export async function setup(password) {
    const res = await fetch('/system/identity/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password || '' }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.ok || !j.token) throw new Error(j.error || '设置失败');
    setToken(j.token);
    return true;
}

// 登录:口令换 JWT(不需要已有 token)
export async function login(password) {
    const res = await fetch('/system/identity/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password || '' }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.ok || !j.token) throw new Error(j.error || '登录失败');
    setToken(j.token);
    return true;
}
