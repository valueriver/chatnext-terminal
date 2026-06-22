<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useMemoriesStore } from '@/apps/memories/store';
import { useWsStore } from '@/system/stores/ws';
import AppPanel from '@/system/components/AppPanel.vue';

const mem = useMemoriesStore();
const ws = useWsStore();
const activeTier = ref('all');
const expandedId = ref(null);

const TIERS = [
    { key: 'all', icon: '📚', label: '全部', hint: 'AI 自动积累的所有记忆' },
    { key: 'full', icon: '🧠', label: '全量注入', hint: '每次对话都会完整注入 system prompt' },
    { key: 'starred', icon: '⭐', label: '摘要注入', hint: '只注入摘要，节省 token 保留关键信息' },
    { key: 'stored', icon: '📦', label: '归档', hint: '不主动注入，AI 需要时自行查询' },
];

const counts = computed(() => {
    const c = { all: mem.items.length, full: 0, starred: 0, stored: 0 };
    for (const m of mem.items) {
        if (m.tier === 'full') c.full++;
        else if (m.tier === 'starred') c.starred++;
        else c.stored++;
    }
    return c;
});

const filteredItems = computed(() => {
    if (activeTier.value === 'all') return mem.items;
    if (activeTier.value === 'stored') return mem.items.filter(m => m.tier !== 'full' && m.tier !== 'starred');
    return mem.items.filter(m => m.tier === activeTier.value);
});

const currentHint = computed(() => TIERS.find(t => t.key === activeTier.value)?.hint || '');

function tierColor(tier) {
    if (tier === 'full') return 'bg-accent';
    if (tier === 'starred') return 'bg-warn';
    return 'bg-faint';
}

function fmt(ts) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const d = new Date(t);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
function toggle(id) { expandedId.value = expandedId.value === id ? null : id; }
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
            <span v-if="mem.items.length" class="text-[11px] font-bold text-faint">{{ mem.items.length }} 条记忆</span>
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <!-- Tier 标签栏 -->
                <div class="flex gap-1.5 mb-2 flex-wrap">
                    <button v-for="t in TIERS" :key="t.key"
                        class="flex items-center gap-1.5 text-[11px] font-bold rounded-[12px] px-3.5 py-2 shadow-sm transition"
                        :class="activeTier === t.key ? 'bg-accent/15 text-accent-hi' : 'bg-bg-elev border border-line text-faint hover:text-ink'"
                        @click="activeTier = t.key; expandedId = null">
                        <span>{{ t.icon }}</span>
                        <span>{{ t.label }}</span>
                        <span class="text-[10px] font-extrabold rounded-full px-1.5 py-px"
                            :class="activeTier === t.key ? 'bg-accent text-white' : 'bg-bg-hi text-faint'">{{ counts[t.key] }}</span>
                    </button>
                </div>
                <div class="text-[10px] text-faint mb-3.5 ml-1">{{ currentHint }}</div>

                <!-- 记忆列表 -->
                <div class="flex flex-col gap-2">
                    <div v-for="m in filteredItems" :key="m.id"
                        class="group relative rounded-[16px] bg-bg-elev border border-line overflow-hidden cursor-pointer transition hover:shadow-md"
                        @click="toggle(m.id)">
                        <!-- Tier 指示条 -->
                        <div class="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm" :class="tierColor(m.tier)"></div>

                        <div class="px-4 py-3">
                            <div class="flex items-start gap-2.5">
                                <div class="flex-1 min-w-0">
                                    <div v-if="m.title" class="text-[13px] font-bold text-ink mb-0.5">{{ m.title }}</div>
                                    <div class="text-[11.5px] text-muted leading-relaxed">{{ m.summary || m.content }}</div>
                                </div>
                            </div>

                            <!-- 展开详情 -->
                            <div v-if="expandedId === m.id && m.content && m.content !== m.summary" class="mt-2.5 pt-2.5 border-t border-line">
                                <div class="text-[12px] leading-relaxed text-muted whitespace-pre-wrap break-words">{{ m.content }}</div>
                            </div>

                            <div class="flex items-center gap-1.5 mt-2 text-[10px] text-faint">
                                <span class="font-bold bg-bg-hi rounded-full px-2 py-px">{{ m.tier === 'full' ? '全量' : m.tier === 'starred' ? '星标' : '归档' }}</span>
                                <span>{{ fmt(m.created_at) }}</span>
                                <div class="flex-1"></div>
                                <button class="opacity-0 group-hover:opacity-100 hover:text-bad transition-opacity font-bold" @click.stop="remove(m)">遗忘</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="!mem.items.length" class="text-center py-16">
                    <div class="text-[40px] opacity-50 mb-3">📚</div>
                    <div class="text-muted text-[13px]">{{ ws.canUseActions ? 'AI 还没存下关于你的记忆' : '未连接本机 Server' }}</div>
                    <div v-if="ws.canUseActions" class="text-faint text-[12px] mt-1">多和它聊聊，它会自己记住</div>
                </div>
            </div>
        </div>
    </section>
</template>
