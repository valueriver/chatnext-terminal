// 启示 app：纯分发 + 每日调度（start）。
import { getSetting } from '../../system/settings/index.js';
import { generate } from './generate.js';
import { reply } from './shared.js';
import list from './commands/list.js';
import get from './commands/get.js';
import del from './commands/delete.js';
import run from './commands/run.js';

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'revelation.list': return list(d);
            case 'revelation.get': return get(d);
            case 'revelation.delete': return del(d);
            case 'revelation.run': return run(d);
            default: return false;
        }
    } catch (err) {
        console.error(`revelation 错误 [${t}]:`, err.message || err);
        reply('revelation.error', d.reqId, { ok: false, error: err.message || String(err) });
        return true;
    }
}

// 每日调度：常驻进程每分钟比对设置里的「启示时间」(本机时区)，到点跑一次。
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

export { handle, start };
export default { handle, start };
