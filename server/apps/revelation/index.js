// 启示 = 自我升级的对外窗口。每天到设定时间由 selfupgrade 触发 generate()。
// 自我升级 = 读懂用户 → 升级自己(进化) → 产出当天的「启示」。无人值守，只放开 sql 工具。
import ws from '../../channel.js';
import { getDb } from '../../system/db.js';
import { getSetting } from '../../system/settings/index.js';
import { chat } from '../../system/ai/loop.js';
import { tools } from '../../system/ai/tools.js';
import { getRunConfig } from '../../system/ai/config.js';

const SQL_ONLY = tools.filter((t) => t.function?.name === 'sql');

const SYSTEM = `你是用户的「自我升级」——每天清晨整理过去、升级自己、并为他准备一份「启示」。你有 sql 工具，按顺序做：

1. 读懂他：用 sql 读 notes(笔记，他的动态/想法)、evolution(进化，你历来的自我提示词)、memories(记忆)，弄清他最近在想什么、在意什么、处境如何。
2. 升级自己：若今天有值得固化的认知或原则，用 sql 往 evolution 插一行(content=新的提示词片段，reason=原因，source='ai')——这就是你的进化，最新一版生效。没有就不插。
3. 沉淀记忆：遇到值得长期记住的用户事实/偏好，用 sql 往 memories 插一条。没有就不插。
4. 产出启示：最后输出给用户看的「启示」，用 markdown，标题清晰：

## 昨天到现在
从笔记/记忆里看出来的最近进展与变化。

## 今天的焦点
今天最该推进的一到三件事，以及为什么。

## 值得想一想
一个他可能没留意到的角度、连接或提醒。

## 今日一句
简短有力，像清晨递上的一句话。

真诚、聚焦、像懂他的老友。前面的 sql 操作不要解释，最后只输出启示正文。`;

// 本机日期 YYYY-MM-DD，用于一天一份去重
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
async function generate({ force = false } = {}) {
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
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `早。今天是 ${localLabel()}。完成今天的自我升级：读我的笔记、进化、记忆，该升级进化就升级、该记的记忆就记，最后给我今天的深度启示。` },
        ],
        { apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, model: cfg.model, toolset: SQL_ONLY, toolResultMaxChars: cfg.toolResultMaxChars },
    );
    if (!text || !text.trim()) return null;
    const info = db.prepare('INSERT INTO reports (day, content, created_at) VALUES (?, ?, ?)').run(day, text, Date.now());
    return Number(info.lastInsertRowid);
}

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

function listReports() {
    const items = getDb().prepare('SELECT id, day, substr(content,1,200) AS preview, created_at FROM reports ORDER BY id DESC LIMIT 200').all();
    return { items };
}
function getReport(id) {
    return getDb().prepare('SELECT * FROM reports WHERE id = ?').get(id) || null;
}
function deleteReport(id) {
    const info = getDb().prepare('DELETE FROM reports WHERE id = ?').run(id);
    return { ok: info.changes > 0 };
}

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'revelation.list':
                reply('revelation.list.result', d.reqId, { ok: true, ...listReports() });
                return true;
            case 'revelation.get':
                reply('revelation.get.result', d.reqId, { ok: true, report: getReport(d.id) });
                return true;
            case 'revelation.delete':
                reply('revelation.delete.result', d.reqId, { ...deleteReport(d.id) });
                return true;
            case 'revelation.run': {
                const id = await generate({ force: true });
                reply('revelation.run.result', d.reqId, { ok: Boolean(id), id: id || null });
                return true;
            }
            default:
                return false;
        }
    } catch (err) {
        console.error(`revelation 错误 [${t}]:`, err.message || err);
        reply('revelation.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

// 每日调度：常驻进程每分钟比对设置里的「启示时间」(本机时区)，到点跑一次自我升级。
let timer = null;
function upgradeTime() {
    const v = String(getSetting('upgradeTime', '07:00')).trim();
    return /^\d{2}:\d{2}$/.test(v) ? v : '07:00';
}
async function tick() {
    try {
        const d = new Date();
        const now = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        if (now === upgradeTime()) await generate();
    } catch (err) {
        console.error('启示调度 tick 失败：', err.message || err);
    }
}
function start() {
    if (timer) return;
    timer = setInterval(tick, 60 * 1000);
    console.log('🌅 启示已就绪（每天', upgradeTime(), '自我升级产出）');
}

export { handle, generate, start };
export default { handle, generate, start };
