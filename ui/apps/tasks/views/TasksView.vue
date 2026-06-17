<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useTasksStore } from '@/apps/tasks/store';
import { useWsStore } from '@/system/stores/ws';
import { pill, fmtTime } from '@/apps/tasks/lib';
import TaskDetail from '@/apps/tasks/TaskDetail.vue';
import AppPanel from '@/system/components/AppPanel.vue';

const store = useTasksStore();
const ws = useWsStore();
const draft = ref('');
const task = computed(() => store.detail.task);

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
                    <p class="text-muted text-[12.5px] leading-relaxed mx-1.5 mb-3">应用发起的 AI 任务在这里统一执行、记录过程与结果。也可手动发一个当迷你 agent 用。</p>
                    <div class="rounded-2xl bg-bg-elev border border-line p-2.5 mb-4 flex items-center gap-2">
                        <input v-model="draft" :disabled="!ws.canUseActions" placeholder="给 AI 派个任务…" spellcheck="false"
                            class="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ink px-1" @keydown.enter="runNew" />
                        <button class="cta" :disabled="!draft.trim() || !ws.canUseActions" @click="runNew">发起</button>
                    </div>
                    <div class="flex flex-col gap-2">
                        <button v-for="it in store.items" :key="it.id" class="text-left rounded-[13px] bg-bg-elev border border-line px-3.5 py-3 hover:border-line-hi transition" @click="store.open(it.id)">
                            <div class="flex items-center gap-2">
                                <span class="text-[11px] font-bold rounded-full px-2 py-0.5" :class="pill(it.status).cls">{{ pill(it.status).label }}</span>
                                <span class="text-ink text-[13px] font-bold truncate">{{ it.name }}</span>
                                <span class="flex-1"></span>
                                <span class="text-faint text-[11px]">{{ fmtTime(it.created_at) }}</span>
                            </div>
                            <div class="text-muted text-[12.5px] mt-1 truncate">{{ it.prompt }}</div>
                        </button>
                        <div v-if="!store.items.length" class="text-muted text-[13px] text-center py-12">
                            {{ ws.canUseActions ? '还没有任务。' : '未连接本机 Server。' }}
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </section>
</template>
