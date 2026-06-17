// tasks.abort —— 中止任务。
import { abortTask } from '../../../system/task.js';
import { reply } from '../shared.js';

export default function abort(d) {
    reply('tasks.abort.result', d.reqId, { ...abortTask(d.id) });
    return true;
}
