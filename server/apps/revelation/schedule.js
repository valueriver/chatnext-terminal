// 启示的每日调度：常驻进程每分钟比对设置里的「启示时间」(本机时区)，到点跑一次自我升级。
// generate 内部按天去重，多触发也安全。
import { getSetting } from '../../system/settings/index.js';
import { generate } from './index.js';

function localHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function upgradeTime() {
    const v = String(getSetting('upgradeTime', '07:00')).trim();
    return /^\d{2}:\d{2}$/.test(v) ? v : '07:00';
}

let timer = null;

async function tick() {
    try {
        if (localHHMM() !== upgradeTime()) return;
        await generate();
    } catch (err) {
        console.error('启示调度 tick 失败：', err.message || err);
    }
}

function startSchedule() {
    if (timer) return;
    timer = setInterval(tick, 60 * 1000); // 每分钟检查一次
    console.log('🌅 启示已就绪（每天', upgradeTime(), '自我升级产出）');
}

export { startSchedule };
