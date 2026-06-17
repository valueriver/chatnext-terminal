// 自我升级：computer 是常驻进程，每分钟比对设置里的「启示时间」(本机时区)，
// 到点就跑当天的自我升级(读笔记/进化/记忆 → 升级进化 + 沉淀记忆 + 产出「启示」)。
// generate 内部按天去重，多触发也安全。
import { getSetting } from './settings/index.js';
import { generate } from '../apps/revelation/index.js';

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
        console.error('自我升级 tick 失败：', err.message || err);
    }
}

function startSelfUpgrade() {
    if (timer) return;
    timer = setInterval(tick, 60 * 1000); // 每分钟检查一次
    console.log('🌅 自我升级已就绪（每天', upgradeTime(), '产出「启示」）');
}

export { startSelfUpgrade };
