// chat.list —— 列出对话（含运行态修正）。
import { reply, listChatsWithLiveState } from '../shared.js';
export default async function list(d) {
    reply('chat.list.result', d.reqId, { conversations: await listChatsWithLiveState() });
    return true;
}
