<script setup>
import { onMounted, ref, computed, watch, nextTick } from 'vue';
import { useNotesStore } from '@/apps/notes/store';
import { useWsStore } from '@/system/stores/ws';
import AppPanel from '@/system/components/AppPanel.vue';

const notes = useNotesStore();
const ws = useWsStore();

const COLORS = ['white', 'yellow', 'blue', 'green', 'pink'];
function noteColor(n, i) {
    const tags = parseTags(n);
    const ct = tags.find(t => t.startsWith('color:'));
    if (ct) return ct.split(':')[1];
    return COLORS[(i + 1) % COLORS.length];
}
function isPinned(n) { return parseTags(n).includes('pin'); }
function parseTags(n) { try { return JSON.parse(n.tags || '[]'); } catch { return []; } }
function buildTags(color, pin) {
    const t = [];
    if (color && color !== 'white') t.push(`color:${color}`);
    if (pin) t.push('pin');
    return JSON.stringify(t);
}

const filterText = ref('');
const sortedItems = computed(() => {
    let list = [...notes.items];
    if (filterText.value) {
        const q = filterText.value.toLowerCase();
        list = list.filter(n => (n.content || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => (isPinned(b) ? 1 : 0) - (isPinned(a) ? 1 : 0));
    return list;
});

// edit page state
const editing = ref(false);
const editId = ref(null);
const editContent = ref('');
const editColor = ref('yellow');
const editPin = ref(false);
const editorRef = ref(null);
const posting = ref(false);

function openNew() {
    editId.value = null;
    editContent.value = '';
    editColor.value = 'yellow';
    editPin.value = false;
    editing.value = true;
    nextTick(() => editorRef.value?.focus());
}
function openEdit(n, i) {
    editId.value = n.id;
    editContent.value = n.content || '';
    editColor.value = noteColor(n, i);
    editPin.value = isPinned(n);
    editing.value = true;
    nextTick(() => editorRef.value?.focus());
}
async function goBack() {
    if (!ws.canUseActions) { editing.value = false; return; }
    const content = editContent.value.trim();
    if (editId.value) {
        if (content) {
            posting.value = true;
            await notes.save({ id: editId.value, content, tags: buildTags(editColor.value, editPin.value) });
            posting.value = false;
        } else {
            await notes.remove(editId.value);
        }
    } else if (content) {
        posting.value = true;
        await notes.save({ content, tags: buildTags(editColor.value, editPin.value) });
        posting.value = false;
    }
    editing.value = false;
}
async function deleteEdit() {
    if (editId.value && ws.canUseActions) {
        await notes.remove(editId.value);
    }
    editing.value = false;
}
function togglePin() { editPin.value = !editPin.value; }

function fmt(ts) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const diff = Date.now() - t;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    const d = new Date(t);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function load() { if (ws.canUseActions) await notes.load(1); }
onMounted(load);
watch(() => ws.canUseActions, (v) => { if (v) load(); });
</script>

<template>
    <section class="view">
        <div class="flex items-center gap-2.5 shrink-0 px-4 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-1">
            <div class="flex-1 min-w-0 text-[15px] font-extrabold text-ink">笔记</div>
            <span class="text-[11px] font-bold text-muted">{{ notes.total }} 张</span>
            <AppPanel />
        </div>

        <!-- ===== 列表页 ===== -->
        <div v-if="!editing" class="page-wrap">
            <div class="page-inner">
                <!-- 搜索栏 -->
                <div class="note-search">
                    <svg class="note-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input v-model="filterText" placeholder="搜索笔记…" autocomplete="off" autocapitalize="off" spellcheck="false" class="note-search-input" />
                </div>

                <!-- 便签网格 -->
                <div class="note-grid">
                    <button v-for="(n, i) in sortedItems" :key="n.id"
                        class="sticky" :data-c="noteColor(n, i)"
                        @click="openEdit(n, i)">
                        <span v-if="isPinned(n)" class="sticky-pin">📌</span>
                        <div class="sticky-text">{{ n.content }}</div>
                        <span class="sticky-time">{{ fmt(n.created_at) }}</span>
                    </button>
                    <div v-if="!sortedItems.length" class="note-empty">
                        <div class="text-[28px] mb-2 opacity-50">{{ filterText ? '🔍' : '📝' }}</div>
                        <div class="text-[12.5px] text-muted">{{ filterText ? '没有找到' : (ws.canUseActions ? '还没有笔记' : '未连接') }}</div>
                    </div>
                </div>

                <!-- 分页 -->
                <div v-if="notes.pages > 1" class="flex items-center justify-center gap-3.5 mt-5 text-muted text-[13px]">
                    <button class="note-page-btn" :disabled="notes.page <= 1" @click="notes.load(notes.page - 1)">上一页</button>
                    <span>{{ notes.page }} / {{ notes.pages }}</span>
                    <button class="note-page-btn" :disabled="notes.page >= notes.pages" @click="notes.load(notes.page + 1)">下一页</button>
                </div>
            </div>

            <!-- FAB -->
            <button v-if="ws.canUseActions" class="note-fab" @click="openNew">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
        </div>

        <!-- ===== 编辑页 ===== -->
        <div v-else class="page-wrap">
            <div class="page-inner note-edit-page">
                <div class="flex items-center gap-3 mb-3">
                    <button class="note-back" @click="goBack">← 返回</button>
                    <div class="flex-1 text-[15px] font-extrabold text-ink">{{ editId ? '编辑笔记' : '新建笔记' }}</div>
                    <button class="note-act" :class="{ 'pin-on': editPin }" @click="togglePin">📌 置顶</button>
                    <button v-if="editId" class="note-act del" @click="deleteEdit">删除</button>
                </div>

                <!-- 颜色选择 -->
                <div class="flex gap-2 mb-4">
                    <button v-for="c in COLORS" :key="c"
                        class="note-cdot" :data-c="c" :class="{ on: editColor === c }"
                        @click="editColor = c"></button>
                </div>

                <!-- 编辑区域 -->
                <div class="note-editor-wrap">
                    <textarea ref="editorRef" v-model="editContent"
                        placeholder="写点什么…" spellcheck="false"
                        class="note-editor-ta"
                        @keydown.meta.enter="goBack"
                        @keydown.ctrl.enter="goBack"></textarea>
                    <div class="note-editor-foot">
                        <span class="text-[10px] text-muted font-medium">{{ editContent.length }} 字</span>
                        <span class="text-[10px] text-muted ml-auto">⌘/Ctrl+Enter 保存</span>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
/* 搜索栏 */
.note-search {
    position: relative;
    margin-bottom: 16px;
}
.note-search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-muted);
    pointer-events: none;
}
.note-search-input {
    width: 100%;
    background: var(--color-bg-elev);
    border-radius: 999px;
    padding: 10px 16px 10px 36px;
    font-size: 13px;
    color: var(--color-ink);
    border: 1px solid var(--color-line);
    outline: none;
    transition: border-color 0.15s;
}
.note-search-input::placeholder { color: var(--color-muted); }
.note-search-input:focus { border-color: var(--color-accent); }

/* 便签网格 */
.note-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}
@media (max-width: 520px) { .note-grid { grid-template-columns: repeat(2, 1fr); } }

.sticky {
    border-radius: 4px 4px 14px 14px;
    padding: 14px 14px 10px;
    min-height: 90px;
    cursor: pointer;
    position: relative;
    text-align: left;
    display: flex;
    flex-direction: column;
    transition: transform 0.18s, box-shadow 0.18s;
    box-shadow: 0 2px 8px #00000010;
}
.sticky:hover {
    transform: translateY(-2px) rotate(-0.4deg);
    box-shadow: 0 6px 18px #00000016;
}
.sticky::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, transparent 50%, #00000008 50%);
    border-radius: 0 4px 0 0;
}

/* 便签颜色 — 见下方 unscoped block */

.sticky-pin {
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 13px;
    filter: drop-shadow(0 1px 2px #00000020);
}
.sticky-text {
    font-size: 12px;
    line-height: 1.7;
    color: var(--color-ink);
    flex: 1;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 5;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-wrap;
}
.sticky-time {
    font-size: 9.5px;
    color: var(--color-muted);
    font-weight: 500;
    margin-top: 8px;
}

.note-empty {
    grid-column: 1 / -1;
    padding: 60px 0;
    text-align: center;
}

/* FAB */
.note-fab {
    position: fixed;
    right: max(24px, calc(50% - 336px));
    bottom: 28px;
    z-index: 20;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hi, var(--color-accent)));
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px #00000030, inset 0 2px 0 #ffffff44;
    transition: 0.15s;
}
.note-fab:hover { transform: scale(1.08); }
.note-fab:active { transform: scale(0.94); }

/* 分页 */
.note-page-btn {
    color: var(--color-accent);
    font-weight: 600;
    font-size: 13px;
}
.note-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* === 编辑页 === */
.note-edit-page {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
}
.note-back {
    font-size: 13px;
    color: var(--color-muted);
    padding: 6px 10px;
    border-radius: 8px;
    font-weight: 600;
    transition: 0.12s;
}
.note-back:hover {
    color: var(--color-ink);
    background: var(--color-bg-hi);
}
.note-act {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-muted);
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--color-bg-hi);
    transition: 0.12s;
}
.note-act:hover { color: var(--color-accent); background: var(--accent-soft); }
.note-act.pin-on { color: var(--color-accent); background: var(--accent-soft); }
.note-act.del:hover { color: var(--bad); background: var(--bad-soft); }

/* 颜色圆点 */
.note-cdot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2.5px solid transparent;
    transition: 0.12s;
    box-shadow: 0 1px 4px #00000012;
}
.note-cdot:hover { transform: scale(1.12); }
.note-cdot.on { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--accent-soft); }

/* 颜色圆点颜色 — 见下方 unscoped block */

/* 编辑器 */
.note-editor-wrap {
    flex: 1;
    min-height: 0;
    background: var(--color-bg-elev);
    border-radius: 16px;
    border: 1px solid var(--color-line);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.note-editor-ta {
    flex: 1;
    width: 100%;
    resize: none;
    padding: 18px 20px;
    font-size: 14px;
    line-height: 1.85;
    color: var(--color-ink);
    background: transparent;
    outline: none;
    border: none;
}
.note-editor-ta::placeholder { color: var(--color-muted); }
.note-editor-foot {
    padding: 10px 16px;
    border-top: 1px solid var(--color-line);
    display: flex;
    align-items: center;
}
</style>

<style>
/* 便签 & 颜色圆点的主题色（需 unscoped 匹配 [data-theme] 祖先） */
[data-theme="sky"] .sticky[data-c="white"],
[data-theme="sky"] .note-cdot[data-c="white"] { background: #ffffff; }
[data-theme="sky"] .sticky[data-c="yellow"],
[data-theme="sky"] .note-cdot[data-c="yellow"] { background: #fff8e1; }
[data-theme="sky"] .sticky[data-c="blue"],
[data-theme="sky"] .note-cdot[data-c="blue"] { background: #e8f2ff; }
[data-theme="sky"] .sticky[data-c="green"],
[data-theme="sky"] .note-cdot[data-c="green"] { background: #e6f9ee; }
[data-theme="sky"] .sticky[data-c="pink"],
[data-theme="sky"] .note-cdot[data-c="pink"] { background: #fce8ec; }

[data-theme="night"] .sticky[data-c="white"],
[data-theme="night"] .note-cdot[data-c="white"] { background: var(--color-bg-elev); }
[data-theme="night"] .sticky[data-c="yellow"],
[data-theme="night"] .note-cdot[data-c="yellow"] { background: #3a3424; }
[data-theme="night"] .sticky[data-c="blue"],
[data-theme="night"] .note-cdot[data-c="blue"] { background: #1e2a3a; }
[data-theme="night"] .sticky[data-c="green"],
[data-theme="night"] .note-cdot[data-c="green"] { background: #1e3328; }
[data-theme="night"] .sticky[data-c="pink"],
[data-theme="night"] .note-cdot[data-c="pink"] { background: #3a2228; }
</style>
