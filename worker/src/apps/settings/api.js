// settings REST:GET /apps/settings 读配置 · PUT /apps/settings 改配置。基于 settings KV。
// 安全视图:不回 apiKey 明文,只给是否已设 + 预览;写入空 apiKey 视为不改。
import { settings, DEFAULTS } from '../../system/settings.js';

const EDITABLE = ['apiUrl', 'apiKey', 'model', 'system', 'contextTurns', 'compressThreshold', 'toolResultMaxChars'];

function publicView(all) {
    const k = String(all.apiKey || '');
    const view = {};
    for (const key of EDITABLE) if (key !== 'apiKey') view[key] = all[key] ?? DEFAULTS[key] ?? '';
    view.hasKey = Boolean(k);
    view.keyPreview = !k ? '' : (k.length <= 8 ? '已设置' : `${k.slice(0, 4)}····${k.slice(-4)}`);
    return view;
}

export default async function settingsApi(request, ctx) {
    const s = settings(ctx.db);

    if (request.method === 'GET') return Response.json({ config: publicView(await s.all()) });

    if (request.method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        for (const key of EDITABLE) {
            if (!(key in body)) continue;
            if (key === 'apiKey' && !String(body[key]).trim()) continue; // 空 = 不改
            await s.set(key, body[key]);
        }
        return Response.json({ config: publicView(await s.all()) });
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
