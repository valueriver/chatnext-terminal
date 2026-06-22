// One 设备入口。设备 = worker 的一只手:启动本机服务(终端/CDP桥…)→ 连 worker → 听命执行。
import { startAll, stopAll, dispatch } from './registry.js';
import { start as connect, stop as disconnect } from './connection.js';
import { WORKER_URL, DEVICE_NAME, DEVICE_ID } from './system/env.js';

async function boot() {
    console.log('🚀 正在启动 One 设备...');
    await startAll();
    await connect({ onMessage: dispatch });
    console.log(`🔌 目标 worker: ${WORKER_URL}（设备 ${DEVICE_NAME} / ${DEVICE_ID}）`);

    process.on('SIGINT', () => {
        console.log('\n🛑 正在关闭...');
        stopAll();
        disconnect();
        process.exit(0);
    });
}

boot().catch((err) => {
    console.error('❌ 设备启动失败:', err.message);
    process.exit(1);
});
