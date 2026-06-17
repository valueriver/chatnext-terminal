// chat.abort —— 中止运行中的对话。
import * as store from '../store.js';
import { reply, controllers, emit } from '../shared.js';
export default async function abort(d) {
    const c = controllers.get(d.chatId);
    if (c) { c.abort(); controllers.delete(d.chatId); }
    await store.setState(d.chatId, 'idle');
    emit('aborted', { chatId: d.chatId });
    reply('chat.abort.result', d.reqId, { ok: true, chatId: d.chatId });
    return true;
}
