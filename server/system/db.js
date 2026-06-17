// 本机单一 SQLite 库：~/.roam/roam.db。
// roam 一贯「数据留在本机」——对话、消息、压缩、设置全落地于此，不进仓库、不过 Worker。
// DatabaseSync 同步调用，函数内读-改-写之间无 await 间隙，并发请求天然串行，写入走事务。
import { DatabaseSync } from 'node:sqlite';
import os from 'os';
import path from 'path';
import fs from 'fs';

const ROOT = path.join(os.homedir(), '.roam');
const DB_PATH = path.join(ROOT, 'roam.db');

let db = null;

function getDb() {
    if (db) return db;
    fs.mkdirSync(ROOT, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
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
            meta       TEXT NOT NULL DEFAULT '{}',
            usage      TEXT NOT NULL DEFAULT '{}',
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, id);
        CREATE TABLE IF NOT EXISTS compactions (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id          TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
            start_message_id INTEGER NOT NULL,
            end_message_id   INTEGER NOT NULL,
            summary          TEXT NOT NULL,
            tokens           INTEGER NOT NULL DEFAULT 0,
            created_at       INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_compactions_chat ON compactions(chat_id, id);
        CREATE TABLE IF NOT EXISTS notes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            content    TEXT NOT NULL DEFAULT '',
            tags       TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(id DESC);
        CREATE TABLE IF NOT EXISTS evolution (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            content    TEXT NOT NULL,
            reason     TEXT NOT NULL DEFAULT '',
            source     TEXT NOT NULL DEFAULT 'ai',
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memories (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            title      TEXT NOT NULL DEFAULT '',
            summary    TEXT NOT NULL DEFAULT '',
            content    TEXT NOT NULL DEFAULT '',
            tier       TEXT NOT NULL DEFAULT 'stored',
            source     TEXT NOT NULL DEFAULT 'ai',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_memories_id ON memories(id DESC);
        CREATE TABLE IF NOT EXISTS reports (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            day        TEXT NOT NULL,
            content    TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reports_day ON reports(day);
        CREATE TABLE IF NOT EXISTS shortcuts (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            text       TEXT NOT NULL,
            sort       INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_shortcuts_sort ON shortcuts(sort, id);
        CREATE TABLE IF NOT EXISTS outline (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id  INTEGER,
            sort       INTEGER NOT NULL DEFAULT 0,
            text       TEXT NOT NULL DEFAULT '',
            collapsed  INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_outline_parent ON outline(parent_id, sort, id);
        CREATE TABLE IF NOT EXISTS tasks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL DEFAULT 'task',
            prompt      TEXT NOT NULL DEFAULT '',
            response    TEXT,
            status      TEXT NOT NULL DEFAULT 'pending',
            error       TEXT,
            created_at  INTEGER NOT NULL,
            finished_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, id);
        CREATE TABLE IF NOT EXISTS task_messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            message    TEXT NOT NULL,
            source     TEXT NOT NULL DEFAULT 'ai',
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_task_messages_task ON task_messages(task_id, id);
        CREATE TABLE IF NOT EXISTS schedules (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL DEFAULT '排程',
            prompt     TEXT NOT NULL DEFAULT '',
            mode       TEXT NOT NULL DEFAULT 'daily',   -- once | daily | interval
            at         TEXT NOT NULL DEFAULT '',         -- once: epoch ms; daily: 'HH:MM'; interval: 分钟数
            enabled    INTEGER NOT NULL DEFAULT 1,
            last_run   INTEGER,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS schedule_runs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_id INTEGER NOT NULL,
            task_id     INTEGER NOT NULL,
            created_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_schedule_runs ON schedule_runs(schedule_id, id);
    `);
    return db;
}

export { ROOT, DB_PATH, getDb };
export default { ROOT, DB_PATH, getDb };
