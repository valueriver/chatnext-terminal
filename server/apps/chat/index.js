// AI 服务：处理 ai.* / model.* 消息。
// - 多对话：ai.list / ai.create / ai.get / ai.rename / ai.delete
// - 发送：ai.send（流式经 ws.broadcast('ai.event') 推回所有已认证网页端）/ ai.abort
// - 模型配置：model.get / model.set（落地到 ~/.roam/model.json）
import ws from '../../system/ws/index.js';
import { chat } from './loop.js';
import { buildSystemPrompt } from './prompt.js';
import { getRunConfig, readConfig, writeConfig, publicView } from './config.js';
import * as store from './store.js';

const controllers = new Map(); // chatId -> AbortController

function emit(kind, data) {
    ws.broadcast('ai.event', { kind, ...data });
}

function reply(type, reqId, data) {
    ws.broadcast(type, { reqId, ...data });
}

// 真正跑一轮对话：fire-and-forget，事件经 ws 流式推回。
async function runSend(d) {
    const chatId = String(d.chatId || '').trim();
    const content = String(d.content ?? '').trim();
    if (!chatId) { emit('error', { content: '缺少 chatId' }); return; }

    const existing = await store.readChat(chatId);
    if (!existing) { emit('error', { chatId, content: '对话不存在' }); return; }
    if (!content) return;

    // 同一对话有正在跑的，先中断
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

    // 持久化用户消息；首条消息顺手当标题
    const userMessage = { role: 'user', content };
    const extra = {};
    if (existing.messages.length === 0 || existing.title === '新对话') {
        extra.title = content.slice(0, 30);
    }
    await store.appendMessages(chatId, [userMessage], extra);
    emit('input', { chatId, message: userMessage, title: extra.title || null });
    await store.setState(chatId, 'running');
    emit('start', { chatId });

    const controller = new AbortController();
    controllers.set(chatId, controller);

    const fresh = await store.readChat(chatId);
    const turns = Math.max(1, Number(config.contextTurns) || 100);
    const history = fresh.messages.slice(-turns * 4); // 粗略限长（每轮约含 user/assistant/tool 数条）
    const modelMessages = [{ role: 'system', content: buildSystemPrompt(config) }, ...history];

    // 延迟持久化：assistant(tool_calls) 等到对应 tool 结果一起落库；
    // 这样中途 abort 不会留下「有 tool_calls 却没有 tool 响应」的悬挂消息（下次请求会被模型 API 拒绝）。
    let pendingAssistant = null;

    try {
        await chat(modelMessages, {
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            model: config.model,
            temperature: config.temperature,
            signal: controller.signal,
            onEvent: async (event) => {
                if (event.type === 'message') {
                    emit('message', { chatId, content: event.content || '' });
                } else if (event.type === 'tool_calls') {
                    pendingAssistant = event.message || null; // 先不落库，等 tool_results 一起存
                    emit('tool_calls', { chatId, toolCalls: event.message?.tool_calls || [] });
                } else if (event.type === 'tool_results') {
                    const msgs = event.messages || [];
                    const toPersist = [pendingAssistant, ...msgs].filter(Boolean);
                    pendingAssistant = null;
                    if (toPersist.length) await store.appendMessages(chatId, toPersist);
                    emit('tool_results', {
                        chatId,
                        results: msgs.map((m) => ({ toolCallId: m.tool_call_id || '', content: m.content ?? '' })),
                    });
                } else if (event.type === 'usage') {
                    emit('usage', { chatId, usage: event.usage || {} });
                } else if (event.type === 'done') {
                    if (event.message) await store.appendMessages(chatId, [event.message]);
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
            case 'ai.list': {
                reply('ai.list.result', d.reqId, { conversations: await store.listChats() });
                return true;
            }
            case 'ai.create': {
                reply('ai.create.result', d.reqId, { conversation: await store.createChat(d.title) });
                return true;
            }
            case 'ai.get': {
                const page = await store.getPage(d.chatId, d.limit || 50, d.before ?? null);
                reply('ai.get.result', d.reqId, {
                    chatId: d.chatId,
                    conversation: page?.meta || null,
                    messages: page?.messages || [],
                    firstIndex: page?.firstIndex ?? 0,
                    hasMore: page?.hasMore || false,
                });
                return true;
            }
            case 'ai.rename': {
                reply('ai.rename.result', d.reqId, { conversation: await store.renameChat(d.chatId, d.title) });
                return true;
            }
            case 'ai.delete': {
                if (controllers.has(d.chatId)) { controllers.get(d.chatId).abort(); controllers.delete(d.chatId); }
                reply('ai.delete.result', d.reqId, { ok: await store.deleteChat(d.chatId), chatId: d.chatId });
                return true;
            }
            case 'ai.send': {
                // 不 await：让循环在后台跑，dispatch 立即返回，ai.abort 等消息能并发处理
                runSend(d).catch((err) => console.error('ai.send 异常:', err?.message || err));
                return true;
            }
            case 'ai.abort': {
                const c = controllers.get(d.chatId);
                if (c) { c.abort(); controllers.delete(d.chatId); }
                await store.setState(d.chatId, 'idle');
                reply('ai.abort.result', d.reqId, { ok: true, chatId: d.chatId });
                return true;
            }
            case 'model.get': {
                reply('model.get.result', d.reqId, { config: publicView(await readConfig()) });
                return true;
            }
            case 'model.set': {
                reply('model.set.result', d.reqId, { ok: true, config: publicView(await writeConfig(d.config || {})) });
                return true;
            }
            default:
                return false;
        }
    } catch (err) {
        console.error(`ai 错误 [${t}]:`, err.message || err);
        reply('ai.error', d.reqId, { ok: false, error: err.message || String(err), chatId: d.chatId });
        return true;
    }
}

export { handle };
export default { handle };
