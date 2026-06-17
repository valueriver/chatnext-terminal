// 进化 + 记忆：注入系统提示的内核（同步读 roam.db）。
//   evolution：每行一版系统提示词（AI 自我演化的人设/原则），最新生效。
//   memories：三层 tier —— full(必读全文) / starred(星标摘要) / stored(已存储，仅计数)。
import { getDb } from '../core/db.js';

function latestEvolution() {
    const row = getDb().prepare('SELECT content FROM evolution ORDER BY id DESC LIMIT 1').get();
    return row?.content || '';
}

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

export { latestEvolution, memoryContext };
