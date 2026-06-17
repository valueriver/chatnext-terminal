<script setup>
import { onMounted, ref, watch } from 'vue';
import { useNotesStore } from '@/apps/notes/store';
import { useWsStore } from '@/system/stores/ws';
import AppPanel from '@/system/components/AppPanel.vue';

const notes = useNotesStore();
const ws = useWsStore();
const draft = ref('');
const posting = ref(false);

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
function tagsOf(n) { try { return JSON.parse(n.tags || '[]'); } catch { return []; } }

async function post() {
    const content = draft.value.trim();
    if (!content || posting.value || !ws.canUseActions) return;
    posting.value = true;
    await notes.save({ content });
    draft.value = '';
    posting.value = false;
}
async function remove(n) {
    if (!ws.canUseActions) return;
    if (window.confirm('删除这条笔记？不可恢复。')) await notes.remove(n.id);
}

async function load() { if (ws.canUseActions) await notes.load(1); }
onMounted(load);
watch(() => ws.canUseActions, (v) => { if (v) load(); });
</script>

<template>
    <section class="view">
        <div class="flex items-center gap-2.5 shrink-0 px-4 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-1">
            <div class="flex-1 min-w-0 text-[15px] font-extrabold text-ink">笔记</div>
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <p class="text-muted text-[12.5px] leading-relaxed mx-1.5 mb-3.5">随手记下想法、状态、片段 —— <b class="text-muted/90">AI 对话时会读它来了解你</b>。数据只留在本机。</p>

                <div class="rounded-2xl bg-bg-elev border border-line p-3 mb-[18px]">
                    <textarea
                        v-model="draft"
                        rows="3"
                        :disabled="!ws.canUseActions"
                        placeholder="写一条笔记…"
                        spellcheck="false"
                        class="w-full bg-transparent text-ink text-[15px] leading-7 outline-none resize-none border-0"
                        @keydown.meta.enter="post"
                        @keydown.ctrl.enter="post"
                    ></textarea>
                    <div class="flex items-center gap-2.5 mt-1.5">
                        <span class="text-muted text-[11px]">⌘/Ctrl + Enter 发送</span>
                        <button class="cta ml-auto" :disabled="!draft.trim() || posting || !ws.canUseActions" @click="post">{{ posting ? '保存中…' : '保存' }}</button>
                    </div>
                </div>

                <div class="flex flex-col gap-2.5">
                    <div v-for="n in notes.items" :key="n.id" class="group rounded-[13px] bg-bg-elev border border-line px-3.5 py-3">
                        <div class="text-[14px] leading-7 text-ink whitespace-pre-wrap break-words">{{ n.content }}</div>
                        <div class="flex items-center gap-2 mt-2">
                            <span class="text-faint text-[11px]">{{ fmt(n.created_at) }}</span>
                            <span v-for="t in tagsOf(n)" :key="t" class="text-accent-hi text-[11px] font-bold">#{{ t }}</span>
                            <span class="flex-1"></span>
                            <button class="text-muted text-[12px] opacity-0 group-hover:opacity-100 hover:text-bad transition-opacity" @click="remove(n)">删除</button>
                        </div>
                    </div>
                    <div v-if="!notes.items.length" class="text-muted text-[13px] text-center py-14">
                        {{ ws.canUseActions ? '发下第一条笔记吧。' : '未连接本机 Server，无法读写笔记。' }}
                    </div>
                </div>

                <div v-if="notes.pages > 1" class="flex items-center justify-center gap-3.5 mt-5 text-muted text-[13px]">
                    <button class="set-act" :disabled="notes.page <= 1" @click="notes.load(notes.page - 1)">上一页</button>
                    <span>{{ notes.page }} / {{ notes.pages }} · {{ notes.total }} 条</span>
                    <button class="set-act" :disabled="notes.page >= notes.pages" @click="notes.load(notes.page + 1)">下一页</button>
                </div>
            </div>
        </div>
    </section>
</template>
