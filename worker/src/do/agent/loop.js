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
    const cfg = await loadConfig(hub);
    if (cfg.error) { hub.toWeb({ t: 'chat.error', chatId, error: cfg.error }); return; }

    await persist(hub, chatId, { role: 'user', content: userText });

    for (let step = 0; step < MAX_STEPS; step++) {
        // 每次调 LLM 前都检测压缩。两种请求场景都覆盖:
        //   step 0 = 发消息;step 1+ = 工具结果续跑。依据是最近一条助手消息的真实用量。
        await maybeCompact(hub, chatId, cfg).catch(() => {});

        const messages = await build(hub, chatId, { contextTurns: cfg.contextTurns, device: await hub.device(), toolResultMaxChars: cfg.toolResultMaxChars });

        let text = '';
        let calls = null;
        let usage = {};
        const gen = stream({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, model: cfg.model, messages, tools });
        for await (const ev of gen) {
            if (ev.type === 'text') { text += ev.delta; hub.toWeb({ t: 'chat.delta', chatId, delta: ev.delta }); }
            else if (ev.type === 'tool_call') calls = ev.calls;
            else if (ev.type === 'usage') usage = ev.usage || {};
        }

        // 落助手这一轮(文本 + 可能的 tool_calls)+ 真实 token 用量(供下回合判压缩)
        await persist(hub, chatId, assistantMsg(text, calls), usage);

        if (!calls || !calls.length) break; // 没有工具 → turn 结束

        // 执行每个工具,结果作为 tool 消息塞回
        for (const call of calls) {
            hub.toWeb({ t: 'chat.tool', chatId, call: { id: call.id, name: call.name, args: call.args } });
            let result;
            try { result = await execute(call.name, call.args, hub); }
            catch (e) { result = { error: e.message || String(e) }; }
            hub.toWeb({ t: 'chat.tool_result', chatId, callId: call.id, result });
            await persist(hub, chatId, { role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
    }

    hub.toWeb({ t: 'chat.done', chatId });
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
