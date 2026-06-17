// schedule.tasks —— 某排程触发过的任务列表（JOIN schedule_runs，不碰 tasks 内核）。
import { getDb } from '../../../system/db.js';
import { reply } from '../shared.js';
export default function tasks(d) {
    const items = getDb().prepare(
        `SELECT t.id, t.name, t.status, t.error, t.created_at, t.finished_at, substr(t.prompt,1,160) AS prompt
         FROM schedule_runs r JOIN tasks t ON t.id = r.task_id
         WHERE r.schedule_id = ? ORDER BY t.id DESC LIMIT 200`,
    ).all(d.scheduleId);
    reply('schedule.tasks.result', d.reqId, { ok: true, items });
    return true;
}
