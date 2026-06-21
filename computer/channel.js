// 出口门面:app 经此把消息回推给 worker(再由 worker 转发网页端)。
// 单连接、单用户 → 不再区分 client,broadcast/sendToClient 都发往 worker。
import { send as connSend } from './connection.js';

export function send(message) { connSend(message); }
export function sendToClient(_clientId, type, data) { connSend({ type, data }); }
export function broadcast(type, data) { connSend({ type, data }); }

export default { send, sendToClient, broadcast };
