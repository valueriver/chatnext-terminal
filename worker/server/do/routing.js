// 消息路由 + 设备状态广播。self = RoamSession 实例。
export function socketId() {
    return crypto.randomUUID();
}

export function findWebSocket(self, clientId) {
    for (const ws of self.ctx.getWebSockets('web')) {
        const att = ws.deserializeAttachment() || {};
        if (att.id === clientId) return ws;
    }
    return null;
}

// 按 msg.to 转发：all / desktop / web（仅已认证）/ web:<clientId>
export function route(self, msg) {
    const target = msg.to;
    let targets = [];

    if (target === 'all') {
        targets = self.ctx.getWebSockets();
    } else if (target === 'desktop' || target === 'web') {
        targets = self.ctx.getWebSockets(target);
        if (target === 'web') {
            targets = targets.filter((ws) => Boolean((ws.deserializeAttachment() || {}).authenticated));
        }
    } else if (typeof target === 'string' && target.startsWith('web:')) {
        const ws = findWebSocket(self, target.slice(4));
        if (ws) targets = [ws];
    }

    if (!targets.length) return;
    const payload = JSON.stringify(msg);
    for (const ws of targets) {
        try { ws.send(payload); } catch { /* 连接已断 */ }
    }
}

export function broadcastDeviceStatus(self) {
    const payload = JSON.stringify({
        type: 'connection.devices',
        to: 'all',
        data: {
            devices: {
                desktop: self.ctx.getWebSockets('desktop').length > 0 ? 'connected' : 'disconnected',
                web: self.ctx.getWebSockets('web').length > 0 ? 'connected' : 'disconnected',
            },
        },
    });
    for (const ws of self.ctx.getWebSockets()) {
        try { ws.send(payload); } catch { /* 连接已断 */ }
    }
}
