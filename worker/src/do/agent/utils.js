// 消息工具(取自 AIOS server/main/ai/utils.js,必要部分)。

// 工具结果太大时截断:保留头 70% + 尾 30%,中间标注截断字数。
export const truncateToolResult = (content, { enabled = true, maxChars = 12000 } = {}) => {
    const limit = Math.max(1000, Math.min(50000, Number(maxChars) || 12000));
    const text = String(content ?? '');
    if (!enabled || text.length <= limit) {
        return { content: text, truncated: false, originalLength: text.length };
    }
    const head = Math.floor(limit * 0.7);
    const tail = limit - head;
    const clipped = `${text.slice(0, head)}\n...[truncated ${text.length - limit} chars]...\n${text.slice(-tail)}`;
    return { content: clipped, truncated: true, originalLength: text.length };
};

// 规整发给 LLM 的消息序列,保证 tool_calls 与 tool 结果严格配对:
//   - 只保留合法 role;assistant 带 tool_calls 时按顺序紧跟其 tool 结果
//   - 缺失的 tool 结果补 TOOL_MISSING 占位;孤儿 tool 消息丢弃
//   - 去掉 system 之后的前导 tool 消息(否则部分 API 报错)
export const normalizeAgentMessages = (messages = []) => {
    if (!Array.isArray(messages)) return [];
    const validRoles = new Set(['system', 'user', 'assistant', 'tool']);
    const normalized = [];
    for (const item of messages) {
        if (!item || typeof item !== 'object') continue;
        const role = String(item.role || '').trim();
        if (!validRoles.has(role)) continue;
        const msg = { role };
        if (role === 'assistant' && Array.isArray(item.tool_calls)) {
            msg.content = item.content == null ? null : String(item.content);
            msg.tool_calls = item.tool_calls;
        } else {
            msg.content = item.content == null ? '' : String(item.content);
        }
        if (role === 'assistant' && item.reasoning_content !== undefined) {
            msg.reasoning_content = item.reasoning_content == null ? '' : String(item.reasoning_content);
        }
        if (role === 'tool' && item.tool_call_id) msg.tool_call_id = String(item.tool_call_id);
        if (role === 'assistant' && item.name) msg.name = String(item.name);
        if (role === 'tool' && item.name) msg.name = String(item.name);
        normalized.push(msg);
    }

    const toolMap = new Map();
    for (const msg of normalized) {
        if (msg.role === 'tool' && msg.tool_call_id) toolMap.set(msg.tool_call_id, msg);
    }
    const TOOL_MISSING = 'Tool call result is missing. The system may have been interrupted, restarted, timed out, or failed for another unknown reason.';
    const out = [];
    for (const msg of normalized) {
        if (msg.role === 'tool') continue;
        out.push(msg);
        if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
            for (const tc of msg.tool_calls) {
                const tcId = String(tc?.id || '').trim();
                if (!tcId) continue;
                const toolMsg = toolMap.get(tcId);
                if (toolMsg) { out.push(toolMsg); toolMap.delete(tcId); }
                else out.push({ role: 'tool', tool_call_id: tcId, content: TOOL_MISSING });
            }
        }
    }

    let firstNonSystem = out.findIndex((m) => m.role !== 'system');
    while (firstNonSystem >= 0 && out[firstNonSystem]?.role === 'tool') {
        out.splice(firstNonSystem, 1);
        firstNonSystem = out.findIndex((m) => m.role !== 'system');
    }
    return out;
};
