import ws from './system/ws/index.js';
import router from './system/ws/dispatch.js';

import guard from './system/auth/index.js';
import terminal from './apps/terminal/index.js';
import cdpBridge from './system/browser/bridge.js';
import { startSchedule as startRevelation } from './apps/revelation/schedule.js';

async function boot() {
    console.log('🚀 正在启动 Roam Server...');

    // 本地浏览器 CDP 桥（127.0.0.1）：等 browser-use 扩展连上来，供 AI 的 browser_cdp 工具驱动 Chrome。
    cdpBridge.start();

    guard.bindOnGrant((clientId) => {
        terminal.sendSnapshotTo(clientId);
    });

    router.bindOnDevicesChanged((devices) => {
        if (devices?.web !== 'connected') return;
        console.log('🌐 网页端已接入当前会话');
        terminal.sendSnapshotAll();
        guard.sendAuthMode();
    });

    await terminal.ensureDefault();

    // 每天到设定时间产出「启示」（自我升级）。
    startRevelation();

    ws.init({
        onOpen: () => {
            guard.sendAuthMode();
            terminal.sendSnapshotAll();
        },
        onMessage: (msg) => router.dispatch(msg),
    });

    process.on('SIGINT', () => {
        console.log('\n🛑 正在关闭 Roam Server...');
        terminal.shutdown();
        ws.close();
        process.exit(0);
    });
}

boot().catch((err) => {
    console.error('❌ Roam Server 启动失败:', err.message);
    process.exit(1);
});
