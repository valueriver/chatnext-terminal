<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useTasksStore } from '@/apps/tasks/store';
import { useWsStore } from '@/system/stores/ws';
import { renderMd } from '@/apps/chat/lib/format';
import AppPanel from '@/system/components/AppPanel.vue';

const store = useTasksStore();
const ws = useWsStore();
const draft = ref('');

const STATUS = {
    pending: { label: '排队', cls: 'text-warn bg-warn/12' },
    running: { label: '运行中', cls: 'text-accent-hi bg-accent/15' },
    done: { label: '完成', cls: 'text-good bg-good/12' },
    error: { label: '失败', cls: 'text-bad bg-bad/12' },
    aborted: { label: '已中止', cls: 'text-muted bg-bg-hi' },
};
const pill = (s) => STATUS[s] || STATUS.aborted;
const isActive = (s) => s === 'pending' || s === 'running';

const task = computed(() => store.detail.task);
const fmt = (ts) => { const t = Number(ts) || 0; if (!t) return ''; const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function argsOf(tc) { try { return JSON.parse(tc.function?.arguments || '{}'); } catch { return {}; } }

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
                <template v-if="store.openId && task">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="text-[11px] font-bold rounded-full px-2 py-0.5" :class="pill(task.status).cls">{{ pill(task.status).label }}</span>
                        <span class="text-faint text-[11px]">{{ fmt(task.created_at) }}</span>
                        <span class="flex-1"></span>
                        <button v-if="isActive(task.status)" class="text-bad text-[12px] font-bold" @click="store.abort(task.id)">中止</button>
                    </div>

                    <div class="text-muted text-[11px] font-bold tracking-wider mb-1.5">提示</div>
                    <div class="rounded-[13px] bg-bg-elev border border-line px-3.5 py-3 text-[13.5px] text-ink whitespace-pre-wrap break-words mb-5">{{ task.prompt }}</div>

                    <div v-if="store.detail.messages.some(m => m.role === 'tool' || m.tool_calls)" class="text-muted text-[11px] font-bold tracking-wider mb-1.5">执行过程</div>
                    <div class="flex flex-col gap-2 mb-5">
                        <template v-for="m in store.detail.messages" :key="m.id">
                            <div v-if="m.tool_calls" v-for="(tc, i) in m.tool_calls" :key="m.id + '-' + i" class="rounded-[10px] bg-bg-hi border border-line px-3 py-2">
                                <div class="text-[12px] font-bold text-accent-hi">🔧 {{ tc.function?.name }}</div>
                                <pre class="text-[11px] text-muted mt-1 whitespace-pre-wrap break-words font-mono">{{ JSON.stringify(argsOf(tc)) }}</pre>
                            </div>
                            <div v-else-if="m.role === 'tool'" class="rounded-[10px] bg-bg-elev border border-line px-3 py-2 text-[11px] text-muted font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">{{ m.content }}</div>
                        </template>
                    </div>

                    <template v-if="task.status === 'done'">
                        <div class="text-muted text-[11px] font-bold tracking-wider mb-1.5">结果</div>
                        <div class="rounded-[13px] bg-bg-elev border border-line px-4 py-3"><div class="md" v-html="renderMd(task.response || '（空）')"></div></div>
                    </template>
                    <div v-else-if="task.status === 'error'" class="rounded-[13px] bg-bad/12 border border-bad/40 px-3.5 py-3 text-[13px] text-bad whitespace-pre-wrap">{{ task.error }}</div>
                    <div v-else-if="isActive(task.status)" class="text-muted text-[13px] py-2">运行中…</div>
                </template>

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
                                <span class="text-faint text-[11px]">{{ fmt(it.created_at) }}</span>
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
