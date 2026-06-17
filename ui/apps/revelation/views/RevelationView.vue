<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRevelationStore } from '@/apps/revelation/store';
import { useWsStore } from '@/system/stores/ws';
import { renderMd } from '@/apps/chat/lib/format';
import AppPanel from '@/system/components/AppPanel.vue';

const rev = useRevelationStore();
const ws = useWsStore();
const openId = ref(null);

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
                class="shrink-0 text-[12.5px] font-bold rounded-full px-3 py-1.5 bg-accent text-white disabled:opacity-45 transition"
                :disabled="!ws.canUseActions || rev.running"
                @click="runNow"
            >{{ rev.running ? '生成中…' : '立即生成' }}</button>
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <p class="text-muted text-[12.5px] leading-relaxed mx-1.5 mb-3.5">每天到设定时间，AI 自我升级一次：读懂你 → 升级自己(进化) → 沉淀记忆 → 递上一份「启示」。在设置里改时间。</p>

                <div class="flex flex-col gap-2.5">
                    <div v-for="n in rev.items" :key="n.id" class="group rounded-[13px] bg-bg-elev border border-line overflow-hidden">
                        <div class="flex items-center gap-2 px-3.5 py-3 cursor-pointer" @click="toggle(n)">
                            <span class="text-accent-hi text-[13px] font-bold">{{ n.day }}</span>
                            <span class="text-muted text-[12.5px] truncate flex-1" v-if="openId !== n.id">{{ String(n.preview || '').replace(/[#*>`]/g, '').slice(0, 40) }}</span>
                            <span v-else class="flex-1"></span>
                            <button class="text-muted text-[12px] opacity-0 group-hover:opacity-100 hover:text-bad transition-opacity" @click.stop="remove(n)">删除</button>
                            <span class="text-faint text-[12px]">{{ openId === n.id ? '收起' : '展开' }}</span>
                        </div>
                        <div v-if="openId === n.id" class="px-4 pb-4 pt-1 border-t border-line">
                            <div class="md" v-html="renderMd(rev.detail[n.id]?.content || '加载中…')"></div>
                        </div>
                    </div>
                    <div v-if="!rev.items.length" class="text-muted text-[13px] text-center py-14">
                        {{ ws.canUseActions ? '还没有启示。点「立即生成」或等明天清晨。' : '未连接本机 Server，无法读取启示。' }}
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
