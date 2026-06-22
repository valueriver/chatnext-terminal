<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRevelationStore } from '@/apps/revelation/store';
import { useWsStore } from '@/system/stores/ws';
import { renderMd } from '@/apps/chat/lib/format';
import AppPanel from '@/system/components/AppPanel.vue';

const rev = useRevelationStore();
const ws = useWsStore();
const openId = ref(null);

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

function parseDay(dayStr) {
    if (!dayStr) return { d: '?', m: '' };
    const parts = dayStr.split('-');
    return { d: parseInt(parts[2]) || '?', m: MONTHS[parseInt(parts[1]) - 1] || '' };
}
function isToday(dayStr) {
    return dayStr === new Date().toISOString().slice(0, 10);
}

async function toggle(n) {
    if (openId.value === n.id) { openId.value = null; return; }
    openId.value = n.id;
    await rev.open(n.id);
}
async function remove(n) {
    if (!ws.canUseActions) return;
    if (window.confirm('删除这份启示？不可恢复。')) await rev.remove(n.id);
}
async function runNow() {
    if (!ws.canUseActions || rev.running) return;
    await rev.runNow();
}
async function load() { if (ws.canUseActions) await rev.load(); }
onMounted(load);
watch(() => ws.canUseActions, (v) => { if (v) load(); });
</script>

<template>
    <section class="view">
        <div class="flex items-center gap-2.5 shrink-0 px-4 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-1">
            <div class="flex-1 min-w-0 text-[15px] font-extrabold text-ink">启示</div>
            <button
                class="shrink-0 flex items-center gap-1.5 text-[11px] font-bold rounded-[12px] px-4 py-2 bg-gradient-to-br from-accent to-accent-hi text-white shadow-md hover:-translate-y-px transition disabled:opacity-45"
                :disabled="!ws.canUseActions || rev.running"
                @click="runNow">
                <svg v-if="rev.running" class="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2.5" stroke-dasharray="28" stroke-dashoffset="8" stroke-linecap="round"/></svg>
                <span>{{ rev.running ? '生成中…' : '▶ 立即生成' }}</span>
            </button>
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <p class="text-faint text-[12px] leading-relaxed mx-1 mb-4">每天定时，AI 自动执行：读取上下文 → 更新进化 → 整理记忆 → 生成报告。</p>

                <div class="flex flex-col gap-2.5">
                    <div v-for="(n, i) in rev.items" :key="n.id"
                        class="group rounded-[16px] bg-bg-elev border border-line overflow-hidden transition"
                        :class="openId === n.id ? 'shadow-md' : 'hover:shadow-sm'">
                        <!-- 报告头 -->
                        <div class="flex items-center gap-3 px-4 py-3 cursor-pointer" @click="toggle(n)">
                            <div class="w-12 h-12 rounded-[14px] flex flex-col items-center justify-center shrink-0"
                                :class="i === 0 ? 'bg-gradient-to-br from-accent to-accent-hi text-white' : 'bg-bg-hi text-ink'">
                                <span class="text-[18px] font-black leading-none">{{ parseDay(n.day).d }}</span>
                                <span class="text-[9px] font-bold opacity-70 mt-px">{{ parseDay(n.day).m }}</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-[13px] font-bold text-ink">{{ isToday(n.day) ? '今日启示' : '启示 · ' + n.day }}</div>
                                <div v-if="openId !== n.id" class="text-[11px] text-faint mt-0.5 truncate">{{ String(n.preview || '').replace(/[#*>`]/g, '').slice(0, 60) }}</div>
                            </div>
                            <span class="text-faint text-[12px] transition" :class="openId === n.id ? 'rotate-90' : ''">›</span>
                        </div>

                        <!-- 展开的报告 -->
                        <div v-if="openId === n.id" class="px-4 pb-4">
                            <div class="rounded-[12px] bg-bg p-4">
                                <div class="md" v-html="renderMd(rev.detail[n.id]?.content || '加载中…')"></div>
                            </div>
                            <div class="flex items-center gap-2 mt-3 text-[10px] text-faint">
                                <span>自动生成</span>
                                <div class="flex-1"></div>
                                <button class="opacity-0 group-hover:opacity-100 hover:text-bad transition-opacity font-bold" @click.stop="remove(n)">删除</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="!rev.items.length" class="text-center py-16">
                    <div class="text-[40px] opacity-50 mb-3">🌅</div>
                    <div class="text-muted text-[13px]">{{ ws.canUseActions ? '还没有启示' : '未连接本机 Server' }}</div>
                    <div v-if="ws.canUseActions" class="text-faint text-[12px] mt-1">点「立即生成」或等明天清晨</div>
                </div>
            </div>
        </div>
    </section>
</template>
