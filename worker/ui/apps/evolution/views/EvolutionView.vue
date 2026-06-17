<script setup>
import { onMounted, watch } from 'vue';
import { useEvolutionStore } from '@/apps/evolution/store';
import { useWsStore } from '@/system/stores/ws';
import AppPanel from '@/system/components/AppPanel.vue';

const evo = useEvolutionStore();
const ws = useWsStore();

function fmt(ts) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const d = new Date(t);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
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
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <p class="text-muted text-[12.5px] leading-relaxed mx-1.5 mb-3.5">AI 自我演化出的人设与原则，<b class="text-muted/90">最新一版即生效</b>，作为系统提示最高优先。AI 在对话里通过 sql 自行迭代，这里只读。</p>

                <div class="relative flex flex-col gap-3 pl-4 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-line-hi">
                    <div v-for="(n, i) in evo.items" :key="n.id" class="group relative">
                        <span class="absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-bg" :class="i === 0 ? 'bg-accent' : 'bg-line-hi'"></span>
                        <div class="rounded-[13px] bg-bg-elev border border-line px-3.5 py-3" :class="i === 0 ? 'border-accent/40' : ''">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span v-if="i === 0" class="text-accent-hi text-[11px] font-bold">最新生效</span>
                                <span class="text-faint text-[11px]">{{ fmt(n.created_at) }}</span>
                                <span class="flex-1"></span>
                                <button class="text-muted text-[12px] opacity-0 group-hover:opacity-100 hover:text-bad transition-opacity" @click="remove(n)">删除</button>
                            </div>
                            <div class="text-[14px] leading-7 text-ink whitespace-pre-wrap break-words">{{ n.content }}</div>
                            <div v-if="n.reason" class="text-muted text-[12px] mt-2 pt-2 border-t border-line">迭代缘由：{{ n.reason }}</div>
                        </div>
                    </div>
                    <div v-if="!evo.items.length" class="text-muted text-[13px] text-center py-14">
                        {{ ws.canUseActions ? 'AI 还没有演化出自己的人设。多和它聊聊。' : '未连接本机 Server，无法读取进化。' }}
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
