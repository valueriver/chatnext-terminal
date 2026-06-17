// chat.create —— 新建对话。
import * as store from '../store.js';
import { reply } from '../shared.js';
export default async function create(d) {
    reply('chat.create.result', d.reqId, { conversation: await store.createChat(d.title) });
    return true;
}
