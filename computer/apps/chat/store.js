// 多对话本地存储：~/.roam/chats/<id>.json，每个文件 = 一整段对话。
// roam 一贯「数据留在本机」，对话也只落地到用户 home 下，不进仓库、不过 Worker。
import { promises as fsp } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'node:crypto';

const ROOT = path.join(os.homedir(), '.roam');
const CHATS_DIR = path.join(ROOT, 'chats');

async function ensureDir() {
    await fsp.mkdir(CHATS_DIR, { recursive: true });
}

function chatPath(id) {
    return path.join(CHATS_DIR, `${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
}

async function readChat(id) {
    try {
        const data = JSON.parse(await fsp.readFile(chatPath(id), 'utf8'));
        if (!Array.isArray(data.messages)) data.messages = [];
        return data;
    } catch {
        return null;
    }
}

async function writeChat(chat) {
    await ensureDir();
    chat.updatedAt = Date.now();
    await fsp.writeFile(chatPath(chat.id), JSON.stringify(chat, null, 2), 'utf8');
    return chat;
}

async function createChat(title) {
    await ensureDir();
    const now = Date.now();
    const chat = {
        id: randomUUID(),
        title: String(title || '').trim() || '新对话',
        createdAt: now,
        updatedAt: now,
        state: 'idle',
        messages: [],
    };
    return writeChat(chat);
}

// 列表只回元信息（不含完整消息体），按更新时间倒序
async function listChats() {
    await ensureDir();
    let files;
    try { files = await fsp.readdir(CHATS_DIR); } catch { return []; }
    const metas = [];
    for (const f of files) {
        if (!f.endsWith('.json')) continue;
        try {
            const data = JSON.parse(await fsp.readFile(path.join(CHATS_DIR, f), 'utf8'));
            metas.push({
                id: data.id,
                title: data.title || '新对话',
                createdAt: data.createdAt || 0,
                updatedAt: data.updatedAt || 0,
                state: data.state || 'idle',
                messageCount: Array.isArray(data.messages) ? data.messages.length : 0,
            });
        } catch {}
    }
    metas.sort((a, b) => b.updatedAt - a.updatedAt);
    return metas;
}

async function appendMessages(id, messages, extra = {}) {
    const chat = await readChat(id);
    if (!chat) throw new Error('对话不存在');
    for (const m of messages) chat.messages.push(m);
    Object.assign(chat, extra);
    return writeChat(chat);
}

async function setState(id, state) {
    const chat = await readChat(id);
    if (!chat) return null;
    chat.state = state;
    return writeChat(chat);
}

async function renameChat(id, title) {
    const chat = await readChat(id);
    if (!chat) throw new Error('对话不存在');
    chat.title = String(title || '').trim() || chat.title;
    return writeChat(chat);
}

async function deleteChat(id) {
    try { await fsp.unlink(chatPath(id)); return true; } catch { return false; }
}

// 分页读取：默认取最后 limit 条；before 给定（上一页的 firstIndex）则取它之前的 limit 条。
async function getPage(id, limit = 50, before = null) {
    const chat = await readChat(id);
    if (!chat) return null;
    const total = chat.messages.length;
    const end = (before == null || before < 0 || before > total) ? total : before;
    const start = Math.max(0, end - Math.max(1, Number(limit) || 50));
    return {
        meta: { id: chat.id, title: chat.title, createdAt: chat.createdAt, updatedAt: chat.updatedAt, state: chat.state, total },
        messages: chat.messages.slice(start, end),
        firstIndex: start,
        hasMore: start > 0,
    };
}

export { ROOT, ensureDir, createChat, readChat, getPage, listChats, appendMessages, setState, renameChat, deleteChat };
