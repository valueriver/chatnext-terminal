// 消息派发:浏览器 ↔ (本 DO) ↔ 这台设备。单设备,WS tag 只分 'web' / 'device'。

export function makeDispatch(ctx) {
    const webSockets = () => ctx.getWebSockets('web');
    const deviceSockets = () => ctx.getWebSockets('device');

    const send = (ws, msg) => { try { ws.send(JSON.stringify(msg)); } catch { /* 已断 */ } };

    return {
        // 推给所有网页端
        toWeb(msg) { for (const ws of webSockets()) send(ws, msg); },

        // 推给设备(唯一一台)。不在线返回 false。
        toDevice(msg) {
            const ws = deviceSockets()[0];
            if (!ws) return false;
            send(ws, msg);
            return true;
        },

        hasDevice() { return deviceSockets().length > 0; },
    };
}
