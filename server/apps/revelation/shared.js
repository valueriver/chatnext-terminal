// revelation 共享：回包。
import ws from '../../channel.js';

export function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}
