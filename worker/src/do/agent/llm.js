// 基础:OpenAI 兼容客户端 + 流式解析。
// stream() 是 async generator,逐块吐出:
//   { type:'text', delta }           助手文本增量
//   { type:'tool_call', calls }      本轮要调的工具(累积完整后一次性给)
//   { type:'usage', usage }          末块的真实 token 用量(total_tokens 等)
//   { type:'done', finish }          结束
export async function* stream({ apiUrl, apiKey, model, messages, tools }) {
    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, tools, stream: true, stream_options: { include_usage: true } }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const toolAcc = new Map(); // index -> {id,name,args}
    let buf = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const data = t.slice(5).trim();
            if (data === '[DONE]') { yield finalTools(toolAcc); return; }
            let json; try { json = JSON.parse(data); } catch { continue; }
            if (json.usage) yield { type: 'usage', usage: json.usage }; // 末块带真实 token 用量
            const d = json.choices?.[0]?.delta || {};
            if (d.content) yield { type: 'text', delta: d.content };
            for (const tc of d.tool_calls || []) {
                const cur = toolAcc.get(tc.index) || { id: '', name: '', args: '' };
                if (tc.id) cur.id = tc.id;
                if (tc.function?.name) cur.name = tc.function.name;
                if (tc.function?.arguments) cur.args += tc.function.arguments;
                toolAcc.set(tc.index, cur);
            }
            if (json.choices?.[0]?.finish_reason) yield finalTools(toolAcc);
        }
    }
}

function finalTools(acc) {
    if (!acc.size) return { type: 'done', finish: 'stop' };
    const calls = [...acc.values()].map((c) => ({
        id: c.id, name: c.name,
        args: safeParse(c.args),
    }));
    acc.clear();
    return { type: 'tool_call', calls };
}

const safeParse = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
