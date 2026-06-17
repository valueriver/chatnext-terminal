// 系统提示的拼装处。文本在 prompts.js（唯一的家），这里只负责注入与拼装：
// 进化(AI 自我演化的人设/原则，最新生效，最高优先) + 身份能力 + 记忆 + 用户附加。
// 进化/记忆从 one.db 同步读出后在此拼接。
import { getDb } from '../db.js';
import { identity } from './prompts.js';

// 进化：每行一版系统提示词（AI 自我演化的人设/原则），最新生效。
function latestEvolution() {
    const row = getDb().prepare('SELECT content FROM evolution ORDER BY id DESC LIMIT 1').get();
    return row?.content || '';
}

// 记忆：三层 tier —— full(必读全文) / starred(星标摘要) / stored(已存储，仅计数)。
function memoryContext() {
    const rows = getDb().prepare('SELECT title, summary, content, tier FROM memories ORDER BY id DESC LIMIT 200').all();
    const full = rows.filter((m) => m.tier === 'full');
    const starred = rows.filter((m) => m.tier === 'starred');
    const stored = rows.filter((m) => m.tier !== 'full' && m.tier !== 'starred');
    const lines = [];
    if (full.length) {
        lines.push('【必读记忆(全文)】');
        for (const m of full) lines.push(`- ${m.title ? m.title + '：' : ''}${m.content || m.summary || ''}`);
    }
    if (starred.length) {
        lines.push('【星标记忆(摘要)】');
        for (const m of starred) lines.push(`- ${m.title ? m.title + '：' : ''}${m.summary || ''}`);
    }
    if (stored.length) lines.push(`【已存储记忆】另有 ${stored.length} 条已归档(需要时用 sql 查 memories 表)。`);
    return lines.join('\n');
}

function buildSystemPrompt(config = {}) {
    const lines = [];

    // 进化：你自己演化出的人设/原则（最新一版），最高优先
    const evo = latestEvolution();
    if (evo && evo.trim()) {
        lines.push(evo.trim());
        lines.push('——以上是你的「进化」(你自己演化出的人设与原则，最新一版)，最高优先遵循。——');
        lines.push('');
    }

    lines.push(identity());

    // 记忆：你对用户的长期认知
    const mem = memoryContext();
    if (mem && mem.trim()) {
        lines.push('');
        lines.push('【你的记忆】');
        lines.push(mem.trim());
    }

    const extra = String(config.system || '').trim();
    if (extra) { lines.push(''); lines.push(extra); }

    return lines.join('\n');
}

export { buildSystemPrompt };
