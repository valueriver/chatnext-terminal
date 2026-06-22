// 历史组装:决定"这轮 LLM 看到什么"。
// 从 D1 拉对话历史 + 最近压缩摘要 + 窗口截断,拼成 messages 数组。
import { systemPrompt } from './prompt.js';
import { normalizeAgentMessages, truncateToolResult } from './utils.js';

export async function build(hub, chatId, { contextTurns = 100, device, toolResultMaxChars = 12000 } = {}) {
    const db = hub.db;

    // 最新一条压缩摘要(它之前的原始消息用摘要替代)
    const comp = await db.prepare(
        'SELECT summary, end_message_id FROM compactions WHERE chat_id = ? ORDER BY id DESC LIMIT 1',
    ).bind(chatId).first();
    const afterId = comp?.end_message_id || 0;

    const { results: rows } = await db.prepare(
        'SELECT role, body FROM messages WHERE chat_id = ? AND id > ? ORDER BY id ASC LIMIT ?',
    ).bind(chatId, afterId, contextTurns).all();

    const messages = [{ role: 'system', content: systemPrompt({ device }) }];
    if (comp?.summary) messages.push({ role: 'system', content: `【先前对话摘要】\n${comp.summary}` });
    for (const r of rows) {
        const body = safeParse(r.body);
        const m = body && typeof body === 'object' ? body : { role: r.role, content: String(r.body) };
        // 工具结果按上限截断,避免撑爆上下文(原始全文仍留在 D1)
        if (m.role === 'tool') m.content = truncateToolResult(m.content, { maxChars: toolResultMaxChars }).content;
        // 用户附件:把文件路径折进正文给模型(它可用 shell 读这些路径);附件字段本身不发给模型
        if (m.role === 'user' && Array.isArray(m.attachments) && m.attachments.length) {
            const refs = m.attachments.map((f) => `- ${f.name}: ${f.path}`).join('\n');
            m.content = `${m.content || ''}\n\n[用户上传的附件,在当前设备本地路径,可用 shell 读取]\n${refs}`.trim();
            delete m.attachments;
        }
        messages.push(m);
    }
    // 规整 tool_calls 与结果的配对,补缺、去孤儿、去前导 tool
    return normalizeAgentMessages(messages);
}

const safeParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
