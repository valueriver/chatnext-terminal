<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useTasksStore } from '@/apps/tasks/store';
import { useWsStore } from '@/system/stores/ws';
import { pill, isActive, fmtTime } from '@/apps/tasks/lib';
import TaskDetail from '@/apps/tasks/TaskDetail.vue';
import AppPanel from '@/system/components/AppPanel.vue';

const store = useTasksStore();
const ws = useWsStore();
const draft = ref('');
const expandedId = ref(null);
const task = computed(() => store.detail.task);

const counts = computed(() => {
    const c = { running: 0, done: 0, error: 0 };
    for (const t of store.items) {
        if (isActive(t.status)) c.running++;
        else if (t.status === 'error') c.error++;
        else c.done++;
    }
    return c;
});
const running = computed(() => store.items.filter(t => isActive(t.status)));
const finished = computed(() => store.items.filter(t => !isActive(t.status)));

function toggle(id) { expandedId.value = expandedId.value === id ? null : id; }

async function runNew() {
    const p = draft.value.trim();
    if (!p || !ws.canUseActions) return;
    draft.value = '';
    await store.run({ name: '手动任务', prompt: p });
}
async function load() { if (ws.canUseActions) await store.load(); }
onMounted(load);
watch(() => ws.canUseActions, (v) => { if (v) load(); });
</script>

<template>
    <section class="view">
        <div class="flex items-center gap-2.5 shrink-0 px-4 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-1">
            <button v-if="store.openId" class="text-muted hover:text-ink text-[18px] -ml-1 px-1" title="返回" @click="store.close()">‹</button>
            <div class="flex-1 min-w-0 text-[15px] font-extrabold text-ink truncate">{{ store.openId ? (task?.name || '任务') : '任务' }}</div>
            <AppPanel />
        </div>
        <div class="page-wrap">
            <div class="page-inner">
                <!-- 详情 -->
                <TaskDetail v-if="store.openId && task" :task="task" :messages="store.detail.messages" @abort="store.abort(task.id)" />

                <!-- 列表 -->
                <template v-else>
                    <!-- 状态摘要 -->
                    <div class="flex gap-2 mb-3.5" v-if="store.items.length">
                        <div class="flex items-center gap-1.5 text-[11px] font-bold rounded-xl bg-bg-elev border border-line px-3 py-1.5">
                            <span class="w-2 h-2 rounded-full bg-good pulse"></span>
                            <span class="text-[14px] font-black text-ink">{{ counts.running }}</span>
                            <span class="text-faint">运行中</span>
                        </div>
                        <div class="flex items-center gap-1.5 text-[11px] font-bold rounded-xl bg-bg-elev border border-line px-3 py-1.5">
                            <span class="w-2 h-2 rounded-full bg-accent"></span>
                            <span class="text-[14px] font-black text-ink">{{ counts.done }}</span>
                            <span class="text-faint">已结束</span>
                        </div>
                        <div v-if="counts.error" class="flex items-center gap-1.5 text-[11px] font-bold rounded-xl bg-bg-elev border border-line px-3 py-1.5">
                            <span class="w-2 h-2 rounded-full bg-bad"></span>
                            <span class="text-[14px] font-black text-ink">{{ counts.error }}</span>
                            <span class="text-faint">出错</span>
                        </div>
                    </div>

                    <!-- 新建任务 -->
                    <div class="flex items-center gap-2 mb-4">
                        <input v-model="draft" :disabled="!ws.canUseActions" placeholder="给 AI 一个任务…" spellcheck="false"
                            class="flex-1 min-w-0 h-[44px] px-4 rounded-[14px] bg-bg-elev border-[1.5px] border-line-hi text-[13px] text-ink outline-none focus:border-accent transition" @keydown.enter="runNew" />
                        <button class="h-[44px] px-5 rounded-[14px] bg-gradient-to-br from-accent to-accent-hi text-white text-[12px] font-bold shadow-md hover:-translate-y-px transition shrink-0 disabled:opacity-45"
                            :disabled="!draft.trim() || !ws.canUseActions" @click="runNew">▶ 执行</button>
                    </div>

                    <!-- 运行中 -->
                    <template v-if="running.length">
                        <div class="text-[10px] font-extrabold text-faint tracking-widest uppercase mb-2 ml-1">● 正在执行</div>
                        <div class="flex flex-col gap-2 mb-4">
                            <div v-for="it in running" :key="it.id"
                                class="relative rounded-[16px] bg-bg-elev border border-line overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition"
                                @click="store.open(it.id)">
                                <div class="absolute left-0 top-0 bottom-0 w-[3.5px] rounded-l-[16px] bg-good"></div>
                                <div class="flex items-center gap-3 px-4 py-3">
                                    <div class="w-8 h-8 rounded-[10px] bg-good/12 flex items-center justify-center text-good text-[13px] font-bold shrink-0">⟳</div>
                                    <div class="flex-1 min-w-0">
                                        <div class="text-[12.5px] font-semibold text-ink truncate">{{ it.prompt }}</div>
                                        <div class="text-[10.5px] text-faint mt-0.5">{{ fmtTime(it.created_at) }}</div>
                                    </div>
                                    <span class="text-[9px] font-extrabold uppercase tracking-wide rounded-full px-2 py-0.5" :class="pill(it.status).cls">{{ pill(it.status).label }}</span>
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- 历史 -->
                    <template v-if="finished.length">
                        <div class="text-[10px] font-extrabold text-faint tracking-widest uppercase mb-2 ml-1">历史任务</div>
                        <div class="flex flex-col gap-2">
                            <div v-for="it in finished" :key="it.id"
                                class="relative rounded-[16px] bg-bg-elev border border-line overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition"
                                @click="store.open(it.id)">
                                <div class="absolute left-0 top-0 bottom-0 w-[3.5px] rounded-l-[16px]"
                                    :class="it.status === 'done' ? 'bg-accent' : it.status === 'error' ? 'bg-bad' : 'bg-faint'"></div>
                                <div class="flex items-center gap-3 px-4 py-3">
                                    <div class="w-8 h-8 rounded-[10px] flex items-center justify-center text-[13px] font-bold shrink-0"
                                        :class="it.status === 'done' ? 'bg-accent/12 text-accent' : it.status === 'error' ? 'bg-bad/12 text-bad' : 'bg-bg-hi text-faint'">
                                        {{ it.status === 'done' ? '✓' : it.status === 'error' ? '✕' : '—' }}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="text-[12.5px] font-semibold text-ink truncate">{{ it.prompt }}</div>
                                        <div class="text-[10.5px] text-faint mt-0.5">{{ fmtTime(it.created_at) }}</div>
                                    </div>
                                    <span class="text-[9px] font-extrabold uppercase tracking-wide rounded-full px-2 py-0.5" :class="pill(it.status).cls">{{ pill(it.status).label }}</span>
                                </div>
                            </div>
                        </div>
                    </template>

                    <div v-if="!store.items.length" class="text-center py-16">
                        <div class="text-[40px] opacity-50 mb-3">⏱️</div>
                        <div class="text-muted text-[13px]">{{ ws.canUseActions ? '还没有任务' : '未连接本机 Server' }}</div>
                        <div v-if="ws.canUseActions" class="text-faint text-[12px] mt-1">给 AI 一个指令开始吧</div>
                    </div>
                </template>
            </div>
        </div>
    </section>
</template>
