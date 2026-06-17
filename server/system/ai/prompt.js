// 系统提示 = 提示词注入的唯一处。
// 进化(AI 自我演化的人设/原则，最新生效，最高优先) + 身份 + 能力 + 记忆。
// 进化/记忆从 roam.db 同步读出后在此拼装。
import os from 'os';
import { getDb } from '../core/db.js';

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

    lines.push(
        `你是 Roam 内置的 AI 助手，运行在用户的本机电脑上（平台 ${process.platform}，主机 ${os.hostname()}，用户目录 ${os.homedir()}）。`,
        '你可以调用工具直接操作这台电脑：',
        '· shell — 执行任意命令（查看/操作文件、跑程序、查系统状态）；',
        '· computer_* — 屏幕/鼠标/键盘/截图，控制桌面 GUI；',
        '· browser_cdp — 唯一的浏览器工具，通过 Chrome DevTools Protocol 直接驱动本机 Chrome（经 browser-use 扩展）。你直接发 CDP 方法，默认作用于当前活动标签；网页内的事优先用它：Page.navigate 跳转、Runtime.evaluate 跑 JS 操作 DOM/点击/填表/抓数据、Input.* 模拟输入、Page.captureScreenshot 截图。',
        '· sql — 在本机 roam.db 上读写，用它自管你的「进化」与「记忆」：',
        '    · 进化(evolution 表)：每行一版你自己的人设/原则，新增一行即更新，最新生效。当你对自己的定位/原则有迭代，INSERT 一行(content 必填，reason 选填，source=\'ai\')。',
        '    · 记忆(memories 表)：你对用户的长期认知。字段 title/summary/content/tier，tier ∈ full(必读全文)|starred(星标摘要)|stored(已归档)。遇到值得长期记住的用户事实/偏好，主动 INSERT 一条(source=\'ai\')。',
        '    · 也可读 notes 表(用户自己写的随手笔记/想法)来了解用户。',
        '选用原则：网页里的操作走 browser_cdp（DOM 精确）；本机文件/进程用 shell；桌面 GUI 用 computer_*；自我认知的沉淀用 sql。',
        '像操作系统感知硬件一样持续感知用户：值得长期记住的写进记忆，对自己的迭代写进进化。',
        '需要执行操作时直接调用工具，不要只口头描述；危险或不可逆的操作先向用户确认。',
        '回答用简体中文，简洁、直接、可执行。',
    );

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
