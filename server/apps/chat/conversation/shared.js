// 对话子能力的共享：回包/广播 + 运行中控制器 + 历史/状态 helper。
import ws from '../../../channel.js';
import * as store from './store.js';

export const controllers = new Map(); // chatId -> AbortController

export function emit(kind, data) { ws.broadcast('chat.event', { kind, ...data }); }
export function reply(type, reqId, data) { ws.broadcast(type, { reqId, ...data }); }

// 发给模型前展开附件：带 attachments 的用户消息 → 在文本末尾附上文件路径，让 AI 用 shell 自己去读。
export function expandAttachments(msg) {
    if (msg?.role === 'user' && Array.isArray(msg.attachments) && msg.attachments.length) {
        const lines = msg.attachments.filter((a) => a?.path).map((a, i) => `${i + 1}. ${a.name || 'file'}: ${a.path}`);
        if (!lines.length) { const { attachments, ...rest } = msg; return rest; }
        const content = `${String(msg.content || '')}\n\n【附件文件路径】\n请先读取这些文件内容，再结合用户问题回答。\n${lines.join('\n')}`;
        return { role: 'user', content };
    }
    if (msg?.attachments) { const { attachments, ...rest } = msg; return rest; }
    return msg;
}

export async function listChatsWithLiveState() {
    const conversations = await store.listChats();
    const stale = [];
    for (const item of conversations) {
        if (item.state === 'running' && !controllers.has(item.id)) { item.state = 'idle'; stale.push(item.id); }
    }
    stale.forEach((id) => store.setState(id, 'idle').catch(() => {}));
    return conversations;
}

export async function pageWithLiveState(chatId, limit, before) {
    const page = await store.getPage(chatId, limit, before);
    if (page?.meta?.state === 'running' && !controllers.has(chatId)) {
        page.meta.state = 'idle';
        store.setState(chatId, 'idle').catch(() => {});
    }
    return page;
}
