// 通道门面：传输无关。app 经此回推消息（broadcast/send），不关心有几条通道。
// 可同时挂多个 transport（本地 local + 远程 relay）——send 群发，各 transport 按 to 路由自己的客户端。
// 本模块是叶子，不 import 任何 app，故无循环依赖。
const transports = [];

export function addTransport(transport) { transports.push(transport); }

export function send(message) {
    for (const t of transports) t.send(message);
}

export function sendToClient(clientId, type, data) {
    if (!clientId) return;
    send({ type, to: `web:${clientId}`, data });
}

export function broadcast(type, data) {
    send({ type, to: 'web', data });
}

export default { send, sendToClient, broadcast };
