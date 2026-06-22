// 定时任务 tick:cron(scheduled)每分钟触发一次,跑到点的任务。
// 引擎只有一个:比对 cron → 复用 agent 跑 → 结果落 task_runs。设备可选。
import { runTurn } from './agent/loop.js';

// ── 极简 5 段 cron 匹配(UTC):分 时 日 月 周 ──
// 每段支持:* / */n / a / a-b / 逗号列表(以上任意组合)。周:0-6,0=周日。
function matchField(token, value, min, max) {
    return String(token).split(',').some((part) => {
        if (part === '*') return true;
        const step = part.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/);
        if (step) {
            const n = Number(step[2]);
            let lo = min, hi = max;
            if (step[1] !== '*') {
                const r = step[1].split('-').map(Number);
                lo = r[0]; hi = r.length > 1 ? r[1] : max;
            }
            return value >= lo && value <= hi && (value - lo) % n === 0;
        }
        const range = part.match(/^(\d+)-(\d+)$/);
        if (range) return value >= Number(range[1]) && value <= Number(range[2]);
        return Number(part) === value;
    });
}

export function cronMatch(expr, date) {
    const parts = String(expr || '').trim().split(/\s+/);
    if (parts.length !== 5) return false;
    const [mi, ho, dom, mo, dow] = parts;
    return (
        matchField(mi, date.getUTCMinutes(), 0, 59) &&
        matchField(ho, date.getUTCHours(), 0, 23) &&
        matchField(dom, date.getUTCDate(), 1, 31) &&
        matchField(mo, date.getUTCMonth() + 1, 1, 12) &&
        matchField(dow, date.getUTCDay(), 0, 6)
    );
}

const lastAssistant = async (db, chatId) => {
    const row = await db.prepare(
        "SELECT body FROM messages WHERE chat_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 1",
    ).bind(chatId).first();
    if (!row) return '';
    try { return String(JSON.parse(row.body)?.content || ''); } catch { return ''; }
};

// cron tick:跑所有到点且本分钟未跑过的启用任务。
export async function runDueTasks(hub) {
    const db = hub.db;
    const now = new Date();
    const minute = Math.floor(now.getTime() / 60000);

    const { results: tasks } = await db.prepare(
        'SELECT id, name, prompt, kind, cron, run_at, needs_device, last_run_minute FROM tasks WHERE enabled = 1',
    ).all();

    for (const t of tasks || []) {
        if (t.last_run_minute === minute) continue;       // 本分钟已跑,去重
        // 到点判定:once 看 run_at(空=尽快);cron 比对表达式
        const due = t.kind === 'once'
            ? (!t.run_at || now.getTime() >= Number(t.run_at))
            : cronMatch(t.cron, now);
        if (!due) continue;
        // 立刻占位本分钟,避免重叠 tick 重复触发;一次性任务跑完即停用
        await db.prepare('UPDATE tasks SET last_run_minute = ?, last_run_at = ?' + (t.kind === 'once' ? ', enabled = 0' : '') + ' WHERE id = ?')
            .bind(minute, now.getTime(), t.id).run();
        await runOne(hub, t).catch((e) => console.error('task run error', t.id, e?.message));
    }
}

// 手动/到点跑一个任务:需设备但离线 → skipped;否则复用 agent。
export async function runOne(hub, task) {
    const db = hub.db;
    const started = Date.now();

    if (task.needs_device && !hub.hasDevice()) {
        await db.prepare(
            'INSERT INTO task_runs (task_id, status, summary, started_at, finished_at) VALUES (?, ?, ?, ?, ?)',
        ).bind(task.id, 'skipped', '设备离线,跳过本次', started, Date.now()).run();
        return;
    }

    // 每次运行开一条对话(可点进去看完整过程)
    const chatId = crypto.randomUUID();
    await db.prepare('INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .bind(chatId, `⏰ ${task.name || '任务'}`, started, started).run();
    const runRes = await db.prepare(
        'INSERT INTO task_runs (task_id, status, summary, chat_id, started_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(task.id, 'running', '', chatId, started).run();
    const runId = Number(runRes.meta?.last_row_id) || 0;

    let status = 'done';
    let summary = '';
    try {
        await runTurn(hub, chatId, { text: task.prompt }, undefined);
        summary = (await lastAssistant(db, chatId)).slice(0, 2000);
        if (!summary) { status = 'error'; summary = '没有产出(可能模型未配置或被中断)'; }
    } catch (e) {
        status = 'error';
        summary = e?.message || String(e);
    }
    await db.prepare('UPDATE task_runs SET status = ?, summary = ?, finished_at = ? WHERE id = ?')
        .bind(status, summary, Date.now(), runId).run();
}
