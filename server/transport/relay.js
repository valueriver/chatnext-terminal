// relay transport：配了 CLOUDFLARE_WORKER_URL 时，作为 client 主动连 Worker 中继。
// 提供统一接口：start / send / stop；收到的消息经 onMessage 交给 dispatch。
import WebSocket from 'ws';
import { SERVER_URL, WEB_URL, SESSION_PASSWORD, DEBUG } from '../system/core/env.js';

export function createRelay({ sessionId, onMessage, onReady }) {
    let ws = null;
    let timer = null;
    let printed = false;

    function printAccessInfo() {
        const webUrl = `${WEB_URL}/guard?${new URLSearchParams({ session: sessionId }).toString()}`;
        console.log('');
        console.log('✅ Roam 已连接');
        console.log('🔗 远程访问入口');
        console.log(`   ${webUrl}`);
        if (SESSION_PASSWORD) {
            console.log('');
            console.log('🔐 访问校验密码');
            console.log(`   ${SESSION_PASSWORD}`);
        }
        console.log('');
        console.log('📘 使用说明');
        console.log('   1. 在任意设备浏览器中打开上面的访问入口');
        console.log('   2. 如已设置访问密码，先输入密码再进入');
        console.log('   3. 首次进入后即可使用终端、文件、屏幕能力');
        console.log('');
    }

    function connect() {
        const params = new URLSearchParams({ session: sessionId, device: 'desktop' });
        ws = new WebSocket(`${SERVER_URL}/ws?${params.toString()}`);

        ws.on('open', () => {
            if (printed) console.log('✅ Roam 已重连');
            else { printAccessInfo(); printed = true; }
            onReady?.();
        });
        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }
            if (DEBUG) console.log(`[debug] recv ${msg.type}`, JSON.stringify(msg).slice(0, 200));
            onMessage?.(msg);
        });
        ws.on('close', () => {
            console.log('⚠️ Roam 连接已断开，3 秒后自动重连...');
            timer = setTimeout(connect, 3000);
        });
        ws.on('error', (err) => console.error('❌ 网络连接异常:', err.message));
    }

    return {
        name: 'relay',
        start: connect,
        send(message) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); },
        stop() { clearTimeout(timer); ws?.close(); },
    };
}
