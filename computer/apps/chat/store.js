// 多对话本地存储:node:sqlite 单库 ~/.roam/chats.db。
// roam 一贯「数据留在本机」,对话只落地到用户 home 下,不进仓库、不过 Worker。
// 用 SQLite 而非一对话一 JSON:DatabaseSync 调用同步,函数内读-改-写之间没有 await 间隙,
// 并发请求天然串行、写入走事务,根除了「两次写交错把文件拼坏」那类损坏。
// 字段精简:chats 只留 id/title/state/时间;messages 整条 AI message 存 JSON,顺序靠自增 id。
import { DatabaseSync } from 'node:sqlite';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';

const ROOT = path.join(os.homedir(), '.roam');
const DB_PATH = path.join(ROOT, 'chats.db');

let db = null;

function getDb() {
    if (db) return db;
    fs.mkdirSync(ROOT, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(`
        CREATE TABLE IF NOT EXISTS chats (
            id         TEXT PRIMARY KEY,
            title      TEXT NOT NULL DEFAULT '新对话',
            state      TEXT NOT NULL DEFAULT 'idle',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
            message    TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, id);
    `);
    return db;
}

// 兼容旧签名:有些调用点 await ensureDir()
async function ensureDir() { getDb(); }

function rowToMeta(r, messageCount) {
    return {
        id: r.id,
        title: r.title || '新对话',
        state: r.state || 'idle',
        createdAt: r.created_at || 0,
        updatedAt: r.updated_at || 0,
        ...(messageCount != null ? { messageCount } : {}),
    };
}

function messagesOf(d, chatId) {
    return d.prepare('SELECT message FROM messages WHERE chat_id = ? ORDER BY id').all(chatId)
        .map((r) => JSON.parse(r.message));
}

async function readChat(id) {
    const d = getDb();
    const r = d.prepare('SELECT * FROM chats WHERE id = ?').get(id);
    if (!r) return null;
    return { ...rowToMeta(r), messages: messagesOf(d, id) };
}

async function createChat(title) {
    const d = getDb();
    const now = Date.now();
    const chat = {
        id: randomUUID(),
        title: String(title || '').trim() || '新对话',
        state: 'idle',
        createdAt: now,
        updatedAt: now,
        messages: [],
    };
    d.prepare('INSERT INTO chats (id, title, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(chat.id, chat.title, 'idle', now, now);
    return chat;
}

// 列表只回元信息(不含完整消息体),按更新时间倒序
async function listChats() {
    const d = getDb();
    const rows = d.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS message_count
        FROM chats c ORDER BY c.updated_at DESC
    `).all();
    return rows.map((r) => rowToMeta(r, r.message_count || 0));
}

async function appendMessages(id, messages, extra = {}) {
    const d = getDb();
    const chat = d.prepare('SELECT * FROM chats WHERE id = ?').get(id);
    if (!chat) throw new Error('对话不存在');
    const now = Date.now();
    d.exec('BEGIN');
    try {
        const ins = d.prepare('INSERT INTO messages (chat_id, message, created_at) VALUES (?, ?, ?)');
        for (const m of messages) ins.run(id, JSON.stringify(m), now);
        const title = extra.title != null ? String(extra.title) : chat.title;
        d.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?').run(title, now, id);
        d.exec('COMMIT');
    } catch (e) {
        d.exec('ROLLBACK');
        throw e;
    }
    return readChat(id);
}

async function setState(id, state) {
    const d = getDb();
    const info = d.prepare('UPDATE chats SET state = ? WHERE id = ?').run(state, id);
    if (!info.changes) return null;
    return readChat(id);
}

async function renameChat(id, title) {
    const d = getDb();
    const chat = d.prepare('SELECT * FROM chats WHERE id = ?').get(id);
    if (!chat) throw new Error('对话不存在');
    const next = String(title || '').trim() || chat.title;
    d.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?').run(next, Date.now(), id);
    return readChat(id);
}

async function deleteChat(id) {
    const d = getDb();
    const info = d.prepare('DELETE FROM chats WHERE id = ?').run(id);
    return info.changes > 0;
}

// 分页读取:默认取最后 limit 条;before 给定(上一页的 firstIndex)则取它之前的 limit 条。
async function getPage(id, limit = 50, before = null) {
    const d = getDb();
    const chat = d.prepare('SELECT * FROM chats WHERE id = ?').get(id);
    if (!chat) return null;
    const total = d.prepare('SELECT COUNT(*) AS n FROM messages WHERE chat_id = ?').get(id).n;
    const end = (before == null || before < 0 || before > total) ? total : before;
    const lim = Math.max(1, Number(limit) || 50);
    const start = Math.max(0, end - lim);
    const messages = d.prepare('SELECT message FROM messages WHERE chat_id = ? ORDER BY id LIMIT ? OFFSET ?')
        .all(id, end - start, start).map((r) => JSON.parse(r.message));
    return {
        meta: { ...rowToMeta(chat), total },
        messages,
        firstIndex: start,
        hasMore: start > 0,
    };
}

export { ROOT, ensureDir, createChat, readChat, getPage, listChats, appendMessages, setState, renameChat, deleteChat };
