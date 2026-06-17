// tasks.run —— 从 UI 手动发起任务（全部工具，当迷你 agent）。
import { createTask } from '../../../system/task.js';
import { reply } from '../shared.js';

export default function run(d) {
    const { taskId } = createTask({ name: String(d.name || '手动任务'), prompt: String(d.prompt || '') });
    reply('tasks.run.result', d.reqId, { ok: true, id: taskId });
    return true;
}
