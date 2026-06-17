// Roam 本机后端入口。职责：启动各服务 → 开 WS 通道并分发。
// 通道由配置驱动：配了 CLOUDFLARE_WORKER_URL 就连 Worker（relay），没配就本地直连（local）。
// index 只做编排：不点名任何 app 的启动细节——各服务自己声明 start/stop（见 apps.js）。
import { CLOUDFLARE_WORKER_URL, SESSION_ID } from './system/core/env.js';
import { generateSessionId } from './system/core/ids.js';
import channel, { setTransport } from './channel.js';
import { routeToApp, startAll, stopAll } from './apps.js';
import { createRelay } from './transport/relay.js';
import { createLocal } from './transport/local.js';

// 生命周期总线：服务在 start(ctx) 时订阅，index 在时机到了广播。
const grantSubs = [];
const webSubs = [];
const ctx = {
    onGrant(fn) { grantSubs.push(fn); },
    emitGrant(clientId) { for (const f of grantSubs) f(clientId); },
    onWebConnected(fn) { webSubs.push(fn); },
    emitWebConnected() { for (const f of webSubs) f(); },
};

// 收消息：连接控制就地处理，其余按前缀分发到对应 app。
async function dispatch(message) {
    const t = message.type || '';
    if (t === 'connection.ping') { channel.send({ type: 'connection.pong', to: 'server', data: {} }); return; }
    if (t === 'connection.devices') {
        if (message.data?.devices?.web === 'connected') { console.log('🌐 网页端已接入当前会话'); ctx.emitWebConnected(); }
        return;
    }
    if (t === 'connection.ready') return;
    if (await routeToApp(message)) return;
    console.log('未识别的消息类型:', t);
}

async function boot() {
    console.log('🚀 正在启动 Roam Server...');

    // 拉起所有服务（CDP 桥 / 终端 / 鉴权 / 启示…各自的 start，自己订阅生命周期）
    await startAll(ctx);

    // 开 WS 通道：有远程配置走 relay，否则 local
    const sessionId = SESSION_ID || generateSessionId();
    const onReady = () => ctx.emitWebConnected(); // 通道就绪 → 给网页推初始状态
    const transport = CLOUDFLARE_WORKER_URL
        ? createRelay({ sessionId, onMessage: dispatch, onReady })
        : createLocal({ sessionId, onMessage: dispatch, onReady });
    setTransport(transport);
    transport.start();

    process.on('SIGINT', () => {
        console.log('\n🛑 正在关闭 Roam Server...');
        stopAll();
        transport.stop();
        process.exit(0);
    });
}

boot().catch((err) => {
    console.error('❌ Roam Server 启动失败:', err.message);
    process.exit(1);
});
