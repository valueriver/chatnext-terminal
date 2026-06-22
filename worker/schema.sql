-- Roam 云端库(D1)。单用户 · 单设备:整库即这个用户的数据,无 account_id。
-- 设备配对信息存进 settings(单设备),不再有 devices 表。

-- ═══════════ 设置(全局 KV)═══════════
-- pass_hash + 模型配置(apiUrl/model/apiKey…)
-- + 单设备配对:device_name / device_secret_hash / device_capabilities
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

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
