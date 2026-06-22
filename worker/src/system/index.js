// system 区路由:/system/<module>/<command>。基础系统层,各模块自带 api。
import identity from './identity/api.js';

const MODULES = { identity };

export default function systemRoutes(request, ctx) {
    const url = new URL(request.url);
    const [, mod, command] = url.pathname.slice(1).split('/'); // system / <mod> / <command>
    const m = MODULES[mod];
    if (!m) return Response.json({ error: `unknown system module: ${mod}` }, { status: 404 });
    return m(request, ctx, command);
}
