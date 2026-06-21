// 入口 + 工具循环。推进一个 turn:组装上下文 → 调 LLM(流式)→ 有 tool_calls 就执行 → 续,直到无工具。
//
// 形态说明:这里写成"一个 turn 内的 async 循环"。turn 进行期间 DO 处于活跃态(不空闲),
// 工具的等待经 hub.callDevice 的 Promise 挂起 —— 等设备的时间不烧 Worker CPU。
// ⚠️ 待硬化:跨休眠续跑(把循环状态落 store,设备结果事件唤醒后从断点继续)。
//   当前版本依赖 turn 期间 DO 常驻;长 turn 也 OK,但 DO 被驱逐则该 turn 中断。
import { stream } from './llm.js';
import { build } from './context.js';
import { execute } from './functions.js';
import { maybe as maybeCompact } from './compact.js';
import { tools } from './tools.js';
import { settings } from '../../system/settings.js';

const MAX_STEPS = 20; // 单 turn 工具往返上限,防失控

export async function runTurn(hub, chatId, userText) {
    // 单一直播通道:一条 chat.event 承载所有子事件,kind 判别。前端 stream reducer 直接消费,无翻译层。
    const emit = (kind, extra = {}) => hub.toWeb({ t: 'chat.event', chatId, kind, ...extra });

    const cfg = await loadConfig(hub);
    if (cfg.error) { emit('error', { content: cfg.error }); return; }

    emit('start');
    await persist(hub, chatId, { role: 'user', content: userText });

    for (let step = 0; step < MAX_STEPS; step++) {
        // 每次调 LLM 前都检测压缩。两种请求场景都覆盖:
        //   step 0 = 发消息;step 1+ = 工具结果续跑。依据是最近一条助手消息的真实用量。
        await maybeCompact(hub, chatId, cfg, emit).catch(() => {});

        const messages = await build(hub, chatId, { contextTurns: cfg.contextTurns, device: await hub.device(), toolResultMaxChars: cfg.toolResultMaxChars });

        let text = '';
        let calls = null;
        let usage = {};
        const gen = stream({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, model: cfg.model, messages, tools });
        for await (const ev of gen) {
            if (ev.type === 'text') { text += ev.delta; emit('message', { content: ev.delta }); }
            else if (ev.type === 'tool_call') calls = ev.calls;
            else if (ev.type === 'usage') usage = ev.usage || {};
        }
        if (usage && Object.keys(usage).length) emit('usage', { usage }); // 标注真实用量(空则不发)

        // 落助手这一轮(文本 + 可能的 tool_calls)+ 真实 token 用量(供下回合判压缩)
        await persist(hub, chatId, assistantMsg(text, calls), usage);

        if (!calls || !calls.length) break; // 没有工具 → turn 结束

        // 先广播本轮全部工具调用,再逐个执行并回结果
        emit('tool_calls', { toolCalls: calls.map((c) => ({ id: c.id, name: c.name, args: c.args })) });
        for (const call of calls) {
            let result;
            try { result = await execute(call.name, call.args, hub); }
            catch (e) { result = { error: e.message || String(e) }; }
            emit('tool_results', { results: [{ toolCallId: call.id, content: JSON.stringify(result) }] });
            await persist(hub, chatId, { role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
    }

    emit('done');
}

function assistantMsg(text, calls) {
    const m = { role: 'assistant', content: text || '' };
    if (calls?.length) {
        m.tool_calls = calls.map((c) => ({
            id: c.id, type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.args || {}) },
        }));
    }
    return m;
}

async function persist(hub, chatId, message, usage = {}) {
    await hub.db.prepare(
        'INSERT INTO messages (chat_id, role, body, usage, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(chatId, message.role, JSON.stringify(message), JSON.stringify(usage || {}), Date.now()).run();
    await hub.db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').bind(Date.now(), chatId).run();
}

async function loadConfig(hub) {
    const c = await settings(hub.db).all();
    const missing = [];
    if (!c.apiUrl) missing.push('API 地址');
    if (!c.apiKey) missing.push('API Key');
    if (!c.model) missing.push('模型');
    if (missing.length) return { error: `还没配置模型(缺:${missing.join('、')})。去设置填好再发消息。` };
    return {
        apiUrl: c.apiUrl, apiKey: c.apiKey, model: c.model,
        contextTurns: Number(c.contextTurns) || 100,
        compressThreshold: Number(c.compressThreshold) || 12000,
        toolResultMaxChars: Number(c.toolResultMaxChars) || 12000,
        compactPrompt: c.compactPrompt || '',
    };
}
