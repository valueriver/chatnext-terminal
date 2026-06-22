// Cloudflare Worker 入口：无状态中继。
// /:session/ws → 按 session 路由到 OneSession（Durable Object）；其余 → 静态资源（ui/dist）。
export { OneSession } from './do/session.js';

function extractSession(pathname) {
    const m = pathname.match(/^\/([^/]+)/);
    const id = m ? m[1] : '';
    return (id && id !== 'ws') ? id : '';
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const sessionId = extractSession(url.pathname);

        // /:session/ws → WebSocket 到 Durable Object
        if (sessionId && url.pathname === `/${sessionId}/ws`) {
            const stub = env.ONE_SESSION.get(env.ONE_SESSION.idFromName(sessionId));
            return stub.fetch(request);
        }

        // /:session/* → SPA（静态资源）
        if (sessionId) {
            // 把 /:session/xxx 重写为 /xxx 给 ASSETS 处理
            const assetPath = url.pathname.slice(sessionId.length + 1) || '/';
            const assetUrl = new URL(assetPath, url.origin);
            assetUrl.search = url.search;
            return env.ASSETS.fetch(new Request(assetUrl, request));
        }

        // 裸域根路径 → 返回提示
        if (url.pathname === '/' || url.pathname === '') {
            return new Response('One', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        // 其它路径 → 尝试静态资源
        return env.ASSETS.fetch(request);
    },
};
