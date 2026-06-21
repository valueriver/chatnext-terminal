// HTTP 响应小工具。各 api 层共用。
export const json = (data, init = {}) =>
    new Response(JSON.stringify(data), {
        ...init,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init.headers || {}) },
    });

export const err = (message, status = 400) => json({ error: String(message) }, { status });

export const readJson = async (request) => {
    try { return await request.json(); } catch { return {}; }
};
