-- Roam 云端库(D1)。单用户 · 单设备:整库即这个用户的数据,无 account_id。
-- 设备配对信息存进 settings(单设备),不再有 devices 表。

-- ═══════════ 设置(全局 KV)═══════════
-- pass_hash + 模型配置(apiUrl/model/apiKey…)
-- + 单设备配对:device_name / device_secret_hash / device_capabilities
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- ═══════════ 笔记 ═══════════
CREATE TABLE notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  content     TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT 'yellow',
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_notes_created ON notes(id DESC);

-- ═══════════ 任务(云端定时 AI) ═══════════
CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL DEFAULT '',
  prompt          TEXT NOT NULL DEFAULT '',
  kind            TEXT NOT NULL DEFAULT 'cron',
  cron            TEXT NOT NULL DEFAULT '',
  run_at          INTEGER,
  enabled         INTEGER NOT NULL DEFAULT 1,
  needs_device    INTEGER NOT NULL DEFAULT 0,
  last_run_at     INTEGER,
  last_run_minute INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE task_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  chat_id     TEXT,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX idx_task_runs_task ON task_runs(task_id, id DESC);

-- ═══════════ 对话(直播在 DO,历史在 D1)═══════════
CREATE TABLE chats (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '新对话',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_chats_updated ON chats(updated_at DESC);

CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,               -- user / assistant / tool
  body        TEXT NOT NULL,               -- 消息 JSON(含 tool_calls / 结果)
  meta        TEXT NOT NULL DEFAULT '{}',
  usage       TEXT NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_messages_chat ON messages(chat_id, id);

CREATE TABLE compactions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id          TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  start_message_id INTEGER NOT NULL,
  end_message_id   INTEGER NOT NULL,
  summary          TEXT NOT NULL,
  tokens           INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL
);
CREATE INDEX idx_compactions_chat ON compactions(chat_id, id);

-- ═══════════ 快捷指令 ═══════════
CREATE TABLE shortcuts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  text        TEXT NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_shortcuts_sort ON shortcuts(sort, id);
