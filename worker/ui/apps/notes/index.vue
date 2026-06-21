<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useNotesStore } from '@/apps/notes/store';
import ControlCenter from '@/system/components/ControlCenter.vue';

const notes = useNotesStore();
const COLORS = ['white', 'yellow', 'blue', 'green', 'pink'];

const query = ref('');
const mode = ref('list');          // list | edit
const editId = ref(null);          // null = 新建
const editText = ref('');
const editColor = ref('yellow');
const editPin = ref(false);
const editorEl = ref(null);

const filtered = computed(() => {
    const q = query.value.trim().toLowerCase();
    const list = q ? notes.items.filter((n) => (n.content || '').toLowerCase().includes(q)) : notes.items;
    return list; // 后端已按 pinned DESC, id DESC 排
});

function relTime(ts) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const diff = Date.now() - t;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    const d = new Date(t);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function openNew() {
    editId.value = null; editText.value = ''; editColor.value = 'yellow'; editPin.value = false;
    mode.value = 'edit';
    nextTick(() => editorEl.value?.focus());
}
function openEdit(n) {
    editId.value = n.id; editText.value = n.content || ''; editColor.value = n.color || 'yellow'; editPin.value = !!n.pinned;
    mode.value = 'edit';
}
async function goBack() {
    const text = editText.value.trim();
    if (editId.value == null) {
        if (text) await notes.save({ content: text, color: editColor.value, pinned: editPin.value ? 1 : 0 });
    } else if (!text) {
        await notes.remove(editId.value);
    } else {
        await notes.save({ id: editId.value, content: text, color: editColor.value, pinned: editPin.value ? 1 : 0 });
    }
    mode.value = 'list';
}
async function delEdit() {
    if (editId.value != null) await notes.remove(editId.value);
    mode.value = 'list';
}

onMounted(notes.load);
</script>

<template>
    <section class="view">
        <!-- ===== 列表页 ===== -->
        <template v-if="mode === 'list'">
            <header class="flex shrink-0 items-center gap-3 px-6 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-3">
                <h1 class="font-serif text-xl font-black tracking-tight text-ink">笔记</h1>
                <span v-if="notes.items.length" class="text-[11px] font-bold text-faint">{{ notes.items.length }} 张</span>
                <ControlCenter class="ml-auto" />
            </header>

            <div class="shrink-0 px-6 pb-3">
                <div class="relative mx-auto max-w-[720px]">
                    <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-faint">🔍</span>
                    <input
                        v-model="query" placeholder="搜索笔记…"
                        class="w-full rounded-full border-0 bg-bg-elev py-2.5 pl-9 pr-4 text-[13px] text-ink shadow-sm outline-none ring-0 placeholder:text-faint focus:ring-2 focus:ring-accent/30"
                    />
                </div>
            </div>

            <div class="flex-1 overflow-y-auto px-6 pb-24">
              <div class="mx-auto max-w-[720px]">
                <div v-if="!filtered.length" class="select-none pt-24 text-center">
                    <div class="mb-2 text-4xl opacity-50">{{ query ? '🔍' : '📝' }}</div>
                    <div class="text-[12.5px] text-muted">{{ query ? '没有找到' : '还没有笔记' }}</div>
                </div>
                <div v-else class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    <button
                        v-for="n in filtered" :key="n.id"
                        class="sticky-note group relative flex min-h-[92px] flex-col p-3.5 pb-2.5 text-left"
                        :style="{ background: `var(--note-${n.color || 'yellow'})` }"
                        @click="openEdit(n)"
                    >
                        <span v-if="n.pinned" class="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[13px] drop-shadow">📌</span>
                        <div class="flex-1 whitespace-pre-wrap break-words text-[12px] leading-[1.7] text-ink line-clamp-5">{{ n.content }}</div>
                        <span class="mt-2 text-[9.5px] font-medium text-faint">{{ relTime(n.created_at) }}</span>
                    </button>
                </div>
              </div>
            </div>

            <button class="fab fixed bottom-7 right-[max(24px,calc(50%-336px))] z-20 grid h-[50px] w-[50px] place-items-center rounded-full text-2xl font-light text-white" @click="openNew">+</button>
        </template>

        <!-- ===== 编辑页 ===== -->
        <template v-else>
            <header class="flex shrink-0 items-center gap-3 px-6 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-3">
                <button class="rounded-lg px-2 py-1.5 text-[14px] font-semibold text-muted transition hover:bg-[var(--well)] hover:text-ink" @click="goBack">← 返回</button>
                <div class="flex-1 font-serif text-base font-extrabold text-ink">{{ editId == null ? '新建笔记' : '编辑笔记' }}</div>
                <button
                    class="rounded-full px-3 py-1.5 text-[11px] font-bold transition"
                    :class="editPin ? 'bg-accent/15 text-accent' : 'bg-[var(--well)] text-muted hover:bg-accent/10 hover:text-accent'"
                    @click="editPin = !editPin"
                >📌 置顶</button>
                <button v-if="editId != null" class="rounded-full bg-[var(--well)] px-3 py-1.5 text-[11px] font-bold text-muted transition hover:bg-bad/10 hover:text-bad" @click="delEdit">删除</button>
            </header>

            <div class="flex shrink-0 justify-center gap-2 px-6 pb-4">
                <button
                    v-for="c in COLORS" :key="c"
                    class="h-[22px] w-[22px] rounded-full border-[2.5px] shadow-sm transition hover:scale-110"
                    :class="editColor === c ? 'border-accent ring-[3px] ring-accent/30' : 'border-transparent'"
                    :style="{ background: `var(--note-${c})` }"
                    @click="editColor = c"
                ></button>
            </div>

            <div class="mx-auto mb-6 flex min-h-0 w-[calc(100%-48px)] max-w-[720px] flex-1 flex-col overflow-hidden rounded-2xl bg-bg-elev shadow-sm">
                <textarea
                    ref="editorEl" v-model="editText" placeholder="写点什么…" spellcheck="false"
                    class="min-h-0 flex-1 resize-none border-0 bg-transparent px-5 py-4 text-[14px] leading-[1.85] text-ink outline-none placeholder:text-faint"
                ></textarea>
                <div class="flex items-center gap-3 border-t border-line px-4 py-2.5">
                    <span class="text-[10px] font-medium text-faint">{{ editText.length }} 字</span>
                    <button
                        class="ml-auto rounded-full bg-accent px-5 py-1.5 text-[12.5px] font-bold text-bg transition hover:opacity-90 active:scale-95 disabled:opacity-30"
                        :disabled="!editText.trim()" @click="goBack"
                    >保存</button>
                </div>
            </div>
        </template>
    </section>
</template>

<style scoped>
.sticky-note {
    border-radius: 4px 4px 14px 14px;
    box-shadow: 0 2px 8px #00000010;
    transition: transform .18s, box-shadow .18s;
}
.sticky-note:hover { transform: translateY(-2px) rotate(-.4deg); box-shadow: 0 6px 18px #00000016; }
.sticky-note::before {
    content: ''; position: absolute; top: 0; right: 0; width: 16px; height: 16px;
    background: linear-gradient(135deg, transparent 50%, #00000010 50%); border-radius: 0 4px 0 0;
}
.fab {
    background: linear-gradient(135deg, var(--accent), var(--accent-d));
    box-shadow: 0 8px 24px #00000030, inset 0 2px 0 #ffffff44;
    transition: transform .15s;
}
.fab:hover { transform: scale(1.08); }
.fab:active { transform: scale(.94); }
</style>
