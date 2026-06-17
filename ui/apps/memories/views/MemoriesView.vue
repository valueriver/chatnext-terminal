<script setup>
import { computed, onMounted, watch } from 'vue';
import { useMemoriesStore } from '@/apps/memories/store';
import { useWsStore } from '@/system/stores/ws';
import AppPanel from '@/system/components/AppPanel.vue';

const mem = useMemoriesStore();
const ws = useWsStore();

const TIERS = [
    { key: 'full', label: '必读记忆', hint: '全文注入提示' },
    { key: 'starred', label: '星标记忆', hint: '摘要注入提示' },
    { key: 'stored', label: '已归档记忆', hint: '仅计数，按需查询' },
];
const groups = computed(() => TIERS.map((t) => ({
    ...t,
    items: mem.items.filter((m) => (t.key === 'stored' ? (m.tier !== 'full' && m.tier !== 'starred') : m.tier === t.key)),
})).filter((g) => g.items.length));

function fmt(ts) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const d = new Date(t);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
async function remove(m) {
    if (!ws.canUseActions) return;
    if (window.confirm('删除这条记忆？不可恢复。')) await mem.remove(m.id);
}
async function load() { if (ws.canUseActions) await mem.load(); }
onMounted(load);
watch(() => ws.canUseActions, (v) => { if (v) load(); });
</script>

<template>
    <section class="view">
        <div class="flex items-center gap-2.5 shrink-0 px-4 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-1">
            <div class="flex-1 min-w-0 text-[15px] font-extrabold text-ink">记忆</div>
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <p class="text-muted text-[12.5px] leading-relaxed mx-1.5 mb-3.5">AI 对你的长期认知。<b class="text-muted/90">遇到值得记住的事它会自己存</b>，分必读/星标/归档三层。这里只读。</p>

                <div v-for="g in groups" :key="g.key" class="mb-6">
                    <div class="flex items-baseline gap-2 mx-1.5 mb-2">
                        <span class="text-[11.5px] font-extrabold tracking-wider text-muted">{{ g.label }}</span>
                        <span class="text-faint text-[11px]">{{ g.hint }} · {{ g.items.length }}</span>
                    </div>
                    <div class="flex flex-col gap-2.5">
                        <div v-for="m in g.items" :key="m.id" class="group rounded-[13px] bg-bg-elev border border-line px-3.5 py-3">
                            <div class="flex items-center gap-2 mb-1">
                                <span v-if="m.title" class="text-ink text-[13.5px] font-bold">{{ m.title }}</span>
                                <span class="flex-1"></span>
                                <span class="text-faint text-[11px]">{{ fmt(m.created_at) }}</span>
                                <button class="text-muted text-[12px] opacity-0 group-hover:opacity-100 hover:text-bad transition-opacity" @click="remove(m)">删除</button>
                            </div>
                            <div class="text-[13.5px] leading-relaxed text-ink whitespace-pre-wrap break-words">{{ m.content || m.summary }}</div>
                            <div v-if="m.content && m.summary && m.summary !== m.content" class="text-muted text-[12px] mt-1.5">摘要：{{ m.summary }}</div>
                        </div>
                    </div>
                </div>

                <div v-if="!mem.items.length" class="text-muted text-[13px] text-center py-14">
                    {{ ws.canUseActions ? 'AI 还没存下关于你的记忆。多和它聊聊。' : '未连接本机 Server，无法读取记忆。' }}
                </div>
            </div>
        </div>
    </section>
</template>
