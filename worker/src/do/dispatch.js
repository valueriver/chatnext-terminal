// 消息派发:浏览器 ↔ (本 DO) ↔ 设备。谁连进来了、消息发给谁,收口在这。
// 用 WebSocket Hibernation 的 tag 区分角色:'web' / 'device:<id>'。

export function makeDispatch(ctx) {
    const webSockets = () => ctx.getWebSockets('web');
    const deviceSockets = () => ctx.getWebSockets().filter((ws) =>
        tagsOf(ctx, ws).some((t) => t.startsWith('device:')));

    const send = (ws, msg) => { try { ws.send(JSON.stringify(msg)); } catch { /* 已断 */ } };

    return {
        // 推给所有网页端
        toWeb(msg) { for (const ws of webSockets()) send(ws, msg); },

        // 推给某台设备(没指定就第一台在线)
        toDevice(msg, deviceId) {
            const all = deviceSockets();
            const target = deviceId
                ? all.find((ws) => tagsOf(ctx, ws).includes(`device:${deviceId}`))
                : all[0];
            if (!target) return false;
            send(target, msg);
            return true;
        },

        hasDevice() { return deviceSockets().length > 0; },

        // 当前选中设备的 id(v1:第一台在线)。⚠️ 待加:网页端显式选设备
        currentDeviceId() {
            const ws = deviceSockets()[0];
            if (!ws) return null;
            const tag = tagsOf(ctx, ws).find((t) => t.startsWith('device:'));
            return tag ? tag.slice('device:'.length) : null;
        },
    };
}

const tagsOf = (ctx, ws) => { try { return ctx.getTags(ws) || []; } catch { return []; } };
