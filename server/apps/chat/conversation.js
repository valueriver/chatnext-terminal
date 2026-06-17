// 对话业务：多对话的增删查改 + 发送(流式跑 agent loop)。
import ws from '../../channel.js';
import { chat } from '../../system/ai/loop.js';
import { buildSystemPrompt } from '../../system/ai/prompt.js';
import { getRunConfig } from '../../system/ai/config.js';
import { maybeCompactBeforeRun } from './compactions.js';
import * as store from './store.js';

const controllers = new Map(); // chatId -> AbortController

// 发给模型前展开附件：带 attachments 的用户消息 → 在文本末尾附上文件路径，
// 让 AI 用 shell 自己去读（它就在本机）。不嵌内容、不走视觉。其余消息原样（剥掉 attachments 字段）。
function expandAttachments(msg) {
    if (msg?.role === 'user' && Array.isArray(msg.attachments) && msg.attachments.length) {
        const lines = msg.attachments
            .filter((a) => a?.path)
            .map((a, i) => `${i + 1}. ${a.name || 'file'}: ${a.path}`);
        if (!lines.length) { const { attachments, ...rest } = msg; return rest; }
        const content = `${String(msg.content || '')}\n\n【附件文件路径】\n请先读取这些文件内容，再结合用户问题回答。\n${lines.join('\n')}`;
        return { role: 'user', content };
    }
    if (msg?.attachments) { const { attachments, ...rest } = msg; return rest; }
    return msg;
}

function emit(kind, data) {
    ws.broadcast('chat.event', { kind, ...data });
}

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

async function listChatsWithLiveState() {
    const conversations = await store.listChats();
    const stale = [];
    for (const item of conversations) {
        if (item.state === 'running' && !controllers.has(item.id)) {
            item.state = 'idle';
            stale.push(item.id);
        }
    }
    stale.forEach((id) => store.setState(id, 'idle').catch(() => {}));
    return conversations;
}

async function pageWithLiveState(chatId, limit, before) {
    const page = await store.getPage(chatId, limit, before);
    if (page?.meta?.state === 'running' && !controllers.has(chatId)) {
        page.meta.state = 'idle';
        store.setState(chatId, 'idle').catch(() => {});
    }
    return page;
}

// 真正跑一轮对话：fire-and-forget，事件经 ws 流式推回。
async function runSend(d) {
    const chatId = String(d.chatId || '').trim();
    const content = String(d.content ?? '').trim();
    // 附件：前端已上传到本机 ~/.roam/files，这里只收 {name, path}（地址），最多 10 个。
    const attachments = (Array.isArray(d.attachments) ? d.attachments : [])
        .filter((a) => a && a.path && a.name)
        .map((a) => ({ name: String(a.name), path: String(a.path), size: Number(a.size) || 0 }))
        .slice(0, 10);
    if (!chatId) { emit('error', { content: '缺少 chatId' }); return; }

    const existing = await store.readChat(chatId);
    if (!existing) { emit('error', { chatId, content: '对话不存在' }); return; }
    if (!content && !attachments.length) return;

    if (controllers.has(chatId)) {
        controllers.get(chatId).abort();
        controllers.delete(chatId);
    }

    let config;
    try {
        config = await getRunConfig();
    } catch (err) {
        emit('error', { chatId, code: err.code || '', content: err.message });
        return;
    }

    const userMessage = { role: 'user', content };
    if (attachments.length) userMessage.attachments = attachments;
    const extra = {};
    if (existing.messages.length === 0 || existing.title === '新对话') {
        extra.title = (content || attachments[0]?.name || '附件').slice(0, 30);
    }
    await store.appendMessages(chatId, [userMessage], extra);
    emit('input', { chatId, message: userMessage, title: extra.title || null });
    await store.setState(chatId, 'running');
    emit('start', { chatId });

    const controller = new AbortController();
    controllers.set(chatId, controller);

    // 取历史：只取压缩点之后的消息
    const latestCompaction = store.getLatestCompaction(chatId);
    const afterId = Number(latestCompaction?.end_message_id || 0);
    const rows = store.listMessagesRaw(chatId, { afterId });
    const history = rows.map((r) => r.message);
    const latestUsage = rows.length ? rows[rows.length - 1].usage : {};
    const modelMessages = [{ role: 'system', content: buildSystemPrompt(config) }, ...history.map(expandAttachments)];

    // 发送前尝试压缩
    const emitFn = (ev) => emit(ev.type, { chatId, ...ev });
    try {
        await maybeCompactBeforeRun({ chatId, usage: latestUsage, settings: config, emit: emitFn, signal: controller.signal });
    } catch (e) {
        console.error('压缩失败(不影响对话):', e.message);
    }

    let pendingAssistant = null;
    let lastUsage = null;

    try {
        await chat(modelMessages, {
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            model: config.model,
            toolResultMaxChars: config.toolResultMaxChars,
            signal: controller.signal,
            onEvent: async (event) => {
                if (event.type === 'message') {
                    emit('message', { chatId, content: event.content || '' });
                } else if (event.type === 'tool_calls') {
                    pendingAssistant = event.message || null;
                    emit('tool_calls', { chatId, toolCalls: event.message?.tool_calls || [] });
                } else if (event.type === 'tool_results') {
                    const msgs = event.messages || [];
                    const toPersist = [pendingAssistant, ...msgs].filter(Boolean);
                    pendingAssistant = null;
                    if (toPersist.length) await store.appendMessages(chatId, toPersist, { meta: { source: 'ai' } });
                    emit('tool_results', {
                        chatId,
                        results: msgs.map((m) => ({ toolCallId: m.tool_call_id || '', content: m.content ?? '' })),
                    });
                } else if (event.type === 'usage') {
                    lastUsage = event.usage || {};
                    emit('usage', { chatId, usage: lastUsage });
                } else if (event.type === 'done') {
                    if (event.message) await store.appendMessages(chatId, [event.message], { usage: event.usage || lastUsage || {} });
                    emit('done', { chatId });
                }
            },
        });
    } catch (err) {
        if (err?.name === 'AbortError') emit('aborted', { chatId });
        else emit('error', { chatId, content: err.message || String(err) });
    } finally {
        controllers.delete(chatId);
        await store.setState(chatId, 'idle');
    }
}

async function handle(message) {
    const t = message.type;
    const d = message.data || {};
    try {
        switch (t) {
            case 'chat.list':
                reply('chat.list.result', d.reqId, { conversations: await listChatsWithLiveState() });
                return true;
            case 'chat.create':
                reply('chat.create.result', d.reqId, { conversation: await store.createChat(d.title) });
                return true;
            case 'chat.get': {
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
            case 'chat.rename':
                reply('chat.rename.result', d.reqId, { conversation: await store.renameChat(d.chatId, d.title) });
                return true;
            case 'chat.delete':
                if (controllers.has(d.chatId)) { controllers.get(d.chatId).abort(); controllers.delete(d.chatId); }
                reply('chat.delete.result', d.reqId, { ok: await store.deleteChat(d.chatId), chatId: d.chatId });
                return true;
            case 'chat.send':
                // 不 await：让循环在后台跑，dispatch 立即返回，chat.abort 等能并发处理
                runSend(d).catch((err) => console.error('chat.send 异常:', err?.message || err));
                return true;
            case 'chat.abort': {
                const c = controllers.get(d.chatId);
                if (c) { c.abort(); controllers.delete(d.chatId); }
                await store.setState(d.chatId, 'idle');
                emit('aborted', { chatId: d.chatId });
                reply('chat.abort.result', d.reqId, { ok: true, chatId: d.chatId });
                return true;
            }
            default:
                return false;
        }
    } catch (err) {
        console.error(`对话错误 [${t}]:`, err.message || err);
        reply('chat.error', d.reqId, { ok: false, error: err.message || String(err), chatId: d.chatId });
        return true;
    }
}

export { handle };
export default { handle };
