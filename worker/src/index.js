// Worker 入口 = 三区分发。按路径首段三选一,不掺业务:
//   /do/…     → AccountDO(实时:agent / 终端 / 屏幕,WS)
//   /system/… → 基础系统层(身份/设备)
//   /apps/…   → 云端数据应用(对话/设置,HTTP CRUD over D1)
//   其余      → 前端静态资源(ui/dist)
import systemRoutes from './system/index.js';
import appsRoutes from './apps/index.js';
import { verify } from './system/identity/service.js';

export { RoamHub } from './do/index.js';

// 自鉴权端点(用口令/设备密钥自证,不需要 JWT)
const PUBLIC = new Set([
    '/system/identity/state',
    '/system/identity/setup',
    '/system/identity/login',
    '/system/identity/register-device',
]);

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const area = url.pathname.slice(1).split('/')[0];

        // 实时:单用户 → 唯一 hub 实例(WS 在 DO 内验 ?token=)
        if (area === 'do') {
            return env.HUB.get(env.HUB.idFromName('roam')).fetch(request);
        }

        const ctx = { env, db: env.DB };

        // HTTP 鉴权:统一 Bearer JWT。public 端点放行,其余必须有效 token。
        if (area === 'system' || area === 'apps') {
            if (!PUBLIC.has(url.pathname)) {
                const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
                const payload = await verify(ctx, token);
                if (!payload) return Response.json({ error: 'unauthorized' }, { status: 401 });
                ctx.auth = payload;
            }
            return area === 'system' ? systemRoutes(request, ctx) : appsRoutes(request, ctx);
        }

        // 前端。HTML 永不缓存(带哈希的 js/css 自身 immutable),避免部署后仍吃旧页面。
        const res = await env.ASSETS.fetch(request);
        if (res.headers.get('content-type')?.includes('text/html')) {
            const r = new Response(res.body, res);
            r.headers.set('Cache-Control', 'no-cache');
            return r;
        }
        return res;
    },
};
