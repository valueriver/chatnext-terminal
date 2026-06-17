// Roam 本机后端入口。职责：启动主服务 → 挂应用 → 开 WS 通道并分发。
// 通道由配置驱动：配了 CLOUDFLARE_WORKER_URL 就连 Worker（relay），没配就本地直连（local）。
import { CLOUDFLARE_WORKER_URL, SESSION_ID } from './system/core/env.js';
import { generateSessionId } from './system/core/ids.js';
import channel, { setTransport } from './channel.js';
import { routeToApp } from './apps.js';
import { createRelay } from './transport/relay.js';
import { createLocal } from './transport/local.js';

import cdpBridge from './system/browser/bridge.js';
import guard from './system/auth/index.js';
import terminal from './apps/terminal/index.js';
import { startSchedule as startRevelation } from './apps/revelation/schedule.js';

// 设备状态变更回调（网页端接入时刷新快照/认证态）
let onDevicesChanged = () => {};

// 收到消息：连接控制就地处理，其余按前缀分发到对应 app。
async function dispatch(message) {
    const t = message.type || '';
    if (t === 'connection.ping') { channel.send({ type: 'connection.pong', to: 'server', data: {} }); return; }
    if (t === 'connection.devices') { onDevicesChanged(message.data?.devices); return; }
    if (t === 'connection.ready') return;
    if (await routeToApp(message)) return;
    console.log('未识别的消息类型:', t);
}

async function boot() {
    console.log('🚀 正在启动 Roam Server...');

    // 1. 启动主服务：本地 CDP 桥（给 browser-use 扩展连）
    cdpBridge.start();

    // 2. 挂应用的生命周期回调
    guard.bindOnGrant((clientId) => terminal.sendSnapshotTo(clientId));
    onDevicesChanged = (devices) => {
        if (devices?.web !== 'connected') return;
        console.log('🌐 网页端已接入当前会话');
        terminal.sendSnapshotAll();
        guard.sendAuthMode();
    };
    await terminal.ensureDefault();
    startRevelation(); // 每天到设定时间产出「启示」

    // 3. 开 WS 通道：有远程配置走 relay，否则 local
    const sessionId = SESSION_ID || generateSessionId();
    const onReady = () => { guard.sendAuthMode(); terminal.sendSnapshotAll(); };
    const transport = CLOUDFLARE_WORKER_URL
        ? createRelay({ sessionId, onMessage: dispatch, onReady })
        : createLocal({ sessionId, onMessage: dispatch, onReady });
    setTransport(transport);
    transport.start();

    process.on('SIGINT', () => {
        console.log('\n🛑 正在关闭 Roam Server...');
        terminal.shutdown();
        transport.stop();
        process.exit(0);
    });
}

boot().catch((err) => {
    console.error('❌ Roam Server 启动失败:', err.message);
    process.exit(1);
});
