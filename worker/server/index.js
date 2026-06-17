// Cloudflare Worker 入口：无状态中继。
// /ws → 按 session 路由到 OneSession（Durable Object）；其余 → 静态资源（ui/dist）。
export { OneSession } from './do/session.js';

function parseCookie(header, name) {
    if (!header) return '';
    const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : '';
}

function getSessionId(request) {
    const url = new URL(request.url);
    return url.searchParams.get('session')
        || parseCookie(request.headers.get('Cookie'), 'one_session')
        || '';
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/ws') {
            const sessionId = getSessionId(request);
            if (!sessionId || sessionId === 'default') return new Response('Missing session', { status: 400 });
            const stub = env.ONE_SESSION.get(env.ONE_SESSION.idFromName(sessionId));
            return stub.fetch(request);
        }

        // 首次带 ?session= 访问：种 cookie 后 301 到干净 URL
        const sessionParam = url.searchParams.get('session');
        if (sessionParam && sessionParam !== 'default') {
            const clean = new URL(url);
            clean.searchParams.delete('session');
            return new Response(null, {
                status: 301,
                headers: {
                    'Location': clean.toString(),
                    'Set-Cookie': `one_session=${encodeURIComponent(sessionParam)}; Path=/; SameSite=Lax; Secure; Max-Age=31536000`,
                },
            });
        }

        return env.ASSETS.fetch(request);
    },
};
