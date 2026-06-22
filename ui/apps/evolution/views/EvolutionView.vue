<script setup>
import { onMounted, ref, watch } from 'vue';
import { useEvolutionStore } from '@/apps/evolution/store';
import { useWsStore } from '@/system/stores/ws';
import AppPanel from '@/system/components/AppPanel.vue';

const evo = useEvolutionStore();
const ws = useWsStore();
const expandedId = ref(null);

function fmt(ts) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const d = new Date(t);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function toggle(id) { expandedId.value = expandedId.value === id ? null : id; }
async function remove(n) {
    if (!ws.canUseActions) return;
    if (window.confirm('删除这一版进化？不可恢复。')) await evo.remove(n.id);
}
async function load() { if (ws.canUseActions) await evo.load(); }
onMounted(load);
watch(() => ws.canUseActions, (v) => { if (v) load(); });
</script>

<template>
    <section class="view">
        <div class="flex items-center gap-2.5 shrink-0 px-4 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-1">
            <div class="flex-1 min-w-0 text-[15px] font-extrabold text-ink">进化</div>
            <span v-if="evo.items.length" class="text-[11px] font-bold text-faint">第 {{ evo.items.length }} 代</span>
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <!-- 当前生效人格 -->
                <div v-if="evo.items.length" class="relative rounded-[18px] bg-bg-elev border border-line overflow-hidden px-5 py-4.5 mb-5 shadow-sm">
                    <div class="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-accent via-good to-accent"></div>
                    <div class="inline-flex items-center gap-1.5 text-[9px] font-extrabold tracking-wide rounded-full px-2.5 py-1 bg-good/12 text-good mb-3">
                        <span class="w-1.5 h-1.5 rounded-full bg-good pulse"></span>
                        ACTIVE · 当前人格
                    </div>
                    <div class="text-[14px] leading-7 text-ink whitespace-pre-wrap break-words">{{ evo.items[0].content }}</div>
                    <div class="flex items-center gap-2.5 mt-3 text-[10.5px] text-faint">
                        <span>🧬 {{ evo.items[0].reason || '—' }}</span>
                        <span>· {{ fmt(evo.items[0].created_at) }}</span>
                    </div>
                </div>

                <!-- 进化时间线 -->
                <div v-if="evo.items.length > 0" class="text-[10px] font-extrabold text-faint tracking-widest uppercase mb-3 ml-1">进化历程</div>
                <div class="relative flex flex-col gap-3.5 pl-5 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-[2px] before:bg-line-hi before:rounded-full">
                    <div v-for="(n, i) in evo.items" :key="n.id" class="group relative">
                        <span class="absolute -left-5 top-[14px] w-[16px] h-[16px] rounded-full border-[2.5px] flex items-center justify-center z-[2]"
                            :class="i === 0 ? 'border-accent bg-bg-elev' : 'border-line-hi bg-bg-elev'">
                            <span class="w-[5px] h-[5px] rounded-full" :class="i === 0 ? 'bg-accent' : 'bg-faint'"></span>
                        </span>
                        <div class="rounded-[14px] bg-bg-elev border border-line px-4 py-3 cursor-pointer transition hover:shadow-md"
                            :class="i === 0 ? 'border-accent/30' : ''" @click="toggle(n.id)">
                            <div class="inline-block text-[10px] font-bold rounded-md px-2 py-0.5 bg-accent/12 text-accent-hi mb-2">{{ n.reason || '人格更新' }}</div>
                            <div class="text-[12.5px] leading-relaxed text-muted whitespace-pre-wrap break-words"
                                :class="expandedId === n.id ? '' : 'line-clamp-3'">{{ n.content }}</div>
                            <div class="flex items-center gap-2 mt-2 text-[10px] text-faint">
                                <span>{{ fmt(n.created_at) }}</span>
                                <div class="flex-1"></div>
                                <button v-if="i > 0" class="opacity-0 group-hover:opacity-100 hover:text-bad transition-opacity font-bold" @click.stop="remove(n)">删除</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="!evo.items.length" class="text-center py-16">
                    <div class="text-[40px] opacity-50 mb-3">🧬</div>
                    <div class="text-muted text-[13px]">{{ ws.canUseActions ? 'AI 还没有演化出自己的人设' : '未连接本机 Server' }}</div>
                    <div v-if="ws.canUseActions" class="text-faint text-[12px] mt-1">多和它聊聊，它会自己进化</div>
                </div>
            </div>
        </div>
    </section>
</template>
