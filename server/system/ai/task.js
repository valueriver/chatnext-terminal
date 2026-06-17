// 任务：无头的 AI 运行 —— 给应用调用的统一通道。
// app 调 createTask 立即拿到 taskId，后台跑同一套 agent loop，记录状态/过程/结果；
// waitTask 取回结果文本。进度经 WS 实时推送（task.update / task.event）。
//
// 应用调用示例（任意 server app）：
//   import { createTask, waitTask, parseTaskJson } from '../../system/ai/task.js';
//   const { taskId } = createTask({ name: 'notes-tidy', prompt: '把这些要点整理成提纲：…' });
//   const text = await waitTask(taskId);          // 等结果
//   const json = parseTaskJson(text);             // 需要 JSON 时
import ws from '../../channel.js';
import { getDb } from '../core/db.js';
import { chat } from './loop.js';
import { tools as allTools } from './tools.js';
import { getRunConfig } from './config.js';
import { buildSystemPrompt } from './prompt.js';

const controllers = new Map(); // taskId -> AbortController

function broadcast(type, data) { try { ws.broadcast(type, data); } catch { /* 无网页端连接也无妨 */ } }

function getTask(id) { return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) || null; }

function saveTaskMsg(taskId, message, source = 'ai') {
    getDb().prepare('INSERT INTO task_messages (task_id, message, source, created_at) VALUES (?, ?, ?, ?)')
        .run(taskId, JSON.stringify(message), source, Date.now());
}

function setStatus(taskId, status, extra = {}) {
    const sets = ['status = ?'];
    const vals = [status];
    if (extra.response !== undefined) { sets.push('response = ?'); vals.push(extra.response); }
    if (extra.error !== undefined) { sets.push('error = ?'); vals.push(extra.error); }
    if (status === 'done' || status === 'error' || status === 'aborted') { sets.push('finished_at = ?'); vals.push(Date.now()); }
    vals.push(taskId);
    getDb().prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    broadcast('task.update', { id: taskId, status, ...extra });
}

// tools 选择：'none'（默认，纯生成/解析）| 'all' | string[]（工具名子集）
function resolveToolset(tools) {
    if (tools === 'all') return allTools;
    if (Array.isArray(tools)) return allTools.filter((t) => tools.includes(t.function?.name));
    return [];
}

async function runTask(taskId, { messages, system, tools, responseFormat }) {
    let config;
    try { config = await getRunConfig(); }
    catch (err) { setStatus(taskId, 'error', { error: err.message }); return; }

    const controller = new AbortController();
    controllers.set(taskId, controller);
    setStatus(taskId, 'running');

    const sys = system != null ? String(system) : buildSystemPrompt(config);
    const modelMessages = [{ role: 'system', content: sys }, ...messages];
    let pendingAssistant = null;

    try {
        const { text } = await chat(modelMessages, {
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            model: config.model,
            toolset: resolveToolset(tools),
            responseFormat: responseFormat || null,
            toolResultMaxChars: config.toolResultMaxChars,
            signal: controller.signal,
            onEvent: (ev) => {
                if (ev.type === 'tool_calls') {
                    pendingAssistant = ev.message || null;
                    broadcast('task.event', { id: taskId, type: 'tool_calls', toolCalls: ev.message?.tool_calls || [] });
                } else if (ev.type === 'tool_results') {
                    const msgs = ev.messages || [];
                    if (pendingAssistant) saveTaskMsg(taskId, pendingAssistant, 'ai');
                    pendingAssistant = null;
                    for (const m of msgs) saveTaskMsg(taskId, m, 'tool');
                    broadcast('task.event', { id: taskId, type: 'tool_results', results: msgs.map((m) => ({ toolCallId: m.tool_call_id || '', content: m.content ?? '' })) });
                } else if (ev.type === 'done') {
                    if (ev.message) saveTaskMsg(taskId, ev.message, 'ai');
                }
            },
        });
        setStatus(taskId, 'done', { response: text || '' });
    } catch (err) {
        if (err?.name === 'AbortError') setStatus(taskId, 'aborted', {});
        else setStatus(taskId, 'error', { error: err.message || String(err) });
    } finally {
        controllers.delete(taskId);
    }
}

// 发起任务：同步返回 { taskId }，AI 在后台跑（fire-and-forget）。
function createTask({ name = 'task', prompt = '', messages = null, system = null, tools = 'none', responseFormat = null } = {}) {
    const db = getDb();
    const now = Date.now();
    const msgs = Array.isArray(messages) && messages.length ? messages : [{ role: 'user', content: String(prompt || '') }];
    const promptText = msgs.find((m) => m.role === 'user')?.content || '';
    const info = db.prepare('INSERT INTO tasks (name, prompt, status, created_at) VALUES (?, ?, ?, ?)')
        .run(String(name), String(promptText), 'pending', now);
    const taskId = Number(info.lastInsertRowid);
    for (const m of msgs) saveTaskMsg(taskId, m, m.role === 'user' ? 'user' : 'ai');
    broadcast('task.update', { id: taskId, status: 'pending' });
    void runTask(taskId, { messages: msgs, system, tools, responseFormat });
    return { taskId };
}

// 等任务完成，返回结果文本；失败/中止/超时抛错。
function waitTask(taskId, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
        const t0 = Date.now();
        const tick = () => {
            const task = getTask(taskId);
            if (!task) { reject(new Error('任务不存在')); return; }
            if (task.status === 'done') { resolve(task.response || ''); return; }
            if (task.status === 'error') { reject(new Error(task.error || '任务失败')); return; }
            if (task.status === 'aborted') { reject(new Error('任务已中止')); return; }
            if (Date.now() - t0 > timeoutMs) { reject(new Error('任务超时')); return; }
            setTimeout(tick, 250);
        };
        tick();
    });
}

// 容错 JSON 解析（任务输出 JSON 时用）。
function parseTaskJson(text) {
    const s = String(text || '').trim();
    try { return JSON.parse(s); } catch { /* 继续兜底 */ }
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* 放弃 */ } }
    return { content: s };
}

function abortTask(taskId) {
    const c = controllers.get(taskId);
    if (c) { c.abort(); controllers.delete(taskId); }
    const task = getTask(taskId);
    if (task && (task.status === 'pending' || task.status === 'running')) setStatus(taskId, 'aborted', {});
    return { ok: true };
}

export { createTask, waitTask, parseTaskJson, abortTask, getTask };
