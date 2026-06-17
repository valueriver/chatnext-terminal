// chat.rename —— 重命名对话。
import * as store from '../store.js';
import { reply } from '../shared.js';
export default async function rename(d) {
    reply('chat.rename.result', d.reqId, { conversation: await store.renameChat(d.chatId, d.title) });
    return true;
}
