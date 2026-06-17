// Cloudflare Worker 入口：无状态中继。
// /ws → 按 session 路由到 RoamSession（Durable Object）；其余 → 静态资源（ui/dist）。
export { RoamSession } from './do/session.js';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/ws') {
            const sessionId = url.searchParams.get('session');
            if (!sessionId || sessionId === 'default') return new Response('Missing session', { status: 400 });
            const stub = env.ROAM_SESSION.get(env.ROAM_SESSION.idFromName(sessionId));
            return stub.fetch(request);
        }

        return env.ASSETS.fetch(request);
    },
};
