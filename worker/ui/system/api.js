// HTTP 客户端:统一 Bearer JWT。token 存 localStorage。
// REST 约定:GET 读,POST 建,PUT 改,DELETE 删。
const TOKEN_KEY = 'one_token';

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

async function request(method, path, body) {
    const res = await fetch(path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401) { setToken(''); throw new Error('未授权,请重新登录'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
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
