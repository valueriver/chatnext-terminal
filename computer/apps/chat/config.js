// 模型配置：~/.roam/model.json。agent 运行时从这里取 apiUrl/apiKey/model。
// 设置页（model.set）写入，agent（getRunConfig）读取，API Key 只留在本机。
import { promises as fsp } from 'fs';
import path from 'path';
import { ROOT, ensureDir } from './store.js';

const CONFIG_PATH = path.join(ROOT, 'model.json');
const DEFAULTS = { baseUrl: '', apiKey: '', model: '', system: '', contextTurns: 100 };

async function readConfig() {
    try {
        const v = JSON.parse(await fsp.readFile(CONFIG_PATH, 'utf8'));
        return { ...DEFAULTS, ...(v && typeof v === 'object' ? v : {}) };
    } catch {
        return { ...DEFAULTS };
    }
}

async function writeConfig(patch = {}) {
    await ensureDir();
    const next = { ...(await readConfig()) };
    for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        // 空 apiKey 视为「不改」，避免设置页回填掩码时把真 key 抹掉
        if (k === 'apiKey' && !String(v).trim()) continue;
        next[k] = v;
    }
    await fsp.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
    return next;
}

// baseUrl 末尾补成完整 completions 端点（已是完整端点则原样）
function resolveApiUrl(baseUrl) {
    const b = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!b) return '';
    if (b.endsWith('/chat/completions') || b.endsWith('/completions')) return b;
    return `${b}/chat/completions`;
}

// agent 运行配置；缺字段抛带 code 的错，交给上层提示用户去设置
async function getRunConfig() {
    const c = await readConfig();
    const apiUrl = resolveApiUrl(c.baseUrl);
    const missing = [];
    if (!apiUrl) missing.push('API 地址');
    if (!c.apiKey) missing.push('API Key');
    if (!c.model) missing.push('模型');
    if (missing.length) {
        const err = new Error(`还没配置模型（缺：${missing.join('、')}）。请到「设置 → 模型设置」填好后再发消息。`);
        err.code = 'model_settings_missing';
        throw err;
    }
    return { apiUrl, apiKey: c.apiKey, model: c.model, system: c.system, contextTurns: c.contextTurns };
}

// 给 UI 的安全视图：不含明文 key，只给是否设置 + 预览
function publicView(c) {
    const k = String(c.apiKey || '');
    return {
        baseUrl: c.baseUrl || '',
        model: c.model || '',
        system: c.system || '',
        contextTurns: c.contextTurns ?? 100,
        hasKey: Boolean(k),
        keyPreview: !k ? '' : (k.length <= 8 ? '已设置' : `${k.slice(0, 4)}····${k.slice(-4)}`),
    };
}

export { readConfig, writeConfig, getRunConfig, publicView, resolveApiUrl };
