// 压缩处理:当最近一次 LLM 用量 total_tokens 超阈值时,用 LLM 摘要较早消息,写入 compactions。
// 之后 context.build 用摘要替代那段原始消息。token 来自真实 usage,不估算。
import { stream } from './llm.js';
import { COMPACTION_SYSTEM } from './prompt.js';

const totalTokens = (usage) => Number(usage?.total_tokens || 0) || 0;
const parse = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

// 保留后缀起点:至少留最后一条;若最后是 tool 结果,回溯到它对应的 assistant(tool_calls),不切断配对。
function keepSuffixStart(rows) {
    if (!rows.length) return 0;
    const last = parse(rows[rows.length - 1].body);
    if (last.role === 'tool') {
        for (let i = rows.length - 1; i >= 0; i--) {
            const m = parse(rows[i].body);
            if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) return i;
        }
    }
    return Math.max(0, rows.length - 1);
}

function serialize(rows) {
    return rows.map((r) => {
        const m = parse(r.body);
        const role = m.role || 'unknown';
        let content;
        if (role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
            content = [m.content || '', `tool_calls: ${JSON.stringify(m.tool_calls)}`].filter(Boolean).join('\n');
        } else if (role === 'tool') {
            content = `tool_call_id: ${m.tool_call_id || ''}\n${m.content || ''}`;
        } else {
            content = m.content || '';
        }
        return `#${r.id} ${role}\n${content}`;
    }).join('\n\n---\n\n');
}

export async function maybe(hub, chatId, cfg) {
    const threshold = Number(cfg.compressThreshold) || 12000;

    // 最近一条带用量的消息(即上一次助手回复)的真实 token
    const last = await hub.db.first(
        "SELECT usage FROM messages WHERE chat_id = ? AND usage != '{}' ORDER BY id DESC LIMIT 1", chatId,
    );
    const tokens = totalTokens(parse(last?.usage));
    if (!tokens || tokens < threshold) return false;

    const comp = await hub.db.first(
        'SELECT end_message_id FROM compactions WHERE chat_id = ? ORDER BY id DESC LIMIT 1', chatId,
    );
    const afterId = comp?.end_message_id || 0;
    const rows = await hub.db.all(
        'SELECT id, body FROM messages WHERE chat_id = ? AND id > ? ORDER BY id ASC', chatId, afterId,
    );
    const suffixStart = keepSuffixStart(rows);
    if (suffixStart <= 2) return false; // 太少不值得压

    const candidates = rows.slice(0, suffixStart);
    const startId = candidates[0].id;
    const endId = candidates[candidates.length - 1].id;

    const prompt = String(cfg.compactPrompt || '').trim() || COMPACTION_SYSTEM;
    let summary = '';
    let compTokens = 0;
    const gen = stream({
        apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, model: cfg.model,
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: `请压缩以下聊天消息：\n\n${serialize(candidates)}` },
        ],
        tools: [],
    });
    for await (const ev of gen) {
        if (ev.type === 'text') summary += ev.delta;
        else if (ev.type === 'usage') compTokens = totalTokens(ev.usage);
    }
    if (!summary.trim()) return false;

    await hub.db.run(
        'INSERT INTO compactions (chat_id, start_message_id, end_message_id, summary, tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        chatId, startId, endId, summary.trim(), compTokens, Date.now(),
    );
    return true;
}
