// chat.get —— 取某对话的一页消息。
import { reply, pageWithLiveState } from '../shared.js';
export default async function get(d) {
    const page = await pageWithLiveState(d.chatId, d.limit || 50, d.before ?? null);
    reply('chat.get.result', d.reqId, {
        chatId: d.chatId,
        conversation: page?.meta || null,
        messages: page?.messages || [],
        firstIndex: page?.firstIndex ?? 0,
        hasMore: page?.hasMore || false,
    });
    return true;
}
