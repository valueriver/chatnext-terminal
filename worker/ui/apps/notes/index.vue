<script setup>
import { onMounted, ref } from 'vue';
import { useNotesStore } from './store';
import ControlCenter from '@/system/components/ControlCenter.vue';

const notes = useNotesStore();
const input = ref('');
const editingId = ref(null);
const editingText = ref('');
const editEl = ref(null);

async function send() {
    const text = input.value.trim();
    if (!text) return;
    await notes.save({ content: text, pinned: 0 });
    input.value = '';
}

function startEdit(n) {
    editingId.value = n.id;
    editingText.value = n.content;
    setTimeout(() => editEl.value?.focus(), 0);
}

async function saveEdit(n) {
    const text = editingText.value.trim();
    if (text) await notes.save({ id: n.id, content: text, pinned: n.pinned });
    editingId.value = null;
}

function cancelEdit() { editingId.value = null; }

async function togglePin(n) {
    await notes.save({ id: n.id, content: n.content, pinned: n.pinned ? 0 : 1 });
}

async function del(n) {
    await notes.remove(n.id);
}

function relTime(ts) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const diff = Date.now() - t;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function onInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

onMounted(notes.load);
</script>

<template>
    <section class="view">
        <div class="toolbar">
            <div class="toolbar-title">笔记</div>
            <ControlCenter />
        </div>

        <div class="scroll">
            <div class="inner">
                <!-- 输入区 -->
                <div class="composer-card">
                    <textarea v-model="input" class="composer-input" rows="3"
                        placeholder="写点什么… (Enter 发送, Shift+Enter 换行)"
                        @keydown="onInputKey"></textarea>
                    <div class="composer-bar">
                        <span class="composer-count">{{ input.length }}</span>
                        <button class="composer-send" :disabled="!input.trim()" @click="send">发送</button>
                    </div>
                </div>

                <!-- 列表 -->
                <div v-if="!notes.items.length && !notes.loading" class="empty">还没有笔记</div>

                <div v-for="n in notes.items" :key="n.id" class="note-item">
                    <div class="note-head">
                        <span class="note-time">{{ relTime(n.created_at) }}</span>
                        <span v-if="n.pinned" class="note-pin-badge">置顶</span>
                        <div class="note-ops">
                            <button class="note-op" @click="togglePin(n)">{{ n.pinned ? '取消置顶' : '置顶' }}</button>
                            <button class="note-op" @click="startEdit(n)">编辑</button>
                            <button class="note-op danger" @click="del(n)">删除</button>
                        </div>
                    </div>

                    <div v-if="editingId === n.id" class="note-editing">
                        <textarea ref="editEl" v-model="editingText" class="edit-textarea" rows="3"></textarea>
                        <div class="edit-actions">
                            <button class="edit-btn" @click="cancelEdit">取消</button>
                            <button class="edit-btn primary" @click="saveEdit(n)">保存</button>
                        </div>
                    </div>
                    <div v-else class="note-content">{{ n.content }}</div>
                </div>

                <div v-if="notes.hasMore" class="load-more-wrap">
                    <button class="load-more" :disabled="notes.loadingMore" @click="notes.loadMore">
                        {{ notes.loadingMore ? '加载中…' : '加载更多' }}
                    </button>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; min-height: 0; }

.toolbar { flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--bg); }
.toolbar-title { flex: 1; font-size: 15px; font-weight: 850; color: var(--ink); }

.scroll { flex: 1; overflow-y: auto; }
.inner { max-width: 640px; margin: 0 auto; padding: 16px 16px 40px; }

/* 输入区 */
.composer-card { background: var(--panel); border-radius: 16px; box-shadow: 0 2px 12px #0000000a; overflow: hidden; margin-bottom: 20px; }
.composer-input {
    width: 100%; border: none; background: transparent; resize: none; outline: none;
    padding: 14px 16px 0; color: var(--ink); font-size: 14px; line-height: 1.7;
}
.composer-input::placeholder { color: var(--muted); }
.composer-bar { display: flex; align-items: center; padding: 8px 12px; }
.composer-count { font-size: 11px; color: var(--muted); flex: 1; }
.composer-send {
    padding: 6px 16px; border-radius: 99px; font-size: 12.5px; font-weight: 700; color: #fff;
    background: var(--accent); transition: opacity .12s;
}
.composer-send:disabled { opacity: .35; cursor: default; }
.composer-send:not(:disabled):hover { filter: brightness(1.06); }

/* 列表 */
.empty { text-align: center; padding: 48px 0; color: var(--muted); font-size: 13px; }

.note-item { padding: 14px 0; border-bottom: 1px solid var(--line); }
.note-item:last-child { border-bottom: none; }

.note-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.note-time { font-size: 11px; color: var(--muted); font-weight: 500; }
.note-pin-badge { font-size: 10px; font-weight: 700; color: var(--accent-d); background: var(--accent-soft); padding: 1px 7px; border-radius: 99px; }
.note-ops { margin-left: auto; display: flex; gap: 2px; opacity: 0; transition: opacity .15s; }
.note-item:hover .note-ops { opacity: 1; }
.note-op { font-size: 11px; font-weight: 600; color: var(--muted); padding: 3px 8px; border-radius: 6px; }
.note-op:hover { background: var(--well); color: var(--ink); }
.note-op.danger:hover { color: var(--bad); }

.note-content { font-size: 13.5px; line-height: 1.8; color: var(--ink); white-space: pre-wrap; word-break: break-word; }

/* 编辑态 */
.note-editing { display: flex; flex-direction: column; gap: 8px; }
.edit-textarea {
    width: 100%; border: 1px solid var(--accent); border-radius: 10px; padding: 10px 12px;
    background: var(--panel); color: var(--ink); font-size: 13.5px; line-height: 1.7;
    resize: vertical; outline: none;
}
.edit-actions { display: flex; justify-content: flex-end; gap: 6px; }
.edit-btn { padding: 5px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; color: var(--muted); background: var(--well); }
.edit-btn:hover { color: var(--ink); }
.edit-btn.primary { background: var(--accent); color: #fff; }

/* 分页 */
.load-more-wrap { display: flex; justify-content: center; padding: 16px 0; }
.load-more { padding: 7px 18px; border-radius: 99px; border: 1px solid var(--line); background: var(--panel); color: var(--muted); font-size: 12px; font-weight: 600; }
.load-more:hover { color: var(--ink); border-color: var(--line2); }

@media (max-width: 760px) {
    .inner { padding: 12px 12px 32px; }
    .note-ops { opacity: 1; }
}
</style>
