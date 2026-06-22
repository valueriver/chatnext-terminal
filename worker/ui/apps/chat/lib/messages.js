let keySeq = 0;

function mkKey(prefix = 'm') {
    keySeq += 1;
    return `${prefix}:${Date.now().toString(36)}:${keySeq}`;
}

function safeParse(value) {
    if (value && typeof value === 'object') return value;
    try {
        return JSON.parse(value || '{}');
    } catch {
        return { _raw: String(value || '') };
    }
}

function toolName(toolCall) {
    return toolCall?.function?.name || toolCall?.name || 'tool';
}

function toolArgs(toolCall) {
    // 实时事件:args 已是解析好的对象;历史(OpenAI 形状):function.arguments 是 JSON 字符串。
    if (toolCall?.args && typeof toolCall.args === 'object') return toolCall.args;
    return safeParse(toolCall?.function?.arguments ?? toolCall?.arguments ?? {});
}

function mapToolCall(toolCall, status = 'running') {
    const id = toolCall?.id || toolCall?.toolCallId || mkKey('tool-call-id');
    return {
        type: 'tool_call',
        role: 'tool',
        _key: mkKey('tool'),
        toolCallId: id,
        toolCall,
        name: toolName(toolCall),
        args: toolArgs(toolCall),
        result: '',
        status,
        expanded: false,
    };
}

function renderMessages(raw) {
    const rows = [];
    const toolRowsById = new Map();

    for (const message of (raw || [])) {
        if (message.role === 'user') {
            rows.push({ role: 'user', _key: mkKey('user'), content: message.content || '', attachments: Array.isArray(message.attachments) ? message.attachments : [] });
            continue;
        }

        if (message.role === 'assistant') {
            const text = String(message.content || '').trim();
            if (text) {
                rows.push({
                    role: 'assistant',
                    _key: mkKey('assistant'),
                    content: text,
                    usage: null,
                    streaming: false,
                });
            }
            for (const toolCall of (message.tool_calls || [])) {
                const row = mapToolCall(toolCall, 'done');
                toolRowsById.set(row.toolCallId, row);
                rows.push(row);
            }
            continue;
        }

        if (message.role === 'tool') {
            const row = toolRowsById.get(message.tool_call_id);
            if (row) {
                row.result = message.content || '';
                row.status = 'done';
            } else {
                rows.push({
                    type: 'tool_call',
                    role: 'tool',
                    _key: mkKey('tool'),
                    toolCallId: message.tool_call_id || '',
                    toolCall: null,
                    name: 'tool',
                    args: {},
                    result: message.content || '',
                    status: 'done',
                    expanded: false,
                });
            }
        }
    }

    return rows;
}

function isToolRow(row) {
    return row?.type === 'tool_call';
}

export { isToolRow, mapToolCall, mkKey, renderMessages, safeParse };
