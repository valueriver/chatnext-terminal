// chat.delete —— 删除对话（先中止运行中的）。
import * as store from '../store.js';
import { reply, controllers } from '../shared.js';
export default async function del(d) {
    if (controllers.has(d.chatId)) { controllers.get(d.chatId).abort(); controllers.delete(d.chatId); }
    reply('chat.delete.result', d.reqId, { ok: await store.deleteChat(d.chatId), chatId: d.chatId });
    return true;
}
