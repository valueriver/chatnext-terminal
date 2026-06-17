// 发送：跑一轮 agent loop，事件经 ws 流式推回（chat.event）。fire-and-forget。
import { chat } from '../../../system/ai/loop.js';
import { buildSystemPrompt } from '../../../system/ai/prompt.js';
import { getRunConfig } from '../../../system/ai/config.js';
import { maybeCompactBeforeRun } from './compactions.js';
import * as store from './store.js';
import { controllers, emit, expandAttachments } from './shared.js';

export async function runSend(d) {
    const chatId = String(d.chatId || '').trim();
    const content = String(d.content ?? '').trim();
    const attachments = (Array.isArray(d.attachments) ? d.attachments : [])
        .filter((a) => a && a.path && a.name)
        .map((a) => ({ name: String(a.name), path: String(a.path), size: Number(a.size) || 0 }))
        .slice(0, 10);
    if (!chatId) { emit('error', { content: '缺少 chatId' }); return; }

    const existing = await store.readChat(chatId);
    if (!existing) { emit('error', { chatId, content: '对话不存在' }); return; }
    if (!content && !attachments.length) return;

    if (controllers.has(chatId)) { controllers.get(chatId).abort(); controllers.delete(chatId); }

    let config;
    try { config = await getRunConfig(); }
    catch (err) { emit('error', { chatId, code: err.code || '', content: err.message }); return; }

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

    const latestCompaction = store.getLatestCompaction(chatId);
    const afterId = Number(latestCompaction?.end_message_id || 0);
    const rows = store.listMessagesRaw(chatId, { afterId });
    const history = rows.map((r) => r.message);
    const latestUsage = rows.length ? rows[rows.length - 1].usage : {};
    const modelMessages = [{ role: 'system', content: buildSystemPrompt(config) }, ...history.map(expandAttachments)];

    const emitFn = (ev) => emit(ev.type, { chatId, ...ev });
    try {
        await maybeCompactBeforeRun({ chatId, usage: latestUsage, settings: config, emit: emitFn, signal: controller.signal });
    } catch (e) { console.error('压缩失败(不影响对话):', e.message); }

    let pendingAssistant = null;
    let lastUsage = null;
    try {
        await chat(modelMessages, {
            apiUrl: config.apiUrl, apiKey: config.apiKey, model: config.model,
            toolResultMaxChars: config.toolResultMaxChars, signal: controller.signal,
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
                    emit('tool_results', { chatId, results: msgs.map((m) => ({ toolCallId: m.tool_call_id || '', content: m.content ?? '' })) });
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
