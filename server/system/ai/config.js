// 模型配置：存于 roam.db 的 settings 表（KV）。设置页写入，agent 读取。
import { getSettings, setSettings } from '../settings/index.js';

function readConfig() {
    const s = getSettings();
    return {
        baseUrl: s.baseUrl || '',
        apiKey: s.apiKey || '',
        model: s.model || '',
        system: s.system || '',
        contextTurns: Number(s.contextTurns) || 100,
        compressThreshold: Number(s.compressThreshold) || 12000,
        toolResultMaxChars: Number(s.toolResultMaxChars) || 12000,
        compactPrompt: s.compactPrompt || '',
        upgradeTime: /^\d{2}:\d{2}$/.test(String(s.upgradeTime || '').trim()) ? s.upgradeTime.trim() : '07:00',
    };
}

function writeConfig(patch = {}) {
    setSettings(patch);
    return readConfig();
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
    return { apiUrl, apiKey: c.apiKey, model: c.model, system: c.system, contextTurns: c.contextTurns, compressThreshold: c.compressThreshold, toolResultMaxChars: c.toolResultMaxChars, compactPrompt: c.compactPrompt };
}

// 给 UI 的安全视图：不含明文 key，只给是否设置 + 预览
function publicView(c) {
    const k = String(c.apiKey || '');
    return {
        baseUrl: c.baseUrl || '',
        model: c.model || '',
        system: c.system || '',
        contextTurns: c.contextTurns ?? 100,
        compressThreshold: c.compressThreshold ?? 12000,
        toolResultMaxChars: c.toolResultMaxChars ?? 12000,
        compactPrompt: c.compactPrompt || '',
        upgradeTime: c.upgradeTime || '07:00',
        hasKey: Boolean(k),
        keyPreview: !k ? '' : (k.length <= 8 ? '已设置' : `${k.slice(0, 4)}····${k.slice(-4)}`),
    };
}

export { readConfig, writeConfig, getRunConfig, publicView, resolveApiUrl };
