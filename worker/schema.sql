-- One 云端库(D1)。单用户:整库即这个用户的数据,无 account_id。
-- 设备端原 ~/.one/one.db 的数据应用部分,迁到这里;另加 devices 表表达多设备。

-- ═══════════ 设置(全局 KV)═══════════
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''   -- pass_hash + 模型配置 apiUrl/model/apiKey…
);

-- ═══════════ 设备(这个用户的多台机器)═══════════
CREATE TABLE devices (
  id           TEXT PRIMARY KEY,           -- 机器 id
  name         TEXT NOT NULL DEFAULT '',   -- "MacBook-Air-2"
  secret_hash  TEXT NOT NULL DEFAULT '',   -- 设备注册密钥哈希
  capabilities TEXT NOT NULL DEFAULT '[]', -- 能干啥:shell/computer/browser(设备清单派生)
  last_seen    INTEGER,                    -- 最后心跳(在线状态活在 DO,这里只留痕)
  created_at   INTEGER NOT NULL
);

-- ═══════════ 数据应用 ═══════════
CREATE TABLE notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  content     TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '[]',
  color       TEXT NOT NULL DEFAULT 'yellow',  -- 便签颜色 white/yellow/blue/green/pink
  pinned      INTEGER NOT NULL DEFAULT 0,       -- 置顶
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_notes_created ON notes(id DESC);

CREATE TABLE outlines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER,                     -- 自引用树;根为 NULL
  sort        INTEGER NOT NULL DEFAULT 0,
  text        TEXT NOT NULL DEFAULT '',
  collapsed   INTEGER NOT NULL DEFAULT 0,
  done        INTEGER NOT NULL DEFAULT 0,       -- 完成态
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_outlines_parent ON outlines(parent_id, sort, id);

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
