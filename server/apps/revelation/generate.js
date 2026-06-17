// 自我升级生成：读懂用户 → 升级进化 + 沉淀记忆 → 产出当天的「启示」。run 命令与每日调度共用。
// 无人值守自动跑，全部工具可用。
import { getDb } from '../../system/db.js';
import { chat } from '../../system/ai/loop.js';
import { getRunConfig } from '../../system/ai/config.js';
import { REVELATION_SYSTEM, revelationKickoff } from '../../system/ai/prompts.js';

const localDay = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const localLabel = () => {
    const d = new Date();
    const wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日(周${wk})`;
};

// 生成今天的启示(已存在则跳过)。返回 report id 或 null。
export async function generate({ force = false } = {}) {
    const day = localDay();
    const db = getDb();
    if (!force) {
        const existing = db.prepare('SELECT id FROM reports WHERE day = ?').get(day);
        if (existing) return existing.id;
    }
    let cfg;
    try { cfg = await getRunConfig(); } catch (err) { console.error('启示跳过：', err.message); return null; }

    const { text } = await chat(
        [
            { role: 'system', content: REVELATION_SYSTEM },
            { role: 'user', content: revelationKickoff(localLabel()) },
        ],
        { apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, model: cfg.model, toolResultMaxChars: cfg.toolResultMaxChars },
    );
    if (!text || !text.trim()) return null;
    const info = db.prepare('INSERT INTO reports (day, content, created_at) VALUES (?, ?, ?)').run(day, text, Date.now());
    return Number(info.lastInsertRowid);
}
