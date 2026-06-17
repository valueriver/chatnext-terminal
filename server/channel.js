// 通道门面：传输无关。app 经此回推消息（broadcast/send），不关心是 relay 还是 local。
// index 启动时挂上具体 transport（setTransport）。本模块是叶子，不 import 任何 app，故无循环依赖。
let active = null;

export function setTransport(transport) { active = transport; }

export function send(message) { active?.send(message); }

export function sendToClient(clientId, type, data) {
    if (!clientId) return;
    send({ type, to: `web:${clientId}`, data });
}

export function broadcast(type, data) {
    send({ type, to: 'web', data });
}

export default { send, sendToClient, broadcast };
