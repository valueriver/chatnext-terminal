// 排程器：常驻进程每分钟 tick，到点的排程调内核 createTask；一次性触发后自动停用。
// 排程与任务的血缘记在 schedule_runs（不碰 tasks 表、不动内核）。
import { getDb } from '../../system/db.js';
import { createTask } from '../../system/task.js';

let timer = null;
const pad = (n) => String(n).padStart(2, '0');
const sameDay = (a, b) => { const x = new Date(a); const y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };

// 是否到点。mode: once(at=epoch ms) / daily(at='HH:MM') / interval(at=分钟数)
function dueNow(s, now) {
    if (s.mode === 'once') return !s.last_run && Number(s.at) <= now;
    if (s.mode === 'daily') {
        const d = new Date(now);
        if (`${pad(d.getHours())}:${pad(d.getMinutes())}` !== String(s.at)) return false;
        return !(s.last_run && sameDay(s.last_run, now)); // 今天已触发则跳
    }
    if (s.mode === 'interval') {
        const mins = Number(s.at) || 0;
        if (mins <= 0) return false;
        if (!s.last_run) return true; // 首次立即
        return now - s.last_run >= mins * 60000;
    }
    return false;
}

async function tick() {
    const db = getDb();
    const now = Date.now();
    const list = db.prepare('SELECT * FROM schedules WHERE enabled = 1').all();
    for (const s of list) {
        if (!dueNow(s, now)) continue;
        try {
            const { taskId } = createTask({ name: s.name, prompt: s.prompt });
            db.prepare('INSERT INTO schedule_runs (schedule_id, task_id, created_at) VALUES (?, ?, ?)').run(s.id, taskId, now);
            db.prepare('UPDATE schedules SET last_run = ? WHERE id = ?').run(now, s.id);
            if (s.mode === 'once') db.prepare('UPDATE schedules SET enabled = 0 WHERE id = ?').run(s.id);
        } catch (e) { console.error('排程触发失败', s.id, e.message || e); }
    }
}

export function start() {
    if (timer) return;
    timer = setInterval(tick, 60 * 1000);
    console.log('🗓️ 排程已就绪（每分钟检查一次）');
}
